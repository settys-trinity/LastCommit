// FARSIDE target station v2: Wokwi simulation (ESP32)
// Team Last Commit, HackAthlone 2026
//
// 8 channels: SpO2, heart rate, breathing rate, systolic BP (sliders), skin temperature (DHT22),
// posture (MPU6050), cabin CO2 (slider), reaction test (white button + LED).
// ALL physiological values are SIMULATED. Say so on stage.
//
// Rule (same as app/src/engine/triage.ts):
//   red finding + round trip <= 600 s          -> tier 3, message Earth
//   red finding + round trip  > 600 s / no link -> tier 2, crew medical officer acts now
//   amber finding                               -> tier 1, self-care
//
// What v2 adds on top of v1:
//   - scenarios develop over time (baseline -> onset -> plateau) with physiological noise
//   - crew display (ILI9341): 8 colour tiles, trend arrows, who-acts box, ECG trace, Earth link
//   - wrist watch (OLED): alert, acknowledge, 1-minute box breathing
//   - Earth link model: report packets, one-way travel, reply, store-and-forward with no link
//   - Mars distance slider: round trip 6 to 44 min, who acts is recalculated as it moves
//   - forecast: time until a channel turns red, from its slope over the last seconds
//   - partial NEWS2 score, sticky limits (fast to alarm, slow to clear), sensor fault handling
//   - alarm buzzer, link ring, extra serial events
//
// Buttons:  MISSION  (blue)   ISS -> Moon -> Mars -> Conjunction
//           SCENARIO (yellow) LIVE -> Nominal -> Hypoxia -> CO2 build-up -> Fatigue -> Cardio
//                             -> Heat stress -> Orthostatic
//           TAP      (white)  starts a 5-tap reaction test; tap when the white LED lights
//           WATCH    (green)  acknowledges an alarm, otherwise starts / stops box breathing
// Serial keys (type in the serial monitor): m mission, s scenario, w watch, f SpO2 probe fault, h help
// Serial out (115200): one "vitals" JSON line per second (v1 fields unchanged, new fields appended)
//                      plus event lines: decision, packet_tx, packet_at_earth, ground_reply,
//                      reaction, ack, breathing, fault.

#include <Wire.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_ILI9341.h>
#include <Adafruit_NeoPixel.h>
#include <DHTesp.h>

// =====================================================================================
// 1. CONFIG
// =====================================================================================
const bool BUZZER_ON = true;        // set false for a silent demo
const uint8_t TFT_ROTATION = 1;     // crew display upside down in your layout? use 3
const float SAFE_WAIT_S = 600.0f;   // DESIGN_CHOICE, informed by NASA/TM-20250003885
const float SPEED_UP = 60.0f;       // Earth clock runs 60x faster (say so on stage)
const uint32_t SAMPLE_MS = 250;     // sense + score + route, 4 times per second
const uint32_t BREATHE_MS = 60000;  // box breathing session, 4-4-4-4
const float LIGHT_S_PER_AU = 499.004f;
const float MARS_AU_MIN = 0.37f, MARS_AU_MAX = 2.646f;  // closest approach .. far side (44 min round trip)

// pins
const int PIN_SPO2 = 34, PIN_HR = 35, PIN_RR = 32, PIN_BP = 33, PIN_CO2 = 39, PIN_DIST = 36;  // ADC1 (39 = VN, 36 = VP)
const int PIN_DHT = 15;
const int PIN_BTN_MISSION = 25, PIN_BTN_SCENARIO = 26, PIN_BTN_TAP = 27, PIN_BTN_WATCH = 0;
const int PIN_LED_PROMPT = 13, PIN_LED_GREEN = 16, PIN_LED_AMBER = 17, PIN_LED_RED = 4;
const int PIN_BUZZER = 12, PIN_RING = 14;
const int PIN_TFT_CS = 5, PIN_TFT_DC = 2;  // SPI: SCK 18, MOSI 23
const uint8_t MPU_ADDR = 0x68;

// colours (RGB565)
const uint16_t C_BG = 0x0000, C_WHITE = 0xFFFF, C_DIM = 0x8410, C_NAVY = 0x0011, C_CYAN = 0x07FF;
const uint16_t C_GREEN = 0x07E0, C_AMBER = 0xFD20, C_RED = 0xF800, C_FAULT = 0xA254, C_CLEAR = 0x0320;

// =====================================================================================
// 2. TYPES (every struct and enum lives here, above the first function. The Arduino
//    builder puts its auto-generated prototypes before the first function, so a type
//    declared lower down is unknown to them. That was the v1 build error.)
// =====================================================================================
enum { CH_SPO2, CH_HR, CH_RR, CH_BP, CH_SKIN, CH_CO2, CH_REACT, CH_TILT, N_CH };
enum { ST_GREEN, ST_AMBER, ST_RED, ST_FAULT };
enum { M_ISS, M_MOON, M_MARS, M_CONJUNCT, N_MISSIONS };
enum RtState { RT_IDLE, RT_WAIT, RT_LIT };
enum PktState { PK_FREE, PK_QUEUED, PK_UPLINK, PK_DOWNLINK, PK_DONE };
enum { BTN_MISSION, BTN_SCENARIO, BTN_TAP, BTN_WATCH, N_BTN };
enum {  // crew display text fields (cached, redrawn only when they change)
  F_MIS, F_RT1, F_RT2, F_MET, F_SCN, F_WHY, F_NEWS, F_LINKS, F_LINKB, F_ENG, F_FC,
  F_TILE, F_TREND = F_TILE + N_CH, N_FIELDS = F_TREND + N_CH
};

struct Mission { const char *name; float roundTripS; };  // < 0 = no link

struct Limit {
  const char *name, *unit;
  float ambLo, ambHi, redLo, redHi;  // amber if <= ambLo or >= ambHi, red if <= redLo or >= redHi
  float hyst;                        // a finding clears only after the value is this far inside
  float validLo, validHi;            // outside this range the sensor is treated as faulty
  float noise;                       // simulated measurement noise (preset scenarios)
  float lag;                         // 0..1, how late this channel reacts inside a scenario onset
  uint8_t decimals;
};

struct Scenario { const char *name; float target[N_CH]; float holdS, onsetS; };

struct Triage { int tier; int worst; int worstStatus; const char *acts; };

struct Packet {
  uint16_t seq; uint8_t state, tier; int8_t worst;
  float rtS;                      // round trip when it left
  uint32_t sentMs, legMs, doneMs; // legMs = one-way travel in simulated (60x) milliseconds
};

struct Forecast { int ch; float etaS; };

// =====================================================================================
// 3. TABLES
// =====================================================================================
const Mission MISSIONS[N_MISSIONS] = {  // docs/delay_table.md
  {"ISS", 0.5f}, {"MOON", 2.6f}, {"MARS", 2640.0f}, {"CONJUNCT", -1.0f},
};

