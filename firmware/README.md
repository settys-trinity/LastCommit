# FARSIDE hardware: check-in station

The station runs the STAND-REACT test on an Arduino Uno and talks to the app through `bridge/serial_bridge.py`.
Serial format: `docs/schemas.md` section 3. Pins: plan pin diagram.

## Folder

```
firmware/
  stand_react/stand_react.ino   the station firmware
  tests/01_leds_buzzer          test sketches, run in this order
  tests/02_i2c_scanner
  tests/03_imu
  tests/04_lcd
  tests/05_piezo
bridge/
  serial_bridge.py              real bridge (or --fake without hardware)
  station.py                    bridge logic, standard library only
  test_station.py               offline tests: python bridge/test_station.py
```

## 1. Install (Windows)

1. Arduino IDE 2: `winget install ArduinoSA.IDE.stable`
2. In the IDE, Library Manager: install **LiquidCrystal I2C** by Frank de Brabander. No IMU library is needed; the firmware reads the MPU6050 registers directly, which also works with most clone chips.
3. Plug in the Uno. Pick the board (**Arduino Uno**) and the port under **Tools**. No port appears: it is probably a clone and needs the CH340 driver.
4. Python packages for the bridge, from the repo root:
   ```powershell
   python -m venv .venv
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
   .\.venv\Scripts\Activate.ps1
   pip install -r bridge\requirements.txt
   ```

## 2. Wiring

All grounds go to one GND rail. 5V goes to the IMU and LCD VCC.

| Part | Connects to | Note |
|---|---|---|
| IMU MPU6050 | SDA → A4, SCL → A5, VCC → 5V, GND | Address 0x68 |
| LCD I2C adapter | SDA → A4, SCL → A5, VCC → 5V, GND | Address 0x27 or 0x3F (found automatically) |
| Piezo disc | + → A0, − → GND | 1 MΩ resistor from A0 to GND, across the disc |
| White LED | D3 → 220 Ω → LED long leg; short leg → GND | Reaction prompt |
| Green LED | D5 → 220 Ω → LED → GND | Tier 1 |
| Amber LED | D6 → 220 Ω → LED → GND | Tier 2 |
| Red LED | D7 → 220 Ω → LED → GND | Tier 3 |
| Active buzzer | D8 → buzzer + ; buzzer − → GND | Tier 3 alert |

- Wear the IMU on a lanyard at the sternum. Hold the piezo pad in one hand, so tapping does not shake the IMU.
- Use long jumper wires for the IMU and piezo, so the person can stand.

## 3. Test each module (in order)

Upload each sketch, open **Tools → Serial Monitor** at **115200 baud**, and check the result before moving on.

| Sketch | Expect | If not |
|---|---|---|
| `01_leds_buzzer` | White, green, amber, red light in turn, then 3 beeps | LED backwards (long leg to the resistor side). Buzzer silent: it may be passive, swap it |
| `02_i2c_scanner` | `Found 0x68` and `Found 0x27` or `0x3F` | Check A4/A5, 5V and GND on both modules |
| `03_imu` | Last column near `1.000` when still, higher when shaken | Nothing at 0x68 in test 2 |
| `04_lcd` | `FARSIDE` and a counter | Backlight but no text: turn the blue potentiometer on the back of the adapter |
| `05_piezo` | Low numbers at rest, a spike on each tap | Set `TAP_THRESHOLD` in `stand_react.ino` about halfway between rest and tap peaks |

## 4. Upload the station firmware

1. Open `firmware/stand_react/stand_react.ino`. Set `TAP_THRESHOLD` from test 5.
2. Upload. The LCD shows `FARSIDE / Ready` (or `IMU ERROR`).
3. In the Serial Monitor (115200, line ending **Newline**), type each line and press Enter:

