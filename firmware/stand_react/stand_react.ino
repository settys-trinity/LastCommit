// FARSIDE check-in station: STAND-REACT firmware for Arduino Uno R3 (kit v2).
//
// Kit: PmodACL accelerometer (ADXL345), I2C OLED 128x64, touch module (tap pad),
//      button module (start), gas module (cabin air), 3 tier LEDs, optional vibration motor.
//
// Serial: 115200 baud, one line per message (docs/schemas.md section 3).
//   App to Uno:  START          begin a 60 s run
//                START:20       begin a run of 20 s (stage demo; 5 to 120 s)
//                TIER:n         n = 0 all off, 1 green, 2 amber, 3 red (+ vibration if fitted)
//                MSG:text       OLED text, up to 32 characters (16 per line)
//                PING           Uno answers {"t":"ready"}
//   Uno to app:  {"t":"rt","ms":312}        one reaction time
//                {"t":"sway","rms":0.0410}  sway at end of run, in g
//                {"t":"done"}               run finished (always last)
//                {"t":"button"}             start button pressed
//                {"t":"air","raw":312}      gas sensor 0..1023, every 5 s when idle
//                {"t":"ready"} {"t":"start"} {"t":"err","msg":"acl"} {"t":"err","msg":"oled"}
//
// Library: "U8g2" by oliver (Library Manager). The accelerometer is read directly over I2C.

#include <Wire.h>
#include <U8x8lib.h>

// ---- Pins ----
const uint8_t PIN_TOUCH = 2;    // touch module OUT (HIGH when touched)
const uint8_t PIN_BUTTON = 4;   // button module OUT
const uint8_t PIN_GREEN = 5;    // tier 1
const uint8_t PIN_AMBER = 6;    // tier 2
const uint8_t PIN_RED = 7;      // tier 3
const uint8_t PIN_VIBE = 8;     // vibration MOTOR module IN (leave unwired if yours is a sensor)
const uint8_t PIN_GAS = A0;     // gas module AO

// ---- Settings ----
const bool HAS_VIBE_MOTOR = false;          // set true only if the vibration module is a motor
const unsigned long TAP_REFRACTORY_MS = 150;
const unsigned long RT_MIN_MS = 100;        // faster = anticipation, ignored
const unsigned long RT_TIMEOUT_MS = 2000;   // no tap: sent as 2000 ms, counts as a lapse
const unsigned long ISI_MIN_MS = 1500;      // random gap before each prompt
const unsigned long ISI_MAX_MS = 4000;
const unsigned long ACL_PERIOD_MS = 10;     // 100 Hz
const unsigned long AIR_PERIOD_MS = 5000;

// OLED: most 0.96" boards are SSD1306. For a 1.3" SH1106 board, swap the line below for:
// U8X8_SH1106_128X64_NONAME_HW_I2C oled(U8X8_PIN_NONE);
U8X8_SSD1306_128X64_NONAME_HW_I2C oled(U8X8_PIN_NONE);
bool oledOk = false;

uint8_t aclAddr = 0;  // 0x1D or 0x53, found at boot

enum State { IDLE, WAITING, STIMULUS };
State state = IDLE;
unsigned long testEnd = 0, nextStimulus = 0, stimulusAt = 0, lastTap = 0, lastAcl = 0, lastAir = 0;
bool touchWas = false, buttonWas = false, buttonIdle = LOW;

// Sway: running mean and variance of acceleration magnitude (Welford).
// The run's mean magnitude is the gravity estimate, which also cancels sensor offset.
unsigned long swayN = 0;
float swayMean = 0, swayM2 = 0;

char lineBuf[40];
uint8_t lineLen = 0;
char lastMsg[33] = "";  // last MSG text, shown again when a run ends (the app re-sends only on change)

