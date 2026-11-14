// Test 4: LCD.
// Needs library: "LiquidCrystal I2C" by Frank de Brabander (Library Manager).
// Expect: "FARSIDE" on line 1 and a counting number on line 2.
// Blank screen but backlight on: turn the small blue potentiometer on the back of the adapter.

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C *lcd = nullptr;

uint8_t findLcd() {
  const uint8_t candidates[] = {0x27, 0x3F};
  for (uint8_t i = 0; i < 2; i++) {
    Wire.beginTransmission(candidates[i]);
    if (Wire.endTransmission() == 0) return candidates[i];
  }
  return 0;
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  uint8_t addr = findLcd();
  if (addr == 0) {
    Serial.println(F("No LCD at 0x27 or 0x3F. Run test 2 first."));
    while (true) {}
  }
  Serial.print(F("LCD at 0x"));
  Serial.println(addr, HEX);
  lcd = new LiquidCrystal_I2C(addr, 16, 2);
  lcd->init();
  lcd->backlight();
  lcd->setCursor(0, 0);
  lcd->print(F("FARSIDE"));
}

void loop() {
  static unsigned int n = 0;
  lcd->setCursor(0, 1);
  lcd->print(F("count "));
  lcd->print(n++);
  delay(1000);
}