| Type | Expect |
|---|---|
| `PING` | `{"t":"ready"}` |
| `START:20` | `{"t":"start"}`, white LED flashes at random; tap → `{"t":"rt","ms":…}`; after 20 s `{"t":"sway","rms":…}` then `{"t":"done"}` |
| `TIER:1` / `TIER:2` / `TIER:3` | Green / amber / red plus 3 beeps |
| `TIER:0` | All tier LEDs off |
| `MSG:ACT NOW: REST+HYDR` | Text on the LCD |

**Close the Serial Monitor before starting the bridge.** Only one program can hold the port.

## 5. Run the bridge

From the repo root, with the venv active:

```powershell
python bridge\serial_bridge.py --port COM5     # your Uno's port (Arduino IDE, Tools -> Port)
python bridge\serial_bridge.py --fake          # no hardware: simulated station
```

It serves on `http://127.0.0.1:8000`, the same port and stream format as `bridge/mock_server.py`, so the app only switches servers.

Test it from a second PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/start -Method Post -ContentType 'application/json' -Body '{"crew_id":"C003","duration_s":20}'
Invoke-RestMethod http://127.0.0.1:8000/tier  -Method Post -ContentType 'application/json' -Body '{"n":2}'
Invoke-RestMethod http://127.0.0.1:8000/msg   -Method Post -ContentType 'application/json' -Body '{"text":"Rest+hydrate"}'
python bridge\test_client.py    # prints the first stream messages
```

## 6. For the app team (Part 2)

| Call | Body | Does |
|---|---|---|
| `WS /ws/stream` | | `solar_event` first (cached), then `{"kind":"reading","data":…}` for each station reading |
| `POST /start` | `{"crew_id":"C003","duration_s":20}` | Starts a run. 400 bad crew ID, 409 run in progress, 503 station not connected |
| `POST /tier` | `{"n":0..3}` | Tier LEDs and buzzer |
| `POST /msg` | `{"text":"…"}` | LCD text, cut to 32 characters |
| `POST /replay` | | Re-sends the last run's readings with `source: "replay"` (the "Replay last test" button) |
| `POST /scenario` | | Sends the Mars day 143 scenario readings once (scenario loader) |
| `GET /health` | | `{"ok","serial","connected","running"}` |

A run produces these readings, all `source: "station"`:

- `reaction_time` (ms) for each tap, live
- `sway_rms` (g) at the end
- `reaction_time_median` (ms) and `lapses` (count) after `done`

The arrival of `lapses` means the run is over.

## How the numbers are made

- **Reaction time:** `millis()` from LED on to the first tap over the threshold. Taps under 100 ms are anticipations and ignored. No tap within 2 s is sent as 2000 ms. Taps while the light is off are ignored. Gaps between lights are random, 1.5 to 4 s.
- **Lapses:** taps slower than 500 ms. This is the common PVT lapse cut-off, but it is **UNSOURCED** here. Part 3 to cite it (`LAPSE_MS` in `bridge/station.py`).
- **Sway:** acceleration magnitude in g at 100 Hz. The value sent is the RMS of (magnitude − the run's mean magnitude). The mean is the gravity estimate, which also cancels each sensor's offset error.

## Additions to the serial format (to copy into docs/schemas.md section 3)

These are backwards compatible: `START` still means a 60 s run.

- App to Uno: `START:n` (run of n seconds, 5 to 120), `TIER:0` (all off), `PING`.
- Uno to app: `{"t":"done"}` (always the last line of a run), `{"t":"start"}`, `{"t":"ready"}`, `{"t":"err","msg":"imu"}`. The bridge ignores unknown lines.

## Troubleshooting

| Problem | Fix |
|---|---|
| Bridge: `could not open port` / `Access is denied` | Close the Arduino Serial Monitor or any other program using the port |
| First command after connecting is ignored | The Uno resets when the port opens. The bridge waits 2 s; if needed, send `PING` first |
| Reaction times all 2000 | `TAP_THRESHOLD` too high, or piezo not on A0 |
| Phantom taps with no touch | `TAP_THRESHOLD` too low, or the 1 MΩ resistor is missing |
| `IMU ERROR` on the LCD | Re-run test 2. The station still runs; sway is just left out |
