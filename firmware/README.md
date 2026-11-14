# FARSIDE hardware: check-in station (kit v2)

The station runs the STAND-REACT test on an Arduino Uno R3 and talks to the app through `bridge/serial_bridge.py`.
Serial format: `docs/schemas.md` section 3, plus the additions listed at the end of this file.

## The kit and what each part does

| Part | Job |
|---|---|
| Arduino Uno R3 | Runs everything |
| PmodACL (ADXL345 accelerometer) | Sway, worn at the sternum |
| OLED 128x64 (I2C) | The "TAP!" prompt and all text |
| Touch module | Tap pad for reaction times |
| Button module | Starts a run from the station |
| Gas module | Cabin air index (hostile closed environment hazard) |
| 3 LEDs + 3 × 220 Ω | Tier 1, 2, 3 |
| Vibration module | Tier 3 alert, **only if it is a motor** (see below) |
| 1 MΩ resistors | Not needed |

**Vibration module:** a motor module has a small flat disc or cylinder motor. A sensor module (often SW-420) has a metal spring can and a blue potentiometer. Wire it to D8 and set `HAS_VIBE_MOTOR = true` only if it is a motor. A sensor is not used.

## 1. Install (Windows)

1. Arduino IDE 2.
2. Library Manager: install **U8g2** by oliver (for the OLED). The accelerometer needs no library.
3. **Tools → Board → Arduino Uno** and the right **Port**.
4. Python packages for the bridge, from the repo root:
   ```powershell
   python -m venv .venv
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
   .\.venv\Scripts\Activate.ps1
   pip install -r bridge\requirements.txt
   ```

## 2. Wiring

**The PmodACL is a 3.3 V part. Never connect its VCC to 5V.** Power the OLED from 3.3V as well: its pull-up resistors then hold the I2C bus at 3.3 V, and the firmware switches off the Uno's own 5 V pull-ups.

| Part | Pin on the part | Goes to |
|---|---|---|
| PmodACL, header **J2** (the 2×4 I2C header) | SCL | **A5** |
| | SDA | **A4** |
| | GND | GND |
| | VCC | **3.3V** |
| OLED | GND | GND |
| | VCC | **3.3V** |
| | SCL | **A5** |
| | SDA | **A4** |
| Touch module | VCC / GND / I/O (or SIG) | 5V / GND / **D2** |
| Button module | VCC / GND / OUT (or S) | 5V / GND / **D4** |
| Gas module | VCC / GND / **AO** | 5V / GND / **A0** (DO unused) |
| LED tier 1 | D5 → 220 Ω → long leg; short leg → GND | **D5** |
| LED tier 2 | D6 → 220 Ω → long leg; short leg → GND | **D6** |
| LED tier 3 | D7 → 220 Ω → long leg; short leg → GND | **D7** |
| Vibration motor (if motor) | VCC / GND / IN | 5V / GND / **D8** |

- Use the Pmod's **J2** header (2×4 pins), not the 12-pin J1 header. Along J2 the order is SCL, SDA, GND, VCC, and the two rows carry the same signals, so use either row. Manual revisions number these pins differently: go by the labels printed on the board beside J2.
- If your 3 LEDs are all one colour, that is fine: position on the board shows the tier, and the app shows the colour.
- Wear the PmodACL on a lanyard at the sternum. Hold the touch pad in one hand, so tapping does not shake the accelerometer.

## 3. Test each module (in order)

Upload each sketch, open **Tools → Serial Monitor** at **115200 baud**, and check before moving on.
Wire the OLED before tests 2 and 3: its pull-ups are what keep the I2C bus working.

| Sketch | Expect | If not |
|---|---|---|
| `01_leds` | D5, D6, D7 light in turn | LED backwards (long leg to the resistor side) |
| `02_i2c_scanner` | `Found 0x3C` (OLED) and `Found 0x1D` or `0x53` (PmodACL) | Check A4/A5, 3.3V and GND. Nothing at all: OLED not powered (no pull-ups) |
| `03_accel` | `device id 0xE5`, then last column near `1.000` when still | Not found: J2 wiring, or VCC not on 3.3V |
| `04_oled` | `FARSIDE`, a counter, a flashing `TAP!` | Garbled screen: SH1106 board, swap the constructor line (comment in the sketch) |
| `05_inputs` | touch 1 while touched; button changes when pressed; gas a number that rises when you breathe on it | Touch never 1: check I/O on D2. Gas 0 or 1023: AO not on A0 |

The gas sensor needs a few minutes powered on before its readings settle. Power it early.

## 4. Upload the station firmware

1. Open `firmware/stand_react/stand_react.ino`. If test 4 needed SH1106, swap the constructor line here too. If the vibration module is a motor, set `HAS_VIBE_MOTOR = true`.
2. Upload. The OLED shows `FARSIDE / Ready` (or `ACL ERROR`).
3. In the Serial Monitor (115200, line ending **Newline**) you see an `air` line every 5 s. Type each line and press Enter:

| Type | Expect |
|---|---|
| `PING` | `{"t":"ready"}` |
| `START:20` | `{"t":"start"}`; big `TAP!` appears at random; touch → `{"t":"rt","ms":…}`; after 20 s `sway`, `air`, then `{"t":"done"}` |
| press the button | `{"t":"button"}` |
| `TIER:1` / `TIER:2` / `TIER:3` | LED on D5 / D6 / D7 (and the motor on tier 3) |
| `TIER:0` | All tier LEDs off |
| `MSG:ACT NOW: REST+HYDR` | Text on the OLED |

