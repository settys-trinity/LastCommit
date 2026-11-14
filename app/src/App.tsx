import { useEffect, useMemo, useRef, useState } from "react";
import { useStream } from "./hooks/useStream";
import { useBridgeCommands } from "./hooks/useBridgeCommands";
import { useStationSync } from "./hooks/useStationSync";
import { evaluate } from "./engine";
import { getMission, MISSIONS, type MissionId } from "./engine/delay";
import { Panel, StatusTag } from "./components/term";
import { TopBar } from "./components/shell/TopBar";
import { formatRoundTrip } from "./components/shell/format";
import { BodyMap } from "./components/bodymap/BodyMap";
import { SolarBanner } from "./components/solar/SolarBanner";
import { CabinAirPanel } from "./components/cabin/CabinAirPanel";
import { BaselinePanel } from "./components/baseline/BaselinePanel";
import { MissionSelector } from "./components/mission/MissionSelector";
import { OutboxPanel, useEarthOutbox } from "./components/outbox/OutboxPanel";
import { StressMoodPanel } from "./components/stress/StressMoodPanel";
import { StandReactView } from "./components/standreact/StandReactView";
import { TriageCard } from "./components/triage/TriageCard";
import { StationPreview } from "./components/station/StationPreview";

const SPEED_UP = 60; // demo: the 44 min Mars round trip counts down in 44 s (D15)
const RUN_TIMEOUT_MS = 30_000; // stop showing "running" if lapses never arrives

// /demo: App holds all state; components get props only (plan C9).
export default function App() {
  const { mode, readingsByCrew, solarEvent, cabinAir, loadScenario, resetReadings, addReadings } = useStream();
  const bridge = useBridgeCommands(mode, addReadings);
  const [missionId, setMissionId] = useState<MissionId>("iss");
  const [crewId, setCrewId] = useState("C003");
  const [warning, setWarning] = useState("");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");

  const mission = getMission(missionId);
  const crewReadings = useMemo(() => readingsByCrew[crewId] ?? [], [readingsByCrew, crewId]);
  const result = useMemo(() => evaluate(crewReadings, crewId, missionId), [crewReadings, crewId, missionId]);
  const t = result.triage;

  // Live mode only: the station button starts a run for this crew.
  useEffect(() => {
    if (mode !== "live") return;
    bridge.arm(crewId).then((r) => setWarning(r.ok ? "" : `arm ${crewId}: ${r.error}`));
  }, [crewId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Running: on while station taps arrive (also runs started by the station button), off at lapses.
  const lastReading = crewReadings.at(-1);
  useEffect(() => {
    if (!lastReading) return;
    if (lastReading.type === "lapses") setRunning(false);
    else if (lastReading.type === "reaction_time" && lastReading.source === "station") setRunning(true);
  }, [lastReading]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setRunning(false), RUN_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [running, lastReading]);

  const startTest = async () => {
    if (running) return;
    setRunError("");
    const r = await bridge.startTest(crewId, 20);
    if (r.ok) setRunning(true);
    else setRunError(r.error ?? "start failed");
  };
  const replay = async () => {
    setRunError("");
    const r = await bridge.replayLast();
    if (!r.ok) setRunError(r.error ?? "replay failed");
  };

  // Station follows the app: engine tier unchanged, then the OLED text (live mode only, C7).
  useStationSync(t.tier, mode);

  // Keys: 1-4 mission, s start test, r replay.
  const keys = useRef({ startTest, replay });
  keys.current = { startTest, replay };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const m = MISSIONS[Number(e.key) - 1];
      if (m) setMissionId(m.id);
      else if (e.key === "s") keys.current.startTest();
      else if (e.key === "r") keys.current.replay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Earth outbox: one packet per new triage and per mission change (send ignores tier 0).
  const outbox = useEarthOutbox(SPEED_UP);
  const sendRef = useRef(outbox.send);
  sendRef.current = outbox.send;
  const lastSent = useRef("");
  useEffect(() => {
    const key = `${crewId}|${missionId}|${t.tier}|${t.reason}`;
    if (key === lastSent.current) return; // StrictMode re-runs and repeat renders send nothing
    lastSent.current = key;
    sendRef.current(crewId, getMission(missionId), t);
  }, [t.tier, t.reason, missionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const missionSlot = <MissionSelector value={missionId} onChange={(id) => setMissionId(id as MissionId)} />;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        crewId={crewId}
        onCrewChange={setCrewId}
        missionLabel={mission.label}
        link={formatRoundTrip(mission.round_trip_s)}
        missionSlot={missionSlot}
        mode={mode}
        onLoadScenario={() => loadScenario().catch((e: Error) => setWarning(e.message))}
        onReset={resetReadings}
      />

      <div className="border-b border-line px-2 whitespace-pre-wrap">
        <SolarBanner solarEvent={solarEvent} />
        {warning && (
          <div>
            <StatusTag status="warn" /> {warning}
          </div>
        )}
      </div>

      <main className="grid flex-1 grid-cols-1 gap-3 p-2 lg:grid-cols-[1fr_1.2fr_1fr]">
        <div className="flex flex-col gap-3">
          <BaselinePanel crewId={crewId} />
          <StandReactView
            crewId={crewId}
            readings={crewReadings}
            running={running}
            onStart={startTest}
            onReplay={replay}
            error={runError}
          />
        </div>
        <div className="flex flex-col gap-3">
          <TriageCard triage={t} />
          <StationPreview tier={t.tier} />
        </div>
        <div className="flex flex-col gap-3">
          <BodyMap data={{ result, readings: crewReadings, cabinAir }} crewId={crewId} />
          <Panel title="stress / mood">
            <StressMoodPanel crewId={crewId} readings={crewReadings} />
          </Panel>
          <Panel title="earth outbox">
            <OutboxPanel packets={outbox.packets} speedUp={SPEED_UP} />
          </Panel>
          <CabinAirPanel samples={cabinAir} />
        </div>
      </main>

      <footer className="border-t border-line px-2 text-dim whitespace-pre-wrap">
        keys: 1-4 mission  s start test  r replay  b body view
      </footer>
    </div>
  );
}