// Sources: NEWS2 (Royal College of Physicians 2017) for SpO2 scale 1, HR, RR, systolic BP low side;
// BP high side: AHA hypertensive crisis >= 180; reaction 355 ms = PVT-B lapse (Basner 2011);
// CO2, skin temp, tilt, reaction red: DESIGN_CHOICE, verify before the pitch.
const Limit LIMITS[N_CH] = {
  // name    unit    ambLo ambHi redLo redHi  hyst  validLo validHi noise  lag   dec
  {"SpO2",  "%",     93,   1e9,  91,   1e9,   0.5f, 50,     100.5f, 0.25f, 0.00f, 0},
  {"HR",    "bpm",   50,   111,  40,   131,   2.0f, 20,     250,    1.2f,  0.15f, 0},
  {"RR",    "/min",  11,   21,   8,    25,    0.5f, 2,      70,     0.3f,  0.10f, 0},
  {"BP",    "mmHg",  100,  140,  90,   180,   2.0f, 40,     280,    1.5f,  0.20f, 0},
  {"SKIN",  "C",     30,   37,   28,   39,    0.2f, 10,     45,     0.04f, 0.30f, 1},
  {"CO2",   "ppm",   -1e9, 4000, -1e9, 5300,  100,  100,    50000,  20,    0.00f, 0},
  {"REACT", "ms",    -1e9, 356,  -1e9, 500,   10,   80,     5000,   0,     0.35f, 0},
  {"TILT",  "deg",   -1e9, 5,    -1e9, 10,    0.5f, -1,     181,    0.15f, 0.25f, 1},
};

// The crew member's own normal values. Scenarios start here and drift to their target.
const float BASELINE[N_CH] = {97, 68, 14, 118, 33.5f, 1500, 290, 1.0f};

// Index 0 (LIVE) reads the sliders and sensors. 1 to 5 are the v1 presets, unchanged end values.
const Scenario SCENARIOS[] = {
  //                 SpO2 HR   RR  BP   SKIN   CO2   REACT TILT    hold onset
  {"LIVE",          {0,   0,   0,  0,   0,     0,    0,    0},      0,   0},
  {"NOMINAL",       {97,  68,  14, 118, 33.5f, 1500, 290,  1.0f},   0,   1},   // all green
  {"HYPOXIA",       {89,  118, 23, 124, 33.0f, 1500, 380,  1.5f},   3,   12},  // SpO2 red, HR + RR + reaction amber
  {"CO2 BUILDUP",   {96,  92,  22, 132, 34.0f, 6000, 400,  1.2f},   3,   16},  // CO2 red, RR + reaction amber
  {"FATIGUE",       {97,  74,  15, 120, 33.2f, 1500, 520,  6.0f},   3,   12},  // reaction red, tilt amber
  {"CARDIO",        {96,  136, 18, 186, 33.8f, 1500, 300,  1.0f},   3,   10},  // HR red, BP red
  {"HEAT STRESS",   {96,  124, 22, 108, 39.4f, 1500, 370,  2.0f},   3,   14},  // skin red, HR + RR + reaction amber
  {"ORTHOSTATIC",   {96,  122, 20, 86,  31.5f, 1500, 390,  11.5f},  3,   10},  // BP red, tilt red, HR + reaction amber
};
const int N_SCENARIOS = sizeof(SCENARIOS) / sizeof(SCENARIOS[0]);

// =====================================================================================
// 4. STATE
// =====================================================================================
Adafruit_SSD1306 oled(128, 64, &Wire, -1);
Adafruit_ILI9341 tft(PIN_TFT_CS, PIN_TFT_DC);
Adafruit_NeoPixel ring(16, PIN_RING, NEO_GRB + NEO_KHZ800);
DHTesp dht;

int mission = M_ISS, scenario = 1;
float cur[N_CH];                 // current channel values
int st[N_CH];                    // current channel status
int trend[N_CH];                 // -1 falling, 0 steady, +1 rising
Triage tri = {0, -1, 0, "none"};
Forecast fc = {-1, 0};
int lastTier = -1, news2 = 0;
float roundTripS = 0.5f, marsAu = MARS_AU_MAX, marsRtS = 2640.0f;
uint32_t engineUs = 0, scenarioStartMs = 0, decisionCount = 0;
bool missionChanged = false, forceSample = true, injectFault = false;

// sensors
float liveSkin = 33.5f, liveTilt = 0, lastReactionMs = 290, swayDeg = 0;
float adcEma[6] = {-1, -1, -1, -1, -1, -1};
float tiltBuf[8];
int tiltN = 0, dhtFails = 0;
bool imuOk = false;

// history for trend and forecast (1 sample per second)
const int HIST_N = 10;
float hist[N_CH][HIST_N];
int histCount = 0;

// Earth link
const int OUTBOX_N = 6;
Packet outbox[OUTBOX_N];
uint16_t nextSeq = 1;
uint32_t repliesRx = 0;

// alarm, watch, breathing
bool alarmOn = false, alarmAcked = false, breathing = false;
uint32_t alarmStartMs = 0, beepNextMs = 0, breatheStartMs = 0;
int beepStep = 0;

// reaction test
RtState rtState = RT_IDLE;
int rtTrial = 0, rtFalseStarts = 0;
uint32_t rtLitAt = 0, rtNextAt = 0;
float rtTimes[5];

// buttons: falling-edge interrupts, so a press is never missed while a display redraws
const int BTN_PINS[N_BTN] = {PIN_BTN_MISSION, PIN_BTN_SCENARIO, PIN_BTN_TAP, PIN_BTN_WATCH};
volatile uint32_t isrCount[N_BTN] = {0, 0, 0, 0};
volatile uint32_t isrAt[N_BTN] = {0, 0, 0, 0};
uint32_t btnSeen[N_BTN] = {0, 0, 0, 0};

// crew display caches
char fText[N_FIELDS][54];
uint16_t fFg[N_FIELDS], fBg[N_FIELDS];
int tileSt[N_CH], boxTier = -1, dotX = -1, ecgX = 0, ecgY = 176;
float ecgPhase = 0;
uint32_t ecgLastMs = 0, ringHash = 1;
bool oledInverted = false;

// =====================================================================================
// 5. SMALL HELPERS
// =====================================================================================
void IRAM_ATTR isrMission() { uint32_t n = millis(); if (n - isrAt[BTN_MISSION] > 120) { isrAt[BTN_MISSION] = n; isrCount[BTN_MISSION] = isrCount[BTN_MISSION] + 1; } }
void IRAM_ATTR isrScenario() { uint32_t n = millis(); if (n - isrAt[BTN_SCENARIO] > 120) { isrAt[BTN_SCENARIO] = n; isrCount[BTN_SCENARIO] = isrCount[BTN_SCENARIO] + 1; } }
void IRAM_ATTR isrTap() { uint32_t n = millis(); if (n - isrAt[BTN_TAP] > 120) { isrAt[BTN_TAP] = n; isrCount[BTN_TAP] = isrCount[BTN_TAP] + 1; } }
void IRAM_ATTR isrWatch() { uint32_t n = millis(); if (n - isrAt[BTN_WATCH] > 120) { isrAt[BTN_WATCH] = n; isrCount[BTN_WATCH] = isrCount[BTN_WATCH] + 1; } }

float clampf(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }
int imax(int a, int b) { return a > b ? a : b; }
float smooth(float p) { p = clampf(p, 0, 1); return p * p * (3 - 2 * p); }
bool hasLink() { return roundTripS >= 0; }

void fmtClock(char *buf, float s) {  // "0.5s" or "44:00"
  if (s < 60) { sprintf(buf, "%.1fs", s); return; }
  int t = (int)(s + 0.5f);
  sprintf(buf, "%02d:%02d", t / 60, t % 60);
}

void fmtValue(char *buf, int ch) {
  if (st[ch] == ST_FAULT || isnan(cur[ch])) { strcpy(buf, "FAULT"); return; }
  sprintf(buf, LIMITS[ch].decimals ? "%.1f" : "%.0f", cur[ch]);
}

uint16_t statusColor(int s) {
  return s == ST_GREEN ? C_GREEN : s == ST_AMBER ? C_AMBER : s == ST_RED ? C_RED : C_FAULT;
}

void beep(unsigned int hz, unsigned long ms) { if (BUZZER_ON) tone(PIN_BUZZER, hz, ms); }

