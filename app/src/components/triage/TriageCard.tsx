import type { Triage } from "../../types";
import { Panel } from "../term";

// STATUS card: the one thing to read first. D2: the tier colour means who acts. The tier line is a
// full-width bar in that colour so it reads from the back of the room; then who acts and what to do, in plain words.
const TIER: Record<Triage["tier"], { label: string; bar: string }> = {
  0: { label: "ALL CLEAR", bar: "border border-ok text-ok" },
  1: { label: "SELF-CARE", bar: "bg-ok text-bg" },
  2: { label: "CREW ACTS NOW", bar: "bg-warn text-bg" },
  3: { label: "MESSAGE EARTH", bar: "bg-fail text-bg" },
};

const WHO: Record<Triage["acts"], string> = {
  none: "Nobody needs to act",
  crew: "You: self-care",
  crew_medical_officer: "Your crew medical officer, now",
  flight_surgeon: "The flight surgeon on Earth",
};

export function TriageCard({ triage }: { triage: Triage }) {
  const t = TIER[triage.tier];
  return (
    <Panel title="status">
      <div className={`px-3 py-2 text-3xl font-bold whitespace-pre-wrap ${t.bar}`}>{`TIER ${triage.tier}  ${t.label}`}</div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="pt-1 text-dim">WHO ACTS</dt>
        <dd className="text-xl font-bold">{WHO[triage.acts]}</dd>
        <dt className="pt-1 text-dim">DO NOW</dt>
        <dd className="text-xl">{triage.action || "Nothing. Carry on with the plan."}</dd>
        <dt className="text-dim">WHY</dt>
        <dd>{triage.reason ? triage.reason.split("_").join(" ") : "All readings are within your normal range."}</dd>
      </dl>
    </Panel>
  );
}