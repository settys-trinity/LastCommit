// Test 1: tier LEDs (and vibration motor, if yours is a motor).
// Expect: D5, D6, D7 light one after another. Repeats.
// An LED stays dark: it is probably in backwards (long leg goes to the resistor side).

const uint8_t LEDS[] = {5, 6, 7};
const char *NAMES[] = {"D5 (tier 1, green)", "D6 (tier 2, amber)", "D7 (tier 3, red)"};

const bool HAS_VIBE_MOTOR = false;  // set true only if the vibration module is a motor on D8
const uint8_t PIN_VIBE = 8;

void setup() {
  Serial.begin(115200);
  for (uint8_t i = 0; i < 3; i++) pinMode(LEDS[i], OUTPUT);
  if (HAS_VIBE_MOTOR) pinMode(PIN_VIBE, OUTPUT);
  Serial.println(F("Test 1: LEDs"));
}

void loop() {
  for (uint8_t i = 0; i < 3; i++) {
    Serial.print(F("LED on: "));
    Serial.println(NAMES[i]);
    digitalWrite(LEDS[i], HIGH);
    delay(700);
    digitalWrite(LEDS[i], LOW);
  }
  if (HAS_VIBE_MOTOR) {
    Serial.println(F("Vibration motor on D8"));
    digitalWrite(PIN_VIBE, HIGH);
    delay(400);
    digitalWrite(PIN_VIBE, LOW);
  }
  delay(800);
}