// =====================================================================================
// 6. SENSE: sliders, DHT22, MPU6050, and the scenario model
// =====================================================================================
float slider(int idx, int pin, float lo, float hi) {
  long sum = 0;
  for (int i = 0; i < 4; i++) sum += analogRead(pin);
  float raw = sum / 4.0f;
  adcEma[idx] = adcEma[idx] < 0 ? raw : adcEma[idx] * 0.5f + raw * 0.5f;
  return lo + (hi - lo) * clampf(adcEma[idx] / 4095.0f, 0, 1);
}

void imuInit() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); Wire.write(0);  // wake up
  imuOk = Wire.endTransmission() == 0;
}

float imuTilt() {  // degrees from vertical, NAN if the sensor does not answer
  if (!imuOk) return NAN;
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return NAN;
  if (Wire.requestFrom((int)MPU_ADDR, 6) != 6) return NAN;
  int16_t raw[3];
  for (int i = 0; i < 3; i++) { int hi = Wire.read(); int lo = Wire.read(); raw[i] = (int16_t)((hi << 8) | lo); }
  float ax = raw[0] / 16384.0f, ay = raw[1] / 16384.0f, az = raw[2] / 16384.0f;
  float mag = sqrtf(ax * ax + ay * ay + az * az);
  if (mag < 0.01f) return 0;
  return acosf(fminf(1.0f, fabsf(az) / mag)) * 57.29578f;
}

void readSlowSensors() {  // every 2 s
  TempAndHumidity th = dht.getTempAndHumidity();
  if (isnan(th.temperature)) { if (++dhtFails >= 3) liveSkin = NAN; }
  else { dhtFails = 0; liveSkin = th.temperature; }
}

void updateMarsDistance() {  // slider -> distance -> round trip, in 10 s steps
  float au = slider(5, PIN_DIST, MARS_AU_MIN, MARS_AU_MAX);
  marsAu = au;
  marsRtS = roundf(2.0f * au * LIGHT_S_PER_AU / 10.0f) * 10.0f;
}

float currentRoundTrip() { return mission == M_MARS ? marsRtS : MISSIONS[mission].roundTripS; }

void liveVitals(float *out) {
  out[CH_SPO2] = slider(0, PIN_SPO2, 80, 100);
  out[CH_HR] = slider(1, PIN_HR, 30, 180);
  out[CH_RR] = slider(2, PIN_RR, 4, 40);
  out[CH_BP] = slider(3, PIN_BP, 70, 200);
  out[CH_CO2] = slider(4, PIN_CO2, 400, 8000);
  out[CH_SKIN] = liveSkin;
  out[CH_TILT] = liveTilt;
  out[CH_REACT] = lastReactionMs;
}

float chNoise(int ch, float tS, float rr) {
  const Limit &l = LIMITS[ch];
  if (l.noise <= 0) return 0;
  float n = l.noise * (0.6f * sinf(tS * (0.37f + 0.11f * ch) + ch * 1.7f) + 0.4f * (random(-1000, 1001) / 1000.0f));
  if (ch == CH_HR) n += 1.5f * sinf(tS * rr * 0.10472f);  // heart rate rises and falls with each breath
  return n;
}

void scenarioVitals(int sc, float tS, float *out) {
  const Scenario &s = SCENARIOS[sc];
  for (int i = 0; i < N_CH; i++) {
    float lag = LIMITS[i].lag;
    float p = smooth((tS - s.holdS - lag * s.onsetS) / (s.onsetS * (1.0f - lag)));
    out[i] = BASELINE[i] + (s.target[i] - BASELINE[i]) * p;
  }
  float rr = out[CH_RR];
  for (int i = 0; i < N_CH; i++) out[i] += chNoise(i, tS, rr);
  out[CH_SPO2] = fminf(out[CH_SPO2], 100.0f);
  out[CH_TILT] = fmaxf(out[CH_TILT], 0.0f);
}

void updateSway() {  // standard deviation of the last 8 tilt samples
  if (isnan(cur[CH_TILT])) { swayDeg = 0; return; }
  tiltBuf[tiltN % 8] = cur[CH_TILT];
  tiltN++;
  int n = tiltN < 8 ? tiltN : 8;
  float mean = 0, var = 0;
  for (int i = 0; i < n; i++) mean += tiltBuf[i];
  mean /= n;
  for (int i = 0; i < n; i++) var += (tiltBuf[i] - mean) * (tiltBuf[i] - mean);
  swayDeg = sqrtf(var / n);
}

// =====================================================================================
// 7. SCORE: limits with sticky clearing, partial NEWS2, trend and forecast
// =====================================================================================
int statusOf(const Limit &l, float v) {  // v1 rule, unchanged
  if (v <= l.redLo || v >= l.redHi) return ST_RED;
  if (v <= l.ambLo || v >= l.ambHi) return ST_AMBER;
  return ST_GREEN;
}

int grade(int ch, float v, int prev) {
  const Limit &l = LIMITS[ch];
  if (isnan(v) || v < l.validLo || v > l.validHi) return ST_FAULT;
  int s = statusOf(l, v);
  if (prev == ST_FAULT || s >= prev) return s;  // getting worse: act at once
  int held = imax(s, imax(statusOf(l, v - l.hyst), statusOf(l, v + l.hyst)));
  return held < prev ? held : prev;             // getting better: only once clearly inside
}

// NEWS2 points for the 4 of 7 parameters this station measures (SpO2 scale 1, pulse,
// respiration, systolic BP). Core temperature, consciousness and oxygen use are not measured.
int news2Partial() {
  int n = 0;
  if (st[CH_SPO2] != ST_FAULT) { float v = cur[CH_SPO2]; n += v <= 91 ? 3 : v <= 93 ? 2 : v <= 95 ? 1 : 0; }
  if (st[CH_HR] != ST_FAULT) { float v = cur[CH_HR]; n += v <= 40 ? 3 : v <= 50 ? 1 : v <= 90 ? 0 : v <= 110 ? 1 : v <= 130 ? 2 : 3; }
  if (st[CH_RR] != ST_FAULT) { float v = cur[CH_RR]; n += v <= 8 ? 3 : v <= 11 ? 1 : v <= 20 ? 0 : v <= 24 ? 2 : 3; }
  if (st[CH_BP] != ST_FAULT) { float v = cur[CH_BP]; n += v <= 90 ? 3 : v <= 100 ? 2 : v <= 110 ? 1 : v <= 219 ? 0 : 3; }
  return n;
}

void pushHistory() {
  if (histCount == HIST_N) {
    for (int c = 0; c < N_CH; c++) for (int i = 1; i < HIST_N; i++) hist[c][i - 1] = hist[c][i];
    histCount--;
  }
  for (int c = 0; c < N_CH; c++) hist[c][histCount] = cur[c];
  histCount++;
}

// Change per second over the last n seconds, or 0 if the channel did not move the same way
// in every one of those seconds. Plain differences only: noise and a finished change give 0.
float steadyRate(int ch, int n) {
  if (histCount < n + 1) return 0;
  const float *h = &hist[ch][histCount - n - 1];
  int up = 0, down = 0;
  for (int i = 0; i < n; i++) {
    if (isnan(h[i]) || isnan(h[i + 1])) return 0;
    if (h[i + 1] > h[i]) up++;
    if (h[i + 1] < h[i]) down++;
  }
  if (up != n && down != n) return 0;
  return (h[n] - h[0]) / n;
}

