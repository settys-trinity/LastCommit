import { useEffect, useRef, useState } from "react";

// Box breathing: 4 s in, 4 s hold, 4 s out, 4 s hold; 4 rounds = 64 s (about one minute).
// The circle grows on "breathe in" and shrinks on "breathe out" (SVG, so the square-corner rule does not apply).
const PHASES = [
  { label: "Breathe in", scale: 1 },
  { label: "Hold", scale: 1 },
  { label: "Breathe out", scale: 0.45 },
  { label: "Hold", scale: 0.45 },
] as const;
const STEP_S = 4;
const ROUNDS = 4;
const TOTAL_S = STEP_S * PHASES.length * ROUNDS;

export function BoxBreathing({ onDone }: { onDone: () => void }) {
  const [t, setT] = useState<number | null>(null); // seconds since start; null = not started
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (t === null) return;
    if (t >= TOTAL_S) {
      onDoneRef.current();
      return;
    }
    const id = window.setTimeout(() => setT(t + 1), 1000);
    return () => window.clearTimeout(id);
  }, [t]);

  const running = t !== null && t < TOTAL_S;
  const done = t !== null && t >= TOTAL_S;
  const phase = PHASES[Math.floor((t ?? 0) / STEP_S) % PHASES.length];
  const count = STEP_S - ((t ?? 0) % STEP_S);
  const round = Math.min(ROUNDS, Math.floor((t ?? 0) / (STEP_S * PHASES.length)) + 1);
  const scale = running ? phase.scale : 0.45;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 220 220" className="h-64 w-64" role="img" aria-label={running ? `${phase.label}, ${count}` : "breathing circle"}>
        <rect x="10" y="10" width="200" height="200" fill="none" stroke="var(--color-line)" strokeDasharray="4 6" />
        <g style={{ transform: `scale(${scale})`, transformOrigin: "110px 110px", transition: `transform ${STEP_S}s linear` }}>
          <circle cx="110" cy="110" r="95" fill="var(--color-ok)" fillOpacity="0.12" stroke="var(--color-ok)" strokeWidth="3" />
        </g>
        <text x="110" y="104" textAnchor="middle" fill="var(--color-fg)" fontSize="18" fontFamily="var(--font-mono)">
          {running ? phase.label : done ? "Well done" : "Ready"}
        </text>
        {running && (
          <text x="110" y="136" textAnchor="middle" fill="var(--color-ok)" fontSize="30" fontWeight="bold" fontFamily="var(--font-mono)">
            {count}
          </text>
        )}
      </svg>
      <div className="text-dim">
        {running ? `round ${round} of ${ROUNDS} · ${TOTAL_S - t} s left` : done ? "1 minute of box breathing done" : "4 in · 4 hold · 4 out · 4 hold · 1 minute"}
      </div>
      {running ? (
        <button type="button" onClick={() => setT(null)} className="border border-line px-3 py-1 hover:bg-fg hover:text-bg">
          [ stop ]
        </button>
      ) : (
        <button type="button" onClick={() => setT(0)} className="border border-fg px-3 py-1 text-lg font-bold hover:bg-fg hover:text-bg">
          {done ? "[ again ]" : "[ start 1-minute breathing ]"}
        </button>
      )}
    </div>
  );
}
