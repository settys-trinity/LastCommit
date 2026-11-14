// Test 1: LEDs and buzzer.
// Expect: white, green, amber, red light one after another, then 3 short beeps. Repeats.
// If an LED stays dark, it is probably in backwards (long leg goes to the resistor side).

const uint8_t PIN_WHITE = 3;
const uint8_t PIN_GREEN = 5;
const uint8_t PIN_AMBER = 6;
const uint8_t PIN_RED = 7;
const uint8_t PIN_BUZZER = 8;

const uint8_t LEDS[] = {PIN_WHITE, PIN_GREEN, PIN_AMBER, PIN_RED};
const char *NAMES[] = {"white (D3)", "green (D5)", "amber (D6)", "red (D7)"};

void setup() {
  Serial.begin(115200);
  for (uint8_t i = 0; i < 4; i++) pinMode(LEDS[i], OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  Serial.println(F("Test 1: LEDs and buzzer"));
}

void loop() {
  for (uint8_t i = 0; i < 4; i++) {
    Serial.print(F("LED on: "));
    Serial.println(NAMES[i]);
    digitalWrite(LEDS[i], HIGH);
    delay(700);
    digitalWrite(LEDS[i], LOW);
  }
  Serial.println(F("Buzzer (D8): 3 beeps"));
  for (uint8_t i = 0; i < 3; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(150);
    digitalWrite(PIN_BUZZER, LOW);
    delay(150);
  }
  delay(1000);
}