void updateTrends() {  // which channel turns red first if the last 4 seconds continue
  fc.ch = -1; fc.etaS = 0;
  for (int c = 0; c < N_CH; c++) {
    const Limit &l = LIMITS[c];
    float noise = l.noise + (c == CH_HR ? 1.5f : 0.0f);  // heart rate also swings with each breath
    float minRate = fmaxf(noise * 0.8f, l.hyst * 0.1f);
    float r = steadyRate(c, 4);
    trend[c] = r > minRate ? 1 : r < -minRate ? -1 : 0;
    if (trend[c] == 0 || st[c] == ST_RED || st[c] == ST_FAULT) continue;
    float gap = -1;  // distance left to the red limit in the direction of travel
    if (trend[c] > 0 && l.redHi < 1e8f) gap = l.redHi - cur[c];
    if (trend[c] < 0 && l.redLo > -1e8f) gap = cur[c] - l.redLo;
    if (gap <= 0) continue;
    float eta = fmaxf(gap / fabsf(r), 1.0f);
    if (eta <= 90 && (fc.ch < 0 || eta < fc.etaS)) { fc.ch = c; fc.etaS = eta; }
  }
}

// =====================================================================================
// 8. ROUTE: who acts (same rule as triage.ts)
// =====================================================================================
Triage triage(const int *status, float rt) {
  int worst = -1, worstStatus = 0;
  for (int i = 0; i < N_CH; i++) {
    if (status[i] == ST_FAULT) continue;  // a faulty sensor is flagged, not graded
    if (status[i] > worstStatus) { worstStatus = status[i]; worst = i; }
  }
  Triage t = {0, worst, worstStatus, "none"};
  if (worstStatus == ST_AMBER) { t.tier = 1; t.acts = "crew"; }
  if (worstStatus == ST_RED) {
    bool earthCanAct = rt >= 0 && rt <= SAFE_WAIT_S;
    t.tier = earthCanAct ? 3 : 2;
    t.acts = earthCanAct ? "flight_surgeon" : "crew_medical_officer";
  }
  return t;
}

void setLeds(int tier) {
  // Plan D2: LED shows who acts. 1 green self-care, 2 amber crew medical officer, 3 red message Earth.
  digitalWrite(PIN_LED_GREEN, tier == 1);
  digitalWrite(PIN_LED_AMBER, tier == 2);
  digitalWrite(PIN_LED_RED, tier == 3);
}

// =====================================================================================
// 9. EARTH LINK: report packets, travel time, reply, store-and-forward
// =====================================================================================
int newestPacket() {
  int best = -1;
  for (int i = 0; i < OUTBOX_N; i++)
    if (outbox[i].state != PK_FREE && (best < 0 || outbox[i].seq > outbox[best].seq)) best = i;
  return best;
}

int countPackets(int state) {
  int n = 0;
  for (int i = 0; i < OUTBOX_N; i++) if (outbox[i].state == state) n++;
  return n;
}

void packetCreate(const Triage &t) {
  int slot = -1;
  for (int i = 0; i < OUTBOX_N && slot < 0; i++) if (outbox[i].state == PK_FREE) slot = i;
  if (slot < 0) {  // outbox full: overwrite the oldest report
    slot = 0;
    for (int i = 1; i < OUTBOX_N; i++) if (outbox[i].seq < outbox[slot].seq) slot = i;
  }
  Packet &p = outbox[slot];
  p.seq = nextSeq++; p.state = PK_QUEUED; p.tier = t.tier; p.worst = t.worst;
  p.rtS = 0; p.sentMs = 0; p.legMs = 0; p.doneMs = 0;
}

void packetSend(Packet &p, uint32_t now) {
  p.state = PK_UPLINK; p.rtS = roundTripS; p.sentMs = now;
  p.legMs = (uint32_t)(roundTripS * 500.0f / SPEED_UP);
  Serial.printf("{\"t\":\"packet_tx\",\"seq\":%u,\"tier\":%d,\"mission\":\"%s\",\"one_way_s\":%.1f,\"round_trip_s\":%.1f}\n",
                p.seq, p.tier, MISSIONS[mission].name, roundTripS / 2, roundTripS);
}

void linkUpdate(uint32_t now) {
  for (int i = 0; i < OUTBOX_N; i++) {
    Packet &p = outbox[i];
    if (p.state == PK_UPLINK && now - p.sentMs >= p.legMs) {
      p.state = PK_DOWNLINK;
      Serial.printf("{\"t\":\"packet_at_earth\",\"seq\":%u,\"after_s\":%.1f}\n", p.seq, p.rtS / 2);
    }
    if (p.state == PK_DOWNLINK && now - p.sentMs >= 2 * p.legMs) {
      p.state = PK_DONE; p.doneMs = now; repliesRx++;
      Serial.printf("{\"t\":\"ground_reply\",\"seq\":%u,\"for_tier\":%d,\"waited_s\":%.1f,\"note\":\"doctor review time not included\"}\n",
                    p.seq, p.tier, p.rtS);
      if (!alarmOn || alarmAcked) beep(2093, 70);
    }
    if (p.state == PK_DONE && now - p.doneMs > 30000) p.state = PK_FREE;
  }
}

float replyInS(const Packet &p, uint32_t now) {  // mission seconds until the reply lands
  uint32_t total = 2 * p.legMs, gone = now - p.sentMs;
  return gone >= total ? 0 : (total - gone) * SPEED_UP / 1000.0f;
}

// A new decision: update LEDs, alarm, and what goes to Earth.
void onDecision(const Triage &t, bool tierChanged, uint32_t now) {
  setLeds(t.tier);
  decisionCount++;
  Serial.printf("{\"t\":\"decision\",\"n\":%lu,\"tier\":%d,\"acts\":\"%s\",\"worst\":\"%s\",\"mission\":\"%s\","
                "\"round_trip_s\":%.1f,\"engine_us\":%lu,\"met_s\":%lu}\n",
                (unsigned long)decisionCount, t.tier, t.acts, t.worst >= 0 ? LIMITS[t.worst].name : "",
                MISSIONS[mission].name, roundTripS, (unsigned long)engineUs, (unsigned long)(now / 1000));
  if (tierChanged) {
    if (t.tier >= 2) { alarmOn = true; alarmAcked = false; alarmStartMs = now; beepNextMs = now; beepStep = 0; }
    else { alarmOn = false; if (t.tier == 1) beep(1319, 90); }
  }
  if (missionChanged)  // a different mission is a different link: reports already travelling are dropped
    for (int i = 0; i < OUTBOX_N; i++) if (outbox[i].state != PK_QUEUED) outbox[i].state = PK_FREE;
  if (t.tier >= 1 && (tierChanged || countPackets(PK_QUEUED) == 0)) packetCreate(t);
  if (hasLink())  // link up: everything waiting on board leaves now
    for (int i = 0; i < OUTBOX_N; i++) if (outbox[i].state == PK_QUEUED) packetSend(outbox[i], now);
}