// ---------- I2C helpers ----------
bool present(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

void regWrite(uint8_t addr, uint8_t reg, uint8_t val) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

// ---------- Accelerometer (ADXL345 on the PmodACL) ----------
bool aclBegin() {
  if (present(0x1D)) aclAddr = 0x1D;
  else if (present(0x53)) aclAddr = 0x53;
  else return false;
  regWrite(aclAddr, 0x2C, 0x0A);  // 100 Hz output rate
  regWrite(aclAddr, 0x31, 0x08);  // full resolution, +-2 g: 256 counts per g
  regWrite(aclAddr, 0x2D, 0x08);  // start measuring
  return true;
}

bool aclMagnitudeG(float &mag) {
  Wire.beginTransmission(aclAddr);
  Wire.write(0x32);  // DATAX0
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((int)aclAddr, 6) != 6) return false;
  int16_t v[3];
  for (uint8_t i = 0; i < 3; i++) {
    uint8_t lo = Wire.read();
    uint8_t hi = Wire.read();
    v[i] = (int16_t)((hi << 8) | lo);
  }
  float x = v[0] / 256.0, y = v[1] / 256.0, z = v[2] / 256.0;
  mag = sqrt(x * x + y * y + z * z);
  return true;
}

void sampleAcl() {
  float m;
  if (!aclMagnitudeG(m)) return;
  swayN++;
  float delta = m - swayMean;
  swayMean += delta / swayN;
  swayM2 += delta * (m - swayMean);
}

// ---------- OLED (16 columns x 8 rows of text) ----------
void oledLines(const char *a, const char *b) {
  if (!oledOk) return;
  oled.clearDisplay();
  oled.drawString(0, 2, a);
  oled.drawString(0, 4, b);
}

void showMsg(const char *text) {
  strncpy(lastMsg, text, 32);
  lastMsg[32] = '\0';
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
  oledLines(l1, l2);
}

void promptOn() {
  if (oledOk) oled.draw2x2String(0, 3, "  TAP!  ");
}

void promptOff() {
  if (oledOk) oled.draw2x2String(0, 3, "        ");
}

// ---------- Outputs ----------
void setTier(int n) {
  digitalWrite(PIN_GREEN, n == 1 ? HIGH : LOW);
  digitalWrite(PIN_AMBER, n == 2 ? HIGH : LOW);
  digitalWrite(PIN_RED, n == 3 ? HIGH : LOW);
  if (HAS_VIBE_MOTOR && n == 3) {
    for (uint8_t i = 0; i < 3; i++) {
      digitalWrite(PIN_VIBE, HIGH);
      delay(250);
      digitalWrite(PIN_VIBE, LOW);
      delay(150);
    }
  }
}

void sendAir() {
  Serial.print(F("{\"t\":\"air\",\"raw\":"));
  Serial.print(analogRead(PIN_GAS));
  Serial.println('}');
}

// ---------- Test ----------
void startTest(int seconds) {
  if (state != IDLE) return;
  if (seconds < 5) seconds = 5;
  if (seconds > 120) seconds = 120;
  // Keep the tier LEDs as they are: the app only re-sends TIER when the tier changes (C7).
  swayN = 0;
  swayMean = 0;
  swayM2 = 0;
  if (oledOk) {  // rows 0 and 7, so the TAP! prompt (rows 3-4) never covers them
    oled.clearDisplay();
    oled.drawString(0, 0, "STAND-REACT");
    oled.drawString(0, 7, "Tap when TAP!");
  }
  unsigned long now = millis();
  testEnd = now + (unsigned long)seconds * 1000UL;
  nextStimulus = now + random(ISI_MIN_MS, ISI_MAX_MS + 1);
  lastAcl = now;
  state = WAITING;
  Serial.println(F("{\"t\":\"start\"}"));
}

void endStimulus(unsigned long rt) {
  promptOff();
  Serial.print(F("{\"t\":\"rt\",\"ms\":"));
  Serial.print(rt);
  Serial.println('}');
  nextStimulus = millis() + random(ISI_MIN_MS, ISI_MAX_MS + 1);
  state = WAITING;
}