**Close the Serial Monitor before starting the bridge.** Only one program can hold the port.

## 5. Run the bridge

From the repo root, with the venv active:

```powershell
python bridge\serial_bridge.py --port COM5     # your Uno's port (Arduino IDE, Tools -> Port)
python bridge\serial_bridge.py --fake          # no hardware: simulated station
```

It serves `http://127.0.0.1:8000`, the same port and stream format as `bridge/mock_server.py`.

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/arm   -Method Post -ContentType 'application/json' -Body '{"crew_id":"C003","duration_s":20}'
Invoke-RestMethod http://127.0.0.1:8000/start -Method Post -ContentType 'application/json' -Body '{"crew_id":"C003","duration_s":20}'
Invoke-RestMethod http://127.0.0.1:8000/tier  -Method Post -ContentType 'application/json' -Body '{"n":2}'
Invoke-RestMethod http://127.0.0.1:8000/msg   -Method Post -ContentType 'application/json' -Body '{"text":"Rest+hydrate"}'
python bridge\test_client.py    # prints the first stream messages
python bridge\test_station.py   # offline tests
```

## 6. For the app team (Part 2)

| Call | Body | Does |
|---|---|---|
| `WS /ws/stream` | | `solar_event` first (cached), then `{"kind":"reading","data":…}` for each reading, and a `cabin_air` message every 5 s |
| `POST /start` | `{"crew_id":"C003","duration_s":20}` | Starts a run now. 400 bad crew ID, 409 run in progress, 503 station not connected |
| `POST /arm` | same | Picks the crew the station's **button** starts a run for. Call it whenever the crew selector changes |
| `POST /tier` | `{"n":0..3}` | Tier LEDs (and motor on 3) |
| `POST /msg` | `{"text":"…"}` | OLED text, cut to 32 characters |
| `POST /replay` | | Re-sends the last run's readings with `source: "replay"` (the "Replay last test" button) |
| `POST /scenario` | | Sends the Mars day 143 scenario readings once (scenario loader), with the saved stress feed merged in |
| `POST /stress` | `{"crew_id":"C003","last_n":8,"interval_s":1.0,"mood":4}` | Streams the saved stress model output (held-out WESAD S17) live: `stress_prob` + `stress_label` per window, `source: "ml_saved"`; with `mood`, ends with a `stress_mood_check`. 400 bad crew ID, 503 predictions file missing |
| `GET /health` | | `{"ok","serial","connected","running","armed","stress_feed"}` |

A run produces these readings, all `source: "station"`:

- `reaction_time` (ms) for each tap, live
- `sway_rms` (g) at the end
- `reaction_time_median` (ms) and `lapses` (count) after `done`

The arrival of `lapses` means the run is over.

`cabin_air` is **not** a crew reading, the same way DONKI events are not: it is an environment hazard. Message: `{"kind":"cabin_air","data":{"timestamp","value","unit":"adc_0_1023","source":"station"}}`. The value is an uncalibrated sensor index. Show it as change from this session's own baseline, never as ppm or a named gas.

## How the numbers are made

- **Reaction time:** `millis()` from the moment `TAP!` is on screen to the touch pad's rising edge. Under 100 ms is an anticipation and ignored. No touch within 2 s is sent as 2000 ms. The prompt never appears while a finger is already on the pad.
- **Touch module delay:** capacitive touch modules add a fixed delay of their own (tens of ms). Every run has the same delay, and FARSIDE compares each person with their own baseline, so it cancels out. Say so if a judge asks.
- **Lapses:** taps slower than 355 ms, the lapse threshold of the 3-minute brief PVT (PVT-B), [Basner, Mollicone & Dinges 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3197786). Set by `LAPSE_MS` in `bridge/station.py`; must equal `params.lapse_threshold_ms` in `data/knowledge.json` (decision D7).
- **Sway:** acceleration magnitude in g at 100 Hz. The value sent is the RMS of (magnitude − the run's mean magnitude). The mean is the gravity estimate, which also cancels sensor offset.

## Additions to the serial format (to copy into docs/schemas.md section 3)

Backwards compatible: `START` still means a 60 s run.

- App to Uno: `START:n` (run of n seconds, 5 to 120), `TIER:0` (all off), `PING`.
- Uno to app: `{"t":"done"}` (always last in a run), `{"t":"button"}`, `{"t":"air","raw":n}`, `{"t":"start"}`, `{"t":"ready"}`, `{"t":"err","msg":"acl"|"oled"}`. The bridge ignores unknown lines.
- Stream: new kind `cabin_air` (above). Endpoint: `POST /arm`.

## Troubleshooting

| Problem | Fix |
|---|---|
| Bridge: `could not open port` / `Access is denied` | Close the Arduino Serial Monitor |
| First command after connecting ignored | The Uno resets when the port opens. The bridge waits 2 s; send `PING` first if needed |
| Every reaction time is 2000 | Touch module OUT not on D2, or the module needs a firmer touch |
| `ACL ERROR` on the OLED | Re-run test 2. The station still runs; sway is just left out |
| I2C scanner finds nothing | OLED unpowered (it provides the pull-ups) or SDA/SCL swapped |
| Button starts nothing | Call `POST /arm` first, and check the bridge is running |
