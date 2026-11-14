// Test 3: IMU raw read, no library needed (works with MPU6050 and most clones).
// Expect: |a| close to 1.00 g when the board lies still. It rises when you shake it.
// Open Tools -> Serial Plotter to see the line move.

#include <Wire.h>

const uint8_t MPU_ADDR = 0x68;

void writeReg(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

int16_t read16() {
  uint8_t hi = Wire.read();
  uint8_t lo = Wire.read();
  return (int16_t)((hi << 8) | lo);
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.beginTransmission(MPU_ADDR);
  if (Wire.endTransmission() != 0) {
    Serial.println(F("IMU not found at 0x68. Run test 2 first."));
    while (true) {}
  }
  writeReg(0x6B, 0x00);  // wake up
  writeReg(0x1C, 0x00);  // accelerometer range +-2 g (16384 counts per g)
  writeReg(0x1A, 0x03);  // low-pass filter about 44 Hz
  Serial.println(F("ax_g ay_g az_g mag_g"));
}

void loop() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);  // first accelerometer register
  Wire.endTransmission(false);
  if (Wire.requestFrom((int)MPU_ADDR, 6) != 6) {
    Serial.println(F("read failed"));
    delay(500);
    return;
  }
  float x = read16() / 16384.0;
  float y = read16() / 16384.0;
  float z = read16() / 16384.0;
  float mag = sqrt(x * x + y * y + z * z);
  Serial.print(x, 3); Serial.print(' ');
  Serial.print(y, 3); Serial.print(' ');
  Serial.print(z, 3); Serial.print(' ');
  Serial.println(mag, 3);
  delay(50);
}
