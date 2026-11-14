import { useEffect, useMemo, useState } from "react";
import { BRIDGE_URL, useStream } from "./hooks/useStream";
import { evaluate } from "./engine";
import { getMission, MISSIONS, type MissionId } from "./engine/delay";
import { KeyValue, Panel, StatusTag, type TagStatus } from "./components/term";
import { TopBar } from "./components/shell/TopBar";
import { formatRoundTrip } from "./components/shell/format";
import { BodyMap } from "./components/bodymap/BodyMap";
import { SolarBanner } from "./components/solar/SolarBanner";
import { CabinAirPanel } from "./components/cabin/CabinAirPanel";
import { BaselinePanel } from "./components/baseline/BaselinePanel";

const TIER_STATUS: Record<0 | 1 | 2 | 3, TagStatus> = { 0: "ok", 1: "warn", 2: "warn", 3: "fail" };

function Waiting() {
  return (
    <div>
      <StatusTag status="off" /> waiting for module
    </div>
  );
}

// /demo: App holds all state; components get props only (plan C9).
export default function App() {
  const { mode, readingsByCrew, solarEvent, cabinAir, loadScenario, resetReadings } = useStream();
  const [missionId, setMissionId] = useState<MissionId>("iss");
  const [crewId, setCrewId] = useState("C003");
  const [warning, setWarning] = useState("");

  const mission = getMission(missionId);
  const result = useMemo(
    () => evaluate(readingsByCrew[crewId] ?? [], crewId, missionId),
    [readingsByCrew, crewId, missionId],
  );

  // Live mode only: the station button starts a run for this crew.
  useEffect(() => {
    if (mode !== "live") return;
    fetch(`${BRIDGE_URL}/arm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crew_id: crewId, duration_s: 20 }),
    })
      .then((res) => setWarning(res.ok ? "" : `POST /arm failed: ${res.status}`))
      .catch((e: Error) => setWarning(`POST /arm failed: ${e.message}`));
  }, [crewId, mode]);

  // Keys 1-4 switch mission.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m = MISSIONS[Number(e.key) - 1];
      if (m) setMissionId(m.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // TEMP until nandini/components merges: text mission selector from MISSIONS.
  const missionSlot = (
    <span className="whitespace-pre">
      <span className="text-dim">mission: </span>
      {MISSIONS.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => setMissionId(m.id)}
          className={`px-1 ${m.id === missionId ? "bg-fg text-bg" : "hover:text-ok"}`}
        >
          {m.label}
        </button>
      ))}
    </span>
  );

  const t = result.triage;
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
          <Panel title="stand-react"><Waiting /></Panel>
        </div>
        <div className="flex flex-col gap-3">
          <Panel title="triage" status={TIER_STATUS[t.tier]}>
            <KeyValue
              rows={[
                ["tier", String(t.tier)],
                ["acts", t.acts],
                ["round_trip", formatRoundTrip(t.round_trip_s)],
              ]}
            />
          </Panel>
          <Panel title="station"><Waiting /></Panel>
        </div>
        <div className="flex flex-col gap-3">
          <BodyMap result={result} />
          <Panel title="stress / mood"><Waiting /></Panel>
          <Panel title="earth outbox"><Waiting /></Panel>
          <CabinAirPanel samples={cabinAir} />
        </div>
      </main>

      <footer className="border-t border-line px-2 text-dim whitespace-pre-wrap">
        keys: 1-4 mission  s start test  r replay  ? help
      </footer>
    </div>
  );
}
