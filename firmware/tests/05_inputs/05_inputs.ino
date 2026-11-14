// Test 5: touch pad, button and gas sensor.
// Prints one line every 200 ms: touch (0/1), button (0/1), gas (0..1023).
// Expect:
//   touch goes 1 while your finger is on the pad
//   button changes while pressed (some modules read 1 at rest and 0 when pressed: that is fine)
//   gas settles after a few minutes of warm-up, then rises when you breathe on it
// Open Tools -> Serial Plotter to see all three.

const uint8_t PIN_TOUCH = 2;
const uint8_t PIN_BUTTON = 4;
const uint8_t PIN_GAS = A0;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_TOUCH, INPUT);
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  Serial.println(F("touch button gas"));
}

void loop() {
  Serial.print(digitalRead(PIN_TOUCH));
  Serial.print(' ');
  Serial.print(digitalRead(PIN_BUTTON));
  Serial.print(' ');
  Serial.println(analogRead(PIN_GAS));
  delay(200);
}
