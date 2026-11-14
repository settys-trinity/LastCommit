# Decisions

## 2026-11-14: Mars "crew acts now" LED

Mars crew-acts-now shows the amber LED (Tier 2), per the plan tier table. The older red plus buzzer script is superseded.

## 2026-11-14: No buzzer

The kit has no buzzer. Tier 3 is the red LED, plus vibration only if the vibration module turns out to be a motor (`HAS_VIBE_MOTOR` in `firmware/stand_react/stand_react.ino`).

## 2026-11-14: Cabin air is environment, not a crew reading

The gas sensor goes on the stream as its own kind `cabin_air`, like DONKI. Its value is an uncalibrated 0 to 1023 index, shown only as change from the session's own baseline (`docs/schemas.md`, Stream envelope).
