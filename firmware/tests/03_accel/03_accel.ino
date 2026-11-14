// Test 3: PmodACL accelerometer (ADXL345), no library needed.
// Expect: device id 0xE5, then |a| close to 1.00 g when still, higher when shaken.
// Open Tools -> Serial Plotter to see the line move.

#include <Wire.h>

uint8_t addr = 0;

void regWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

bool present(uint8_t a) {
  Wire.beginTransmission(a);
  return Wire.endTransmission() == 0;
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.setWireTimeout(25000, true);
  digitalWrite(SDA, LOW);  // 3.3 V part: no 5 V pull-ups
  digitalWrite(SCL, LOW);
  if (present(0x1D)) addr = 0x1D;
  else if (present(0x53)) addr = 0x53;
  else {
    Serial.println(F("PmodACL not found at 0x1D or 0x53. Run test 2 first."));
    while (true) {}
  }
  Wire.beginTransmission(addr);
  Wire.write(0x00);  // DEVID
  Wire.endTransmission(false);
  Wire.requestFrom((int)addr, 1);
  Serial.print(F("PmodACL at 0x"));
  Serial.print(addr, HEX);
  Serial.print(F(", device id 0x"));
  Serial.println(Wire.read(), HEX);

  regWrite(0x2C, 0x0A);  // 100 Hz
  regWrite(0x31, 0x08);  // full resolution, +-2 g, 256 counts per g
  regWrite(0x2D, 0x08);  // measure
  Serial.println(F("ax_g ay_g az_g mag_g"));
}

void loop() {
  Wire.beginTransmission(addr);
  Wire.write(0x32);
  Wire.endTransmission(false);
  if (Wire.requestFrom((int)addr, 6) != 6) {
    Serial.println(F("read failed"));
    delay(500);
    return;
  }
  float g[3];
  for (uint8_t i = 0; i < 3; i++) {
    uint8_t lo = Wire.read();
    uint8_t hi = Wire.read();
    g[i] = (int16_t)((hi << 8) | lo) / 256.0;
  }
  float mag = sqrt(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]);
  Serial.print(g[0], 3); Serial.print(' ');
  Serial.print(g[1], 3); Serial.print(' ');
  Serial.print(g[2], 3); Serial.print(' ');
  Serial.println(mag, 3);
  delay(50);
}
