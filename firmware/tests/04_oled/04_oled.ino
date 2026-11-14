// Test 4: OLED.
// Needs library: "U8g2" by oliver (Library Manager).
// Expect: "FARSIDE" at the top, a counter, and a big "TAP!" flashing.
// Garbled or shifted picture: your board is probably an SH1106 (common on 1.3" screens).
// Swap the constructor line for the SH1106 one below and upload again.

#include <Wire.h>
#include <U8x8lib.h>

U8X8_SSD1306_128X64_NONAME_HW_I2C oled(U8X8_PIN_NONE);
// U8X8_SH1106_128X64_NONAME_HW_I2C oled(U8X8_PIN_NONE);

void setup() {
  Serial.begin(115200);
  oled.setBusClock(400000);
  oled.begin();
  digitalWrite(SDA, LOW);  // 3.3 V bus: no 5 V pull-ups
  digitalWrite(SCL, LOW);
  oled.setFont(u8x8_font_chroma48medium8_r);
  oled.drawString(0, 0, "FARSIDE");
  Serial.println(F("Test 4: OLED. Look at the screen."));
}

void loop() {
  static unsigned int n = 0;
  static bool on = false;
  char buf[17];
  snprintf(buf, sizeof(buf), "count %u", n++);
  oled.drawString(0, 7, buf);
  on = !on;
  oled.draw2x2String(0, 3, on ? "  TAP!  " : "        ");
  delay(700);
}
