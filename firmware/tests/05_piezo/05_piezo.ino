// Test 5: piezo tap threshold.
// Prints the highest A0 value every 100 ms.
// 1. Leave the pad alone: note the resting values (usually under 20).
// 2. Tap it like in the test: note the peak values.
// 3. Pick a threshold about halfway between the two and set TAP_THRESHOLD in stand_react.ino.
// Open Tools -> Serial Plotter to see taps as spikes.

const uint8_t PIN_PIEZO = A0;

void setup() {
  Serial.begin(115200);
  Serial.println(F("piezo_peak"));
}

void loop() {
  int peak = 0;
  unsigned long until = millis() + 100;
  while (millis() < until) {
    int v = analogRead(PIN_PIEZO);
    if (v > peak) peak = v;
  }
  Serial.println(peak);
}