// One line for the watch (21 chars) and two for the crew display.
void linkText(char *watch, char *big, char *detail, uint32_t now) {
  char clk[12], ow[12];
  int i = newestPacket();
  watch[0] = 0;
  if (i < 0) {
    strcpy(big, hasLink() ? "LINK IDLE" : "NO LINK");
    strcpy(detail, hasLink() ? "Nothing to report. Routine telemetry only." : "No link to Earth. Reports are stored on board.");
    if (tri.tier == 1) sprintf(watch, "WATCH %s", LIMITS[tri.worst].name);
    return;
  }
  const Packet &p = outbox[i];
  if (p.state == PK_QUEUED) {
    sprintf(big, "QUEUED: %d PKT", countPackets(PK_QUEUED));
    sprintf(detail, "No link. Report #%u waits on board. Crew acts alone.", p.seq);
    strcpy(watch, "EARTH: QUEUED");
  } else if (p.state == PK_DONE) {
    fmtClock(clk, p.rtS);
    strcpy(big, p.tier == 3 ? "EARTH REPLIED" : "EARTH ACK RCVD");
    sprintf(detail, "Reply to #%u after %s round trip + doctor review", p.seq, clk);
    strcpy(watch, big);
  } else {
    fmtClock(clk, replyInS(p, now));
    fmtClock(ow, p.rtS / 2);
    sprintf(big, "REPLY IN %s", clk);
    if (p.state == PK_UPLINK) sprintf(detail, "Report #%u travelling to Earth (one way %s)", p.seq, ow);
    else sprintf(detail, "Earth has report #%u. Reply travelling back.", p.seq);
    sprintf(watch, p.tier == 3 ? "WAIT REPLY %s" : "EARTH FYI %s", clk);
  }
  if (tri.tier == 1) sprintf(watch, "WATCH %s", LIMITS[tri.worst].name);
  if (tri.tier == 0) watch[0] = 0;
}

// =====================================================================================
// 10. ALARM, WATCH BUTTON, BREATHING, REACTION TEST
// =====================================================================================
void alarmUpdate(uint32_t now) {
  if (!alarmOn || alarmAcked || now < beepNextMs) return;
  bool reminder = now - alarmStartMs > 10000;  // after 10 s: one short reminder every 8 s
  if (tri.tier == 2) {                         // crew medic acts now: urgent double beep
    beep(1760, 110);
    beepStep = (beepStep + 1) % 2;
    beepNextMs = now + (beepStep == 1 ? 230 : (reminder ? 8000 : 900));
  } else {                                     // message Earth: single lower beep
    beep(880, 300);
    beepNextMs = now + (reminder ? 8000 : 1500);
  }
}

void watchPressed(uint32_t now) {
  if (alarmOn && !alarmAcked) {
    alarmAcked = true;
    noTone(PIN_BUZZER);
    Serial.printf("{\"t\":\"ack\",\"tier\":%d,\"after_ms\":%lu}\n", tri.tier, (unsigned long)(now - alarmStartMs));
  } else {
    breathing = !breathing;
    breatheStartMs = now;
    Serial.printf("{\"t\":\"breathing\",\"state\":\"%s\"}\n", breathing ? "start" : "stopped");
  }
}

// 0..1 size of the breathing circle; phase 0 in, 1 hold, 2 out, 3 hold
float breatheLevel(uint32_t now, int *phase, int *secLeft) {
  uint32_t e = now - breatheStartMs, inPhase = e % 4000;
  *phase = (e / 4000) % 4;
  *secLeft = 4 - inPhase / 1000;
  float f = inPhase / 4000.0f;
  return *phase == 0 ? smooth(f) : *phase == 1 ? 1.0f : *phase == 2 ? 1.0f - smooth(f) : 0.0f;
}

void breathingUpdate(uint32_t now) {
  if (breathing && now - breatheStartMs >= BREATHE_MS) {
    breathing = false;
    beep(1568, 120);
    Serial.println("{\"t\":\"breathing\",\"state\":\"done\",\"seconds\":60}");
  }
}

void reactionRecord(float ms) {
  digitalWrite(PIN_LED_PROMPT, LOW);
  rtTimes[rtTrial++] = ms;
  if (rtTrial < 5) { rtState = RT_WAIT; rtNextAt = millis() + random(1000, 3000); return; }
  int lapses = 0;
  for (int i = 0; i < 5; i++) if (rtTimes[i] >= 355) lapses++;
  for (int i = 1; i < 5; i++)  // sort for the median
    for (int j = i; j > 0 && rtTimes[j] < rtTimes[j - 1]; j--) { float t = rtTimes[j]; rtTimes[j] = rtTimes[j - 1]; rtTimes[j - 1] = t; }
  lastReactionMs = rtTimes[2];
  rtState = RT_IDLE;
  Serial.printf("{\"t\":\"reaction\",\"median_ms\":%.0f,\"lapses\":%d,\"false_starts\":%d}\n", lastReactionMs, lapses, rtFalseStarts);
}

void reactionUpdate(uint32_t now, bool tap, uint32_t tapAt) {
  if (rtState == RT_IDLE) {
    if (tap) { rtState = RT_WAIT; rtTrial = 0; rtFalseStarts = 0; rtNextAt = now + random(1000, 3000); }
  } else if (rtState == RT_WAIT) {
    if (tap) { rtFalseStarts++; rtNextAt = now + random(1000, 3000); }  // false start: re-arm
    else if (now >= rtNextAt) { digitalWrite(PIN_LED_PROMPT, HIGH); rtLitAt = millis(); rtState = RT_LIT; }
  } else {
    if (tap && tapAt >= rtLitAt) reactionRecord(tapAt - rtLitAt);  // time stamped in the interrupt
    else if (now - rtLitAt > 2000) reactionRecord(2000);           // no tap in 2 s counts as a lapse
  }
}

// =====================================================================================
// 11. CREW DISPLAY (ILI9341, 320 x 240)
// =====================================================================================
// Draws a text field only when its text or colours changed. Padded to `width` characters.
void put(int id, int x, int y, int size, uint16_t fg, uint16_t bg, const char *s, int width) {
  char buf[54];
  int n = 0;
  if (width > 53) width = 53;
  while (s[n] && n < width) { buf[n] = s[n]; n++; }
  while (n < width) buf[n++] = ' ';
  buf[n] = 0;
  if (fFg[id] == fg && fBg[id] == bg && strcmp(buf, fText[id]) == 0) return;
  strcpy(fText[id], buf); fFg[id] = fg; fBg[id] = bg;
  tft.setTextSize(size);
  tft.setTextColor(fg, bg);
  tft.setCursor(x, y);
  tft.print(buf);
}

void label(int x, int y, int size, uint16_t fg, uint16_t bg, const char *s) {
  tft.setTextSize(size);
  tft.setTextColor(fg, bg);
  tft.setCursor(x, y);
  tft.print(s);
}

void tftStatic() {
  char buf[16];
  tft.fillScreen(C_BG);
  tft.fillRect(0, 0, 320, 20, C_NAVY);
  label(4, 3, 2, C_CYAN, C_NAVY, "FARSIDE");
  label(272, 2, 1, C_DIM, C_NAVY, "MET");
  for (int i = 0; i < N_CH; i++) {
    sprintf(buf, "%s %s", LIMITS[i].name, LIMITS[i].unit);
    label((i / 4) * 98 + 8, 34 + (i % 4) * 26, 1, C_DIM, C_BG, buf);
    tileSt[i] = -1;
  }
  tft.drawFastHLine(0, 139, 320, C_DIM);
  label(2, 141, 1, C_DIM, C_BG, "ECG (synthetic, follows HR)");
  label(254, 142, 1, C_DIM, C_BG, "NEWS2");
  label(254, 178, 1, C_DIM, C_BG, "4 of 7");
  tft.drawFastHLine(0, 187, 320, C_DIM);
  label(2, 202, 1, C_DIM, C_BG, "SHIP");
  label(288, 202, 1, C_DIM, C_BG, "EARTH");
  tft.drawFastHLine(30, 205, 253, C_DIM);
  label(222, 223, 1, C_DIM, C_BG, "Earth clock x60");
}

