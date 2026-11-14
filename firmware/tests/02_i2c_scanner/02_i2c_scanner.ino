// Test 2: I2C scanner.
// Expect: "Found 0x3C" (OLED) and "Found 0x1D" or "Found 0x53" (PmodACL).
// Nothing found: check SDA -> A4, SCL -> A5, and that the OLED and PmodACL are on 3.3V and GND.

#include <Wire.h>

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.setWireTimeout(25000, true);
  // PmodACL is a 3.3 V part: switch off the Uno's 5 V pull-ups (the OLED board pulls up to 3.3 V).
  digitalWrite(SDA, LOW);
  digitalWrite(SCL, LOW);
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
      if (addr == 0x3C || addr == 0x3D) Serial.print(F("  <- OLED"));
      if (addr == 0x1D || addr == 0x53) Serial.print(F("  <- PmodACL accelerometer"));
      Serial.println();
      found++;
    }
  }
  if (found == 0) Serial.println(F("No I2C devices found. Check wiring."));
  Serial.println(F("---"));
  delay(3000);
}
