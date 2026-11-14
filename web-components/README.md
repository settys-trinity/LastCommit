# web-components (Nandini)

Drop-in React + TypeScript + Tailwind pieces for the app, built before the app scaffold existed.
Copy these files into `app/src/components/` (plan v2: the outbox lives at `app/src/components/OutboxPanel.tsx`). No extra packages beyond React and Tailwind.

| File | What it is |
|------|------------|
| `missions.ts` | ISS / Moon / Mars / conjunction delays from `docs/delay_table.md` (Mars round trip 2640 s, as in `docs/engine_contract.md`). |
| `MissionSelector.tsx` | Always-visible mission switch. The ISS -> Mars switch is the key demo moment. |
| `OutboxPanel.tsx` | `useEarthOutbox(speedUp)` hook + `<OutboxPanel>`: report packets with a reply countdown = round trip / speed-up. "Queued: no link" in conjunction. |
| `StressMoodPanel.tsx` | Brain & behaviour panel: stress model vs mood check-in, amber MISMATCH flag, stress bars, replay disclaimer. |
| `stressMoodCheck.ts` | The mismatch rules (same as `ml/stress_feed.py`). Also usable by the engine. |

## Wiring (in App.tsx)

```tsx
const [mission, setMission] = useState<MissionId>("iss");
const [readings, setReadings] = useState<Reading[]>([]);
const SPEED_UP = 60; // demo: 44 min Mars countdown runs in 44 s. Say so on stage.
const outbox = useEarthOutbox(SPEED_UP);

// in the WebSocket onmessage: if (msg.kind === "reading") setReadings(r => [...r, msg.data]);
// when the engine returns a new result:  outbox.send(crewId, MISSIONS[mission], result.triage);
// when the mission changes, re-run the engine and send the new triage, so judges see the switch.

<MissionSelector value={mission} onChange={setMission} />
<StressMoodPanel crewId={crewId} readings={readings} />
<OutboxPanel packets={outbox.packets} speedUp={SPEED_UP} />
```

Mission ids are `iss`, `moon`, `mars`, `conjunction`: use the same ids as `missionId` in `evaluate(readings, crewId, missionId)` (`app/src/engine/engine.ts`). The router should take `MISSIONS[missionId].roundTripS` as `round_trip_s` (ISS 0.5, Moon 2.6, Mars 2640, conjunction null).

## Stress readings from the bridge

`python bridge/serial_bridge.py --fake`, then:

- `POST /scenario`: Mars day 143 readings with the saved stress feed merged in (27 readings).
- `POST /stress` `{"crew_id":"C003","last_n":8,"interval_s":1,"mood":4}`: streams 8 stress windows live, then a `stress_mood_check` (here `hidden_stress`).

`<StressMoodPanel>` reads `stress_prob` and `mood` readings from the stream and works the check out itself, so it also reacts to a mood typed into the check-in.