void tftHeader(uint32_t now) {
  char a[24], b[24], clk[12];
  put(F_MIS, 100, 3, 2, C_WHITE, C_NAVY, MISSIONS[mission].name, 8);
  if (!hasLink()) { strcpy(a, "NO LINK"); strcpy(b, "store+fwd"); }
  else {
    fmtClock(clk, roundTripS); sprintf(a, "RT %s", clk);
    if (roundTripS / 2 < 60) sprintf(b, "1-way %.2fs", roundTripS / 2);
    else { fmtClock(clk, roundTripS / 2); sprintf(b, "1-way %s", clk); }
  }
  put(F_RT1, 202, 2, 1, C_WHITE, C_NAVY, a, 11);
  put(F_RT2, 202, 11, 1, C_WHITE, C_NAVY, b, 11);
  uint32_t s = now / 1000;
  sprintf(a, "%02lu:%02lu:%02lu", (unsigned long)(s / 3600), (unsigned long)((s / 60) % 60), (unsigned long)(s % 60));
  put(F_MET, 272, 11, 1, C_WHITE, C_NAVY, a, 8);

  char line[80], faults[24] = "";
  for (int i = 0; i < N_CH; i++) if (st[i] == ST_FAULT && strlen(faults) < 16) { strcat(faults, LIMITS[i].name); strcat(faults, " "); }
  uint32_t ts = (now - scenarioStartMs) / 1000;
  int n = sprintf(line, "%-11s %s t+%02lu:%02lu ", SCENARIOS[scenario].name, scenario == 0 ? "sliders" : "preset ",
                  (unsigned long)(ts / 60), (unsigned long)(ts % 60));
  if (mission == M_MARS) n += sprintf(line + n, "%.2f AU ", marsAu);
  if (faults[0]) sprintf(line + n, "FAULT %s", faults); else sprintf(line + n, "sensors ok");
  put(F_SCN, 2, 23, 1, faults[0] ? C_FAULT : C_WHITE, C_BG, line, 53);
}

void tftTiles() {
  char v[12];
  for (int i = 0; i < N_CH; i++) {
    int x = (i / 4) * 98, y = 34 + (i % 4) * 26;
    uint16_t col = statusColor(st[i]);
    if (st[i] != tileSt[i]) { tft.fillRect(x, y, 4, 24, col); tileSt[i] = st[i]; }
    fmtValue(v, i);
    put(F_TILE + i, x + 8, y + 9, 2, col, C_BG, v, 5);
    put(F_TREND + i, x + 76, y + 9, 2, C_WHITE, C_BG, trend[i] > 0 ? "\x18" : trend[i] < 0 ? "\x19" : " ", 1);
  }
}

void tftTierBox() {
  static const uint16_t BOX[4] = {C_CLEAR, C_GREEN, C_AMBER, C_RED};
  static const char *L1[4] = {"ALL CLEAR", "SELF-CARE", "CREW MEDIC", "MSG EARTH"};
  static const char *L2[4] = {"", "YOU ACT", "ACTS NOW", "SURGEON"};
  char buf[40], v[12];
  uint16_t bg = BOX[tri.tier], fg = (tri.tier == 0 || tri.tier == 3) ? C_WHITE : C_BG;
  if (tri.tier != boxTier) {
    boxTier = tri.tier;
    tft.fillRect(198, 34, 122, 104, bg);
    label(202, 38, 1, fg, bg, "WHO ACTS");
    sprintf(buf, "TIER %d", tri.tier);
    label(202, 50, 3, fg, bg, buf);
    label(200, 80, 2, fg, bg, L1[tri.tier]);
    label(200, 98, 2, fg, bg, L2[tri.tier]);
    fText[F_WHY][0] = 0;
  }
  int faulty = -1;
  for (int i = 0; i < N_CH; i++) if (st[i] == ST_FAULT) faulty = i;
  if (tri.worst < 0 && faulty >= 0) sprintf(buf, "CHECK SENSOR %s", LIMITS[faulty].name);
  else if (tri.worst < 0) strcpy(buf, "all channels green");
  else {  // the worst finding and how far it is from this person's baseline
    fmtValue(v, tri.worst);
    float pct = clampf((cur[tri.worst] - BASELINE[tri.worst]) * 100.0f / BASELINE[tri.worst], -999, 999);
    sprintf(buf, "WHY %s %s %+.0f%%", LIMITS[tri.worst].name, v, pct);
  }
  put(F_WHY, 200, 124, 1, fg, bg, buf, 20);
}

void tftNewsAndForecast() {
  char buf[64];
  sprintf(buf, "%2d", news2);
  put(F_NEWS, 262, 153, 3, news2 >= 7 ? C_RED : news2 >= 5 ? C_AMBER : C_GREEN, C_BG, buf, 2);
  sprintf(buf, "RULES %.2f ms", engineUs / 1000.0f);
  put(F_ENG, 222, 213, 1, C_CYAN, C_BG, buf, 16);
  int q = countPackets(PK_QUEUED), fl = countPackets(PK_UPLINK) + countPackets(PK_DOWNLINK);
  if (fc.ch >= 0)
    sprintf(buf, "FORECAST %s red in ~%.0f s | q%d fly%d rx%lu", LIMITS[fc.ch].name, fc.etaS, q, fl, (unsigned long)repliesRx);
  else sprintf(buf, "FORECAST steady | queued %d flying %d replies %lu", q, fl, (unsigned long)repliesRx);
  put(F_FC, 2, 231, 1, fc.ch >= 0 ? C_AMBER : C_DIM, C_BG, buf, 53);
}

void tftLink(uint32_t now) {
  char watch[40], big[40], detail[80];
  linkText(watch, big, detail, now);
  int i = newestPacket();
  uint16_t col = C_DIM;
  int x = -1;
  if (i >= 0) {
    const Packet &p = outbox[i];
    if (p.state == PK_QUEUED) { col = C_AMBER; x = 34; }
    else if (p.state == PK_DONE) { col = C_GREEN; x = 34; }
    else {
      float f = p.legMs ? clampf((now - p.sentMs) / (float)p.legMs, 0, 2) : 2;
      col = C_CYAN;
      x = 34 + (int)((f <= 1 ? f : 2 - f) * 244);
    }
  }
  put(F_LINKS, 2, 190, 1, C_WHITE, C_BG, detail, 53);
  put(F_LINKB, 2, 213, 2, col == C_DIM ? C_WHITE : col, C_BG, big, 18);
  if (x != dotX) {
    if (dotX >= 0) tft.fillRect(dotX - 3, 202, 7, 7, C_BG);
    tft.drawFastHLine(30, 205, 253, C_DIM);
    if (x >= 0) tft.fillCircle(x, 205, 3, col);
    dotX = x;
  }
}

float ecgWave(float ph) {  // one heartbeat, 0..1: P wave, QRS complex, T wave
  float y = 0.12f * expf(-powf((ph - 0.18f) / 0.025f, 2));
  y -= 0.12f * expf(-powf((ph - 0.335f) / 0.008f, 2));
  y += 1.00f * expf(-powf((ph - 0.350f) / 0.010f, 2));
  y -= 0.22f * expf(-powf((ph - 0.370f) / 0.009f, 2));
  y += 0.28f * expf(-powf((ph - 0.580f) / 0.045f, 2));
  return y;
}

