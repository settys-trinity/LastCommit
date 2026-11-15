import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStream } from "./hooks/useStream";
import { useBridgeCommands } from "./hooks/useBridgeCommands";
import { useStationSync } from "./hooks/useStationSync";
import { evaluate } from "./engine";
import { getMission, MISSIONS, type MissionId } from "./engine/delay";
import { Panel, StatusTag } from "./components/term";
import { CrewSelector } from "./components/shell/CrewSelector";
import { BodyViewer } from "./components/bodymap/BodyViewer";
import { SolarBanner } from "./components/solar/SolarBanner";
import { CabinAirPanel } from "./components/cabin/CabinAirPanel";
import { BaselinePanel } from "./components/baseline/BaselinePanel";
import { MissionSelector } from "./components/mission/MissionSelector";
import { OutboxPanel, useEarthOutbox } from "./components/outbox/OutboxPanel";
import { StressMoodPanel } from "./components/stress/StressMoodPanel";
import { TestStrip } from "./components/standreact/TestStrip";
import { TriageCard } from "./components/triage/TriageCard";
import { EarthCountdown } from "./components/triage/EarthCountdown";
import { StationLine } from "./components/station/StationLine";
import { WellbeingView } from "./components/wellbeing/WellbeingView";
import { POINTS, score, type Answers } from "./components/wellbeing/questionnaire";
import { AssessReport } from "./components/report/AssessReport";

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
  // Body view: its own full page, opened with b, the footer button or "/demo#body" from the landing page.
  const [bodyOpen, setBodyOpen] = useState(() => window.location.hash === "#body");
  const [showLog, setShowLog] = useState(false);
  // Wellbeing: check-in answers (sent to POST /assess by the report panel; never change the tier, D13) and points.
  const [wellOpen, setWellOpen] = useState(false);
  const [checkin, setCheckin] = useState<Answers | null>(null);
  const [points, setPoints] = useState(0);
  const [breaths, setBreaths] = useState(0); // finished 1-minute breathing sessions
  const closeWell = useCallback(() => setWellOpen(false), []);
  const closeBody = useCallback(() => {
    setBodyOpen(false);
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname); // a reload stays on the dashboard
  }, []);

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
  // Demo data: the Mars day 143 scenario holds readings for C003 only, so loading it also selects C003.
  const loadDemo = () => {
    setCrewId("C003");
    loadScenario().catch((e: Error) => setWarning(e.message));
  };

  const keys = useRef({ startTest, replay, loadDemo, resetReadings });
  keys.current = { startTest, replay, loadDemo, resetReadings };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const m = MISSIONS[Number(e.key) - 1];
      if (m) setMissionId(m.id);
      else if (e.key === "s") keys.current.startTest();
      else if (e.key === "r") keys.current.replay();
      else if (e.key === "h") window.location.assign("/"); // home: the landing page
      else if (e.key === "b") setBodyOpen(true);
      else if (e.key === "w") setWellOpen(true);
      else if (e.key === "o") setShowLog((v) => !v);
      else if (e.key === "m") keys.current.loadDemo(); // demo data: Mars day 143
      else if (e.key === "c") keys.current.resetReadings(); // clear all readings
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

  const big = "w-full border border-fg px-3 py-2 text-left text-xl font-bold hover:bg-fg hover:text-bg";

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header: who and where. Mission buttons are the one control the astronaut changes here. */}
      <header className="flex flex-wrap items-start gap-x-8 gap-y-2 border-b border-line px-3 py-2">
        <a href="/" className="text-xl font-bold text-ok hover:bg-ok hover:text-bg">FARSIDE</a>
        <span className="text-xl">
          <span className="text-dim">crew </span>
          {crewId}
        </span>
        <span className="text-xl">
          <span className="text-dim">points </span>
          {points}
        </span>
        {/* [&_p]:hidden hides the selector's source line here; sources are in the deck and docs/delay_table.md. */}
        <div className="ml-auto [&_p]:hidden">
          <MissionSelector value={missionId} onChange={(id) => setMissionId(id as MissionId)} />
        </div>
      </header>
      {warning && (
        <div className="border-b border-line px-3">
          <StatusTag status="warn" /> {warning}
        </div>
      )}

      {/* Layer 1: only what the astronaut acts on. Details live in the body view (b). */}
      <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 p-3">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <TriageCard triage={t} />
          <Panel title="earth reply">
            <EarthCountdown packet={t.tier > 0 ? outbox.packets.find((p) => p.crewId === crewId) : undefined} speedUp={SPEED_UP} />
            <div className="mt-3 border-t border-line pt-2">
              <StationLine tier={t.tier} />
            </div>
          </Panel>
        </div>
        <Panel title="on board vs earth">
          <AssessReport
            crewId={crewId}
            missionId={missionId}
            triage={t}
            readings={crewReadings}
            packet={t.tier > 0 ? outbox.packets.find((p) => p.crewId === crewId) : undefined}
            speedUp={SPEED_UP}
            checkin={checkin}
          />
        </Panel>
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Panel title="next step">
            <TestStrip crewId={crewId} readings={crewReadings} running={running} onStart={startTest} onReplay={replay} error={runError} />
          </Panel>
          <Panel title="details">
            <button type="button" onClick={() => setBodyOpen(true)} className={big}>
              [b] SEE EACH FINDING ON THE BODY
            </button>
            <div className="mt-2 text-dim">sleep, mood and stress, blood glucose (NASA baseline), reaction, balance, cabin air</div>
            <button type="button" onClick={() => setWellOpen(true)} className={`${big} mt-3`}>
              [w] CHECK-IN AND BREATHING
            </button>
            <div className="mt-2 text-dim">
              {checkin ? `last check-in: ${score(checkin).label}` : "no check-in yet · 5 questions, about 30 s"}
              {breaths > 0 ? ` · breathing done ${breaths}×` : " · no breathing break yet"}
            </div>
            <button type="button" onClick={() => setShowLog((v) => !v)} className="mt-2 hover:bg-fg hover:text-bg">
              [o] {showLog ? "hide" : "show"} Earth outbox log ({outbox.packets.length})
            </button>
          </Panel>
        </div>
        {showLog && (
          <Panel title="earth outbox log">
            <OutboxPanel packets={outbox.packets} speedUp={SPEED_UP} />
          </Panel>
        )}
      </main>

      {/* Bottom bar: every action as a button with its key, then the demo controls. */}
      <footer className="border-t border-line px-3 py-1 text-dim">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span>[1-4] mission</span>
          {[
            { key: "s", label: "start test", run: startTest },
            { key: "r", label: "replay test", run: replay },
            { key: "b", label: "body view", run: () => setBodyOpen(true) },
            { key: "w", label: "wellbeing", run: () => setWellOpen(true) },
            { key: "o", label: "outbox log", run: () => setShowLog((v) => !v) },
            { key: "m", label: "demo data", run: loadDemo },
            { key: "c", label: "reset", run: resetReadings },
            { key: "h", label: "home", run: () => window.location.assign("/") },
          ].map((a) => (
            <button key={a.key} type="button" onClick={a.run} className="hover:bg-fg hover:text-bg">
              <span className="text-fg">[{a.key}]</span> {a.label}
            </button>
          ))}
          <span className="text-line">│</span>
          <CrewSelector value={crewId} onChange={setCrewId} />
          <span className={mode === "live" ? "text-ok" : "text-warn"}>{mode === "live" ? "[LIVE]" : "[REPLAY]"}</span>
        </div>
        <SolarBanner solarEvent={solarEvent} />
      </footer>

      {wellOpen && (
        <WellbeingView
          crewId={crewId}
          answers={checkin}
          points={points}
          breaths={breaths}
          onSubmit={(a) => {
            setCheckin(a);
            setPoints((p) => p + POINTS.questionnaire);
          }}
          onBreathingDone={() => {
            setPoints((p) => p + POINTS.breathing_session);
            setBreaths((n) => n + 1);
          }}         
          onClose={closeWell}
        />
      )}

      {bodyOpen && (
        <BodyViewer
          data={{ result, readings: crewReadings, cabinAir }}
          crewId={crewId}
          running={running}
          onRunTest={startTest}
          onCheckin={(r) => addReadings([r])}
          onClose={closeBody}
          extra={{
            abdomen: <BaselinePanel crewId={crewId} />,
            chest: (
              <Panel title="stress / mood">
                <StressMoodPanel crewId={crewId} readings={crewReadings} />
              </Panel>
            ),
            backpack: <CabinAirPanel samples={cabinAir} />,
          }}
        />
      )}
    </div>
  );
}