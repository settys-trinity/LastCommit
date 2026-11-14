// Stress vs mood panel (brain & behaviour). Feed it the readings from the stream.
// Uses stressMoodCheck.ts. One more indicator: never sets a tier on its own.
import { checkStressMood } from "./stressMoodCheck";

// Same shape as docs/schemas.md section 1
export interface Reading {
  crew_id: string;
  timestamp: string;
  type: string;
  value: number | string | boolean;
  unit: string;
  source: string;
}

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

  const tone = check.flag
    ? "border-amber-400 bg-amber-500/10 text-amber-200"
    : "border-slate-700 bg-slate-900 text-slate-200";

  return (
    <section className={`rounded-xl border p-4 ${tone}`}>
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Stress vs mood</h2>
        {check.flag && (
          <span className="rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-slate-900">MISMATCH</span>
        )}
      </header>

      <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-slate-400">Body (stress model)</div>
          <div className="text-xl font-semibold">
            {check.stressLevel === null ? "–" : `${Math.round(check.stressLevel * 100)}% stress`}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Self-report (mood 1–5)</div>
          <div className="text-xl font-semibold">{mood ?? "–"}</div>
        </div>
      </div>

      {/* last 20 windows as bars */}
      <div className="mb-3 flex h-10 items-end gap-0.5" aria-label="Stress probability per 60 s window">
        {probs.slice(-20).map((p, i) => (
          <div
            key={i}
            className={p >= 0.5 ? "flex-1 bg-amber-400" : "flex-1 bg-sky-500"}
            style={{ height: `${Math.max(4, p * 100)}%` }}
            title={`${Math.round(p * 100)}%`}
          />
        ))}
      </div>

      <p className="text-sm">{check.message}</p>
      {replayed && (
        <p className="mt-2 text-xs text-slate-400">
          Stress feed replays held-out WESAD subject S17 (never in training), standing in for a Bio-Monitor shirt.
          Not the person on stage. Model: 91.6% accuracy on unseen people, heart and breathing only.
        </p>
      )}
    </section>
  );
}