void tftEcg(uint32_t now) {  // sweep trace, 60 px per second
  int due = (int)((now - ecgLastMs) / 16);
  if (due <= 0) return;
  if (due > 20) due = 20;
  ecgLastMs = now;
  float hr = (st[CH_HR] == ST_FAULT || isnan(cur[CH_HR])) ? 0 : cur[CH_HR];
  for (int k = 0; k < due; k++) {
    float w = 0;  // 4 points per pixel, keep the largest swing so the narrow QRS spike is never skipped
    for (int j = 0; j < 4; j++) {
      ecgPhase += 0.004f * hr / 60.0f;
      if (ecgPhase >= 1) ecgPhase -= 1;
      float e = hr > 0 ? ecgWave(ecgPhase) : 0;
      if (fabsf(e) > fabsf(w)) w = e;
    }
    int y = 178 - (int)(26 * w);
    int x = ecgX + 1;
    if (x > 246) { x = 0; ecgY = y; }
    tft.drawFastVLine(x, 150, 36, C_BG);
    if (x + 4 <= 246) tft.drawFastVLine(x + 4, 150, 36, C_BG);
    if (x > 0) tft.drawLine(x - 1, ecgY, x, y, C_GREEN); else tft.drawPixel(x, y, C_GREEN);
    ecgX = x; ecgY = y;
  }
}

// =====================================================================================
// 12. WRIST WATCH (OLED, 128 x 64) AND LINK RING
// =====================================================================================
void drawWatch(uint32_t now) {
  char line[40], clk[12], big[40], detail[80], v[12];
  bool alert = alarmOn && !alarmAcked;
  bool inv = alert && ((now / 400) % 2 == 0);
  if (inv != oledInverted) { oled.invertDisplay(inv); oledInverted = inv; }
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  if (breathing) {
    static const char *PH[4] = {"IN", "HOLD", "OUT", "HOLD"};
    int phase, secLeft;
    float lvl = breatheLevel(now, &phase, &secLeft);
    oled.print("BOX BREATHING 4-4-4-4");
    oled.drawCircle(30, 38, 23, SSD1306_WHITE);
    oled.fillCircle(30, 38, 5 + (int)(17 * lvl), SSD1306_WHITE);
    oled.setTextSize(2);
    oled.setCursor(66, 16); oled.print(PH[phase]);
    oled.setCursor(66, 34); oled.print(secLeft);
    oled.setTextSize(1);
    sprintf(line, "left %lus", (unsigned long)((BREATHE_MS - (now - breatheStartMs)) / 1000));
    oled.setCursor(66, 55); oled.print(line);
  } else if (rtState != RT_IDLE) {
    oled.print("REACTION TEST");
    oled.setTextSize(2);
    sprintf(line, "TAP %d/5", rtTrial + 1);
    oled.setCursor(0, 16); oled.print(line);
    oled.setTextSize(1);
    oled.setCursor(0, 40); oled.print(rtState == RT_LIT ? ">>> TAP NOW <<<" : "wait for the light");
    sprintf(line, "false starts %d", rtFalseStarts);
    oled.setCursor(0, 54); oled.print(line);
  } else {
    static const char *HEAD[4] = {"ALL CLEAR", "SELF-CARE", "ACT NOW", "MSG EARTH"};
    static const char *WHO[4] = {"nobody needs to act", "T1 you: self-care", "T2 crew medic acts", "T3 flight surgeon"};
    const Mission &m = MISSIONS[mission];
    if (!hasLink()) sprintf(line, "%-8s NO LINK", m.name);
    else { fmtClock(clk, roundTripS); sprintf(line, "%-8s RT %s", m.name, clk); }
    oled.print(line);
    oled.setTextSize(2);
    oled.setCursor(0, 11); oled.print(HEAD[tri.tier]);
    oled.setTextSize(1);
    oled.setCursor(0, 29); oled.print(WHO[tri.tier]);
    if (tri.worst >= 0) { fmtValue(v, tri.worst); sprintf(line, "%s %s %s", LIMITS[tri.worst].name, v, LIMITS[tri.worst].unit); }
    else {
      int faulty = -1;
      for (int i = 0; i < N_CH; i++) if (st[i] == ST_FAULT) faulty = i;
      if (faulty >= 0) sprintf(line, "CHECK SENSOR %s", LIMITS[faulty].name);
      else sprintf(line, "SpO2 %.0f HR %.0f RR %.0f", cur[CH_SPO2], cur[CH_HR], cur[CH_RR]);
    }
    oled.setCursor(0, 38); oled.print(line);
    linkText(line, big, detail, now);
    oled.setCursor(0, 47); oled.print(line);
    oled.setCursor(0, 56);
    oled.print(alert ? "[WATCH] ACKNOWLEDGE" : tri.tier >= 1 ? "[WATCH] BREATHE 1 MIN" : "[TAP] REACTION TEST");
  }
  oled.display();
}

// Ring: the report's trip to Earth and back, the outbox when there is no link, or the breath.
void ringUpdate(uint32_t now) {
  uint32_t px[16];
  for (int i = 0; i < 16; i++) px[i] = 0;
  int k = newestPacket();
  if (breathing) {
    int phase, secLeft;
    int n = (int)(16 * breatheLevel(now, &phase, &secLeft) + 0.5f);
    for (int i = 0; i < n; i++) px[i] = ring.Color(0, 70, 90);
  } else if (k >= 0) {
    const Packet &p = outbox[k];
    if (p.state == PK_QUEUED) {
      int n = countPackets(PK_QUEUED);
      if ((now / 500) % 2 == 0) for (int i = 0; i < n && i < 16; i++) px[i] = ring.Color(110, 50, 0);
    } else if (p.state == PK_DONE) {
      for (int i = 0; i < 16; i++) px[i] = ring.Color(0, 60, 0);
    } else {
      float f = p.legMs ? clampf((now - p.sentMs) / (2.0f * p.legMs), 0, 1) : 1;
      int n = (int)(f * 16);
      for (int i = 0; i < n; i++) px[i] = i < 8 ? ring.Color(0, 0, 110) : ring.Color(0, 80, 80);  // out, then back
      if (n < 16) px[n] = ring.Color(90, 90, 90);
    }
  }
  uint32_t h = 7;
  for (int i = 0; i < 16; i++) h = h * 31 + px[i];
  if (h == ringHash) return;
  ringHash = h;
  for (int i = 0; i < 16; i++) ring.setPixelColor(i, px[i]);
  ring.show();
}

// =====================================================================================
// 13. SERIAL
// =====================================================================================
float jv(int ch) { return isnan(cur[ch]) ? -1.0f : cur[ch]; }  // JSON has no NaN: a faulty channel prints -1

