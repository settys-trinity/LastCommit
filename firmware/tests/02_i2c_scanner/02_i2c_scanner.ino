// Test 2: I2C scanner.
// Expect: "Found 0x68" (MPU6050 IMU) and "Found 0x27" or "Found 0x3F" (LCD adapter).
// Nothing found: check SDA -> A4, SCL -> A5, VCC -> 5V and GND on both modules.

#include <Wire.h>

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Serial.println(F("Test 2: I2C scanner"));
}

void loop() {
  uint8_t found = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print(F("Found 0x"));
      if (addr < 16) Serial.print('0');
      Serial.print(addr, HEX);
      if (addr == 0x68) Serial.print(F("  <- IMU (MPU6050)"));
      if (addr == 0x27 || addr == 0x3F) Serial.print(F("  <- LCD adapter"));
      Serial.println();
      found++;
    }
  }
  if (found == 0) Serial.println(F("No I2C devices found. Check wiring."));
  Serial.println(F("---"));
  delay(3000);
}