void finishTest() {
  promptOff();
  state = IDLE;
  if (aclAddr && swayN > 1) {
    float rms = sqrt(swayM2 / swayN);
    Serial.print(F("{\"t\":\"sway\",\"rms\":"));
    Serial.print(rms, 4);
    Serial.println('}');
  }
  sendAir();
  Serial.println(F("{\"t\":\"done\"}"));
  if (lastMsg[0]) {
    char saved[33];
    strncpy(saved, lastMsg, 33);
    showMsg(saved);  // the app's current message; it updates again if the tier changes
  } else {
    oledLines("Test done", "Wait for result");
  }
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
  pinMode(PIN_TOUCH, INPUT);
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_GREEN, OUTPUT);
  pinMode(PIN_AMBER, OUTPUT);
  pinMode(PIN_RED, OUTPUT);
  if (HAS_VIBE_MOTOR) pinMode(PIN_VIBE, OUTPUT);

  Wire.begin();
  oledOk = present(0x3C) || present(0x3D);
  if (oledOk) {
    oled.setBusClock(400000);
    oled.begin();
    oled.setFont(u8x8_font_chroma48medium8_r);
  }
  Wire.setWireTimeout(25000, true);  // never hang the station on a bad I2C wire
  // The PmodACL runs on 3.3 V: switch off the Uno's internal 5 V pull-ups on SDA and SCL.
  // The bus is then pulled up by the OLED board, which is powered from 3.3 V.
  digitalWrite(SDA, LOW);
  digitalWrite(SCL, LOW);

  bool aclOk = aclBegin();
  randomSeed(analogRead(A1));  // A1 left unconnected = noise
  buttonIdle = digitalRead(PIN_BUTTON);  // works for active-high and active-low buttons
  buttonWas = buttonIdle;

  oledLines("FARSIDE", aclOk ? "Ready" : "ACL ERROR");
  if (!aclOk) Serial.println(F("{\"t\":\"err\",\"msg\":\"acl\"}"));
  if (!oledOk) Serial.println(F("{\"t\":\"err\",\"msg\":\"oled\"}"));
  Serial.println(F("{\"t\":\"ready\"}"));
}

void loop() {
  readSerial();
  unsigned long now = millis();

  // Start button: report a press (edge away from the idle level).
  bool button = digitalRead(PIN_BUTTON);
  if (button != buttonIdle && buttonWas == buttonIdle && state == IDLE) {
    Serial.println(F("{\"t\":\"button\"}"));
    delay(30);  // debounce
  }
  buttonWas = button;

  if (state == IDLE) {
    if (now - lastAir >= AIR_PERIOD_MS) {
      lastAir = now;
      sendAir();
    }
    return;
  }

  if (aclAddr && now - lastAcl >= ACL_PERIOD_MS) {
    lastAcl = (now - lastAcl > 50) ? now : lastAcl + ACL_PERIOD_MS;  // resync if behind
    sampleAcl();
  }

  // Tap = rising edge on the touch module.
  bool touch = digitalRead(PIN_TOUCH) == HIGH;
  bool tap = touch && !touchWas && now - lastTap > TAP_REFRACTORY_MS;
  touchWas = touch;
  if (tap) lastTap = now;

  if (state == WAITING) {
    if (now >= testEnd) {
      finishTest();
      return;
    }
    if (now >= nextStimulus && !touch) {  // never prompt while a finger is already down
      promptOn();
      stimulusAt = millis();  // after the prompt is on screen
      state = STIMULUS;
    }
  } else if (state == STIMULUS) {
    unsigned long rt = now - stimulusAt;
    if (tap && rt >= RT_MIN_MS) endStimulus(rt);
    else if (rt >= RT_TIMEOUT_MS) endStimulus(RT_TIMEOUT_MS);
  }
}