void printVitals(uint32_t now) {
  static const char *LINK[5] = {"idle", "queued", "uplink", "downlink", "replied"};
  char faults[48] = "";
  for (int i = 0; i < N_CH; i++) if (st[i] == ST_FAULT) { if (faults[0]) strcat(faults, ","); strcat(faults, LIMITS[i].name); }
  int k = newestPacket();
  float replyIn = (k >= 0 && (outbox[k].state == PK_UPLINK || outbox[k].state == PK_DOWNLINK)) ? replyInS(outbox[k], now) : -1;
  // v1 fields first, in the v1 order, so the existing feed reader keeps working
  Serial.printf("{\"t\":\"vitals\",\"scenario\":\"%s\",\"mission\":\"%s\",\"round_trip_s\":%.1f,"
                "\"spo2\":%.1f,\"hr\":%.0f,\"rr\":%.0f,\"sys\":%.0f,\"skin_c\":%.1f,\"co2_ppm\":%.0f,"
                "\"reaction_ms\":%.0f,\"tilt_deg\":%.1f,\"tier\":%d,\"acts\":\"%s\",\"worst\":\"%s\",\"source\":\"%s\",",
                SCENARIOS[scenario].name, MISSIONS[mission].name, roundTripS, jv(CH_SPO2), jv(CH_HR), jv(CH_RR), jv(CH_BP),
                jv(CH_SKIN), jv(CH_CO2), jv(CH_REACT), jv(CH_TILT), tri.tier, tri.acts,
                tri.worst >= 0 ? LIMITS[tri.worst].name : "", scenario == 0 ? "simulated_sensor" : "preset");
  Serial.printf("\"status\":[%d,%d,%d,%d,%d,%d,%d,%d],\"trend\":[%d,%d,%d,%d,%d,%d,%d,%d],\"news2_partial\":%d,\"forecast\":\"%s\",\"eta_red_s\":%.0f,"
                "\"sway_deg\":%.2f,\"link\":\"%s\",\"reply_in_s\":%.0f,\"queued\":%d,\"replies\":%lu,"
                "\"alarm\":%d,\"acked\":%d,\"breathing\":%d,\"faults\":\"%s\",\"mars_au\":%.2f,"
                "\"scenario_t_s\":%lu,\"met_s\":%lu,\"engine_us\":%lu}\n",
                st[0], st[1], st[2], st[3], st[4], st[5], st[6], st[7],
                trend[0], trend[1], trend[2], trend[3], trend[4], trend[5], trend[6], trend[7], news2,
                fc.ch >= 0 ? LIMITS[fc.ch].name : "", fc.ch >= 0 ? fc.etaS : -1.0f, swayDeg,
                LINK[k >= 0 ? outbox[k].state : 0], replyIn, countPackets(PK_QUEUED), (unsigned long)repliesRx,
                alarmOn ? 1 : 0, alarmAcked ? 1 : 0, breathing ? 1 : 0, faults, marsAu,
                (unsigned long)((now - scenarioStartMs) / 1000), (unsigned long)(now / 1000), (unsigned long)engineUs);
}

// =====================================================================================
// 14. CONTROL
// =====================================================================================
void nextMission() { mission = (mission + 1) % N_MISSIONS; missionChanged = true; forceSample = true; }

void nextScenario(uint32_t now) {  // a new episode: fresh baseline, empty outbox
  scenario = (scenario + 1) % N_SCENARIOS;
  scenarioStartMs = now;
  histCount = 0; tiltN = 0;
  for (int i = 0; i < N_CH; i++) { st[i] = ST_GREEN; trend[i] = 0; }
  for (int i = 0; i < OUTBOX_N; i++) outbox[i].state = PK_FREE;
  fc.ch = -1;
  forceSample = true;
}

bool takePress(int b, uint32_t *at) {  // true once per button press
  noInterrupts();
  uint32_t c = isrCount[b], a = isrAt[b];
  interrupts();
  if (c == btnSeen[b]) return false;
  btnSeen[b] = c;
  *at = a;
  return true;
}

void handleInputs(uint32_t now) {
  uint32_t at = 0, tapAt = 0;
  if (takePress(BTN_MISSION, &at)) nextMission();
  if (takePress(BTN_SCENARIO, &at)) nextScenario(now);
  if (takePress(BTN_WATCH, &at)) watchPressed(now);
  bool tap = takePress(BTN_TAP, &tapAt);
  reactionUpdate(now, tap, tapAt);
  while (Serial.available()) {
    int c = Serial.read();
    if (c == 'm') nextMission();
    else if (c == 's') nextScenario(now);
    else if (c == 'w') watchPressed(now);
    else if (c == 'f') {
      injectFault = !injectFault; forceSample = true;
      Serial.printf("{\"t\":\"fault\",\"channel\":\"SpO2\",\"injected\":%d}\n", injectFault ? 1 : 0);
    } else if (c == 'h' || c == '?')
      Serial.println("{\"t\":\"help\",\"keys\":\"m mission, s scenario, w watch button, f toggle SpO2 probe fault\"}");
  }
}

void sampleAndDecide(uint32_t now) {
  liveTilt = imuTilt();
  updateMarsDistance();
  roundTripS = currentRoundTrip();
  if (scenario == 0) liveVitals(cur);
  else scenarioVitals(scenario, (now - scenarioStartMs) / 1000.0f, cur);
  if (injectFault) cur[CH_SPO2] = NAN;  // pulse oximeter probe off
  updateSway();

  uint32_t t0 = micros();  // the on-board rules engine: score, then route
  for (int i = 0; i < N_CH; i++) st[i] = grade(i, cur[i], st[i]);
  Triage t = triage(st, roundTripS);
  news2 = news2Partial();
  engineUs = micros() - t0;

  bool tierChanged = t.tier != lastTier;
  tri = t;
  if (tierChanged || missionChanged) onDecision(t, tierChanged, now);
  lastTier = t.tier;
  missionChanged = false;
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < N_BTN; i++) pinMode(BTN_PINS[i], INPUT_PULLUP);
  int outs[] = {PIN_LED_PROMPT, PIN_LED_GREEN, PIN_LED_AMBER, PIN_LED_RED, PIN_BUZZER};
  for (int p : outs) { pinMode(p, OUTPUT); digitalWrite(p, LOW); }
  for (int i = 0; i < N_CH; i++) { cur[i] = BASELINE[i]; st[i] = ST_GREEN; trend[i] = 0; }
  for (int i = 0; i < N_FIELDS; i++) { fText[i][0] = 0; fFg[i] = 0; fBg[i] = 0; }
  for (int i = 0; i < OUTBOX_N; i++) outbox[i].state = PK_FREE;

  Wire.begin(21, 22);
  Wire.setClock(400000);
  if (!oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)) Serial.println("{\"t\":\"err\",\"msg\":\"oled\"}");
  imuInit();
  if (!imuOk) Serial.println("{\"t\":\"err\",\"msg\":\"imu\"}");
  dht.setup(PIN_DHT, DHTesp::DHT22);
  ring.begin();
  ring.show();
  tft.begin();
  tft.setRotation(TFT_ROTATION);
  tft.setTextWrap(false);
  tftStatic();

  attachInterrupt(digitalPinToInterrupt(PIN_BTN_MISSION), isrMission, FALLING);
  attachInterrupt(digitalPinToInterrupt(PIN_BTN_SCENARIO), isrScenario, FALLING);
  attachInterrupt(digitalPinToInterrupt(PIN_BTN_TAP), isrTap, FALLING);
  attachInterrupt(digitalPinToInterrupt(PIN_BTN_WATCH), isrWatch, FALLING);
  randomSeed(analogRead(PIN_SPO2) + micros());
  scenarioStartMs = millis();
  Serial.println("{\"t\":\"ready\",\"device\":\"farside-sim\",\"version\":2,\"channels\":8,\"note\":\"all physiological values are simulated\"}");
}

void loop() {
  static uint32_t lastSample = 0, lastSecond = 0, lastSlow = 0, lastTft = 0, lastLink = 0, lastOled = 0, lastRing = 0;
  uint32_t now = millis();

  handleInputs(now);
  if (now - lastSlow >= 2000) { lastSlow = now; readSlowSensors(); }
  if (forceSample || now - lastSample >= SAMPLE_MS) { lastSample = now; forceSample = false; sampleAndDecide(now); }
  linkUpdate(now);
  alarmUpdate(now);
  breathingUpdate(now);
  if (now - lastSecond >= 1000) { lastSecond = now; pushHistory(); updateTrends(); printVitals(now); }

  tftEcg(now);
  if (now - lastTft >= 250) { lastTft = now; tftHeader(now); tftTiles(); tftTierBox(); tftNewsAndForecast(); }
  if (now - lastLink >= 100) { lastLink = now; tftLink(now); }
  if (now - lastOled >= (uint32_t)(breathing ? 120 : 200)) { lastOled = now; drawWatch(now); }
  if (now - lastRing >= 100) { lastRing = now; ringUpdate(now); }
  delay(2);
}
