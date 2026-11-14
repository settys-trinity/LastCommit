// FARSIDE check-in station: STAND-REACT firmware for Arduino Uno.
//
// Serial: 115200 baud, one line per message (docs/schemas.md section 3).
//   App to Uno:  START          begin a 60 s run
//                START:20       begin a run of 20 s (stage demo; 5 to 120 s)
//                TIER:n         n = 0 all off, 1 green, 2 amber, 3 red plus buzzer
//                MSG:text       LCD text, up to 32 characters (16 per line)
//                PING           Uno answers {"t":"ready"}
//   Uno to app:  {"t":"rt","ms":312}       one reaction time
//                {"t":"sway","rms":0.0410} sway at end of run, in g
//                {"t":"done"}              run finished (always sent last)
//                {"t":"ready"} {"t":"start"} {"t":"err","msg":"imu"}   status lines
//
// Needs library: "LiquidCrystal I2C" by Frank de Brabander. The IMU is read
// directly over I2C, so no IMU library is needed.

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ---- Pins (plan pin diagram) ----
const uint8_t PIN_WHITE = 3;    // reaction prompt
const uint8_t PIN_GREEN = 5;    // tier 1
const uint8_t PIN_AMBER = 6;    // tier 2
const uint8_t PIN_RED = 7;      // tier 3
const uint8_t PIN_BUZZER = 8;   // tier 3 alert
const uint8_t PIN_PIEZO = A0;   // tap pad, 1 MOhm across the disc
const uint8_t MPU_ADDR = 0x68;

// ---- Tuning ----
const int TAP_THRESHOLD = 100;              // set from tests/05_piezo
const unsigned long TAP_REFRACTORY_MS = 200; // ignore ringing after a tap
const unsigned long RT_MIN_MS = 100;        // faster than this = anticipation, ignored
const unsigned long RT_TIMEOUT_MS = 2000;   // no tap: reported as 2000 ms, counts as a lapse
const unsigned long ISI_MIN_MS = 1500;      // random gap before each light
const unsigned long ISI_MAX_MS = 4000;
const unsigned long IMU_PERIOD_MS = 10;     // 100 Hz

LiquidCrystal_I2C *lcd = nullptr;
bool imuOk = false;

enum State { IDLE, WAITING, STIMULUS };
State state = IDLE;
unsigned long testEnd = 0, nextStimulus = 0, stimulusAt = 0, lastTap = 0, lastImu = 0;

// Sway: running mean and variance of acceleration magnitude (Welford).
// The run's mean magnitude is the gravity estimate, which also cancels sensor offset.
unsigned long swayN = 0;
float swayMean = 0, swayM2 = 0;

char lineBuf[40];
uint8_t lineLen = 0;

// ---------- IMU ----------
void imuWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

bool imuBegin() {
  Wire.beginTransmission(MPU_ADDR);
  if (Wire.endTransmission() != 0) return false;
  imuWrite(0x6B, 0x00);  // wake up
  imuWrite(0x1C, 0x00);  // +-2 g, 16384 counts per g
  imuWrite(0x1A, 0x03);  // low-pass about 44 Hz
  return true;
}

int16_t read16() {
  uint8_t hi = Wire.read();
  uint8_t lo = Wire.read();
  return (int16_t)((hi << 8) | lo);
}

bool imuMagnitudeG(float &mag) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((int)MPU_ADDR, 6) != 6) return false;
  float x = read16() / 16384.0;
  float y = read16() / 16384.0;
  float z = read16() / 16384.0;
  mag = sqrt(x * x + y * y + z * z);
  return true;
}

void sampleImu() {
  float m;
  if (!imuMagnitudeG(m)) return;
  swayN++;
  float delta = m - swayMean;
  swayMean += delta / swayN;
  swayM2 += delta * (m - swayMean);
}

// ---------- LCD ----------
uint8_t findLcd() {
  const uint8_t candidates[] = {0x27, 0x3F};
  for (uint8_t i = 0; i < 2; i++) {
    Wire.beginTransmission(candidates[i]);
    if (Wire.endTransmission() == 0) return candidates[i];
  }
  return 0;
}

void lcdShow(const char *line1, const char *line2) {
  if (!lcd) return;
  lcd->clear();
  lcd->setCursor(0, 0);
  lcd->print(line1);
  lcd->setCursor(0, 1);
  lcd->print(line2);
}

void showMsg(const char *text) {
  char l1[17], l2[17];
  size_t len = strlen(text);
  strncpy(l1, text, 16);
  l1[16] = '\0';
  if (len > 16) {
    strncpy(l2, text + 16, 16);
    l2[16] = '\0';
  } else {
    l2[0] = '\0';
  }
  lcdShow(l1, l2);
}

// ---------- Outputs ----------
void setTier(int n) {
  digitalWrite(PIN_GREEN, n == 1 ? HIGH : LOW);
  digitalWrite(PIN_AMBER, n == 2 ? HIGH : LOW);
  digitalWrite(PIN_RED, n == 3 ? HIGH : LOW);
  digitalWrite(PIN_BUZZER, LOW);
  if (n == 3) {
    for (uint8_t i = 0; i < 3; i++) {
      digitalWrite(PIN_BUZZER, HIGH);
      delay(150);
      digitalWrite(PIN_BUZZER, LOW);
      delay(100);
    }
  }
}

// ---------- Test ----------
void startTest(int seconds) {
  if (state != IDLE) return;
  if (seconds < 5) seconds = 5;
  if (seconds > 120) seconds = 120;
  setTier(0);
  swayN = 0;
  swayMean = 0;
  swayM2 = 0;
  unsigned long now = millis();
  testEnd = now + (unsigned long)seconds * 1000UL;
  nextStimulus = now + random(ISI_MIN_MS, ISI_MAX_MS + 1);
  lastImu = now;
  state = WAITING;
  lcdShow("STAND-REACT", "Tap on the light");
  Serial.println(F("{\"t\":\"start\"}"));
}

void endStimulus(unsigned long rt) {
  digitalWrite(PIN_WHITE, LOW);
  Serial.print(F("{\"t\":\"rt\",\"ms\":"));
  Serial.print(rt);
  Serial.println('}');
  nextStimulus = millis() + random(ISI_MIN_MS, ISI_MAX_MS + 1);
  state = WAITING;
}

void finishTest() {
  digitalWrite(PIN_WHITE, LOW);
  state = IDLE;
  if (imuOk && swayN > 1) {
    float rms = sqrt(swayM2 / swayN);
    Serial.print(F("{\"t\":\"sway\",\"rms\":"));
    Serial.print(rms, 4);
    Serial.println('}');
  }
  Serial.println(F("{\"t\":\"done\"}"));
  lcdShow("Test done", "Wait for result");
}

// ---------- Serial ----------
void handleLine(char *s) {
  if (strcmp(s, "START") == 0) startTest(60);
  else if (strncmp(s, "START:", 6) == 0) startTest(atoi(s + 6));
  else if (strncmp(s, "TIER:", 5) == 0) setTier(atoi(s + 5));
  else if (strncmp(s, "MSG:", 4) == 0) showMsg(s + 4);
  else if (strcmp(s, "PING") == 0) Serial.println(F("{\"t\":\"ready\"}"));
}

void readSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      lineBuf[lineLen] = '\0';
      handleLine(lineBuf);
      lineLen = 0;
    } else if (lineLen < sizeof(lineBuf) - 1) {
      lineBuf[lineLen++] = c;
    }
  }
}

// ---------- Main ----------
void setup() {
  Serial.begin(115200);
  pinMode(PIN_WHITE, OUTPUT);
  pinMode(PIN_GREEN, OUTPUT);
  pinMode(PIN_AMBER, OUTPUT);
  pinMode(PIN_RED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  Wire.begin();

  uint8_t addr = findLcd();
  if (addr) {
    lcd = new LiquidCrystal_I2C(addr, 16, 2);
    lcd->init();
    lcd->backlight();
  }
  imuOk = imuBegin();
  randomSeed(analogRead(A1));  // A1 left unconnected = noise

  lcdShow("FARSIDE", imuOk ? "Ready" : "IMU ERROR");
  if (!imuOk) Serial.println(F("{\"t\":\"err\",\"msg\":\"imu\"}"));
  Serial.println(F("{\"t\":\"ready\"}"));
}

void loop() {
  readSerial();
  if (state == IDLE) return;

  unsigned long now = millis();

  if (imuOk && now - lastImu >= IMU_PERIOD_MS) {
    lastImu = (now - lastImu > 50) ? now : lastImu + IMU_PERIOD_MS;  // resync if we fell behind
    sampleImu();
  }

  bool tap = false;
  if (now - lastTap > TAP_REFRACTORY_MS && analogRead(PIN_PIEZO) > TAP_THRESHOLD) {
    tap = true;
    lastTap = now;
  }

  if (state == WAITING) {
    if (now >= testEnd) {
      finishTest();
      return;
    }
    if (now >= nextStimulus) {
      digitalWrite(PIN_WHITE, HIGH);
      stimulusAt = now;
      state = STIMULUS;
    }
    // Taps while the light is off are false starts and are ignored.
  } else if (state == STIMULUS) {
    unsigned long rt = now - stimulusAt;
    if (tap && rt >= RT_MIN_MS) endStimulus(rt);
    else if (rt >= RT_TIMEOUT_MS) endStimulus(RT_TIMEOUT_MS);
  }
}
