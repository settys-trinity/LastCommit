// Stress vs mood panel. Owner: Nandini. Props only (plan C9): no WebSocket, no evaluate().
// A flag on this panel only: it never changes the triage tier (D13).
import type { Reading } from "../../types";
import { checkStressMood } from "./stressMoodCheck";

interface Props {
  crewId: string;
  readings: Reading[]; // everything received so far, any order
}

export function StressMoodPanel({ crewId, readings }: Props) {
  const mine = readings
    .filter((r) => r.crew_id === crewId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const probs = mine.filter((r) => r.type === "stress_prob").map((r) => Number(r.value));
  const moods = mine.filter((r) => r.type === "mood");
  const mood = moods.length ? Number(moods[moods.length - 1].value) : null;
  const check = checkStressMood(mood, probs);
  const replayed = mine.some((r) => r.type === "stress_prob" && r.source === "ml_saved");

  return (
    <section
      className={
        "border p-3 font-mono text-sm " +
        (check.flag ? "border-amber-500 text-neutral-200" : "border-neutral-700 text-neutral-300")
      }
    >
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-green-400">&gt; stress vs mood</h2>
        {check.flag && <span className="border border-amber-500 px-1 text-amber-400">[MISMATCH]</span>}
      </header>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-neutral-500">body (stress model)</div>
          <div className="text-lg">
            {check.stressLevel === null ? "--" : `${Math.round(check.stressLevel * 100)}% stress`}
          </div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">self-report (mood 1-5)</div>
          <div className="text-lg">{mood ?? "--"}</div>
        </div>
      </div>

      {/* last 20 windows, one bar per 60 s window */}
      <div className="mb-2 flex h-8 items-end gap-px" aria-label="Stress probability per 60 s window">
        {probs.slice(-20).map((p, i) => (
          <div
            key={i}
            className={p >= 0.5 ? "flex-1 bg-amber-500" : "flex-1 bg-neutral-500"}
            style={{ height: `${Math.max(4, p * 100)}%` }}
            title={`${Math.round(p * 100)}%`}
          />
        ))}
      </div>

      <p className={check.flag ? "text-amber-300" : ""}>{check.message}</p>
      {replayed && (
        <p className="mt-2 text-xs text-neutral-500">
          Stress feed replays held-out WESAD subject S17 (never in training), standing in for a Bio-Monitor shirt.
          Not the person on stage. Model: 91.6% accuracy on unseen people, heart and breathing only.
        </p>
      )}
    </section>
  );
}
