import { useEffect, useState } from "react";
import { ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { Reading } from "../../types";
import { PALETTE } from "../../theme";
import { KeyValue, Panel, Sparkline, StatusTag } from "../term";

const LAPSE_MS = 355; // bridge/station.py LAPSE_MS (D7)
const RUN_S = 20;
const AXIS = { fill: PALETTE.dim, fontSize: 11, fontFamily: "JetBrains Mono, monospace" };

/** Readings of the latest run: after the last `lapses` while running, else between the last two. */
export function latestRun(readings: Reading[], running: boolean): Reading[] {
  const ends = readings.flatMap((r, i) => (r.type === "lapses" ? [i] : []));
  if (running) return readings.slice((ends.at(-1) ?? -1) + 1);
  if (ends.length === 0) return readings;
  return readings.slice((ends.at(-2) ?? -1) + 1, ends.at(-1)! + 1);
}

/** "[########............] 12/20 s" */
export function progressBar(elapsedS: number, totalS = RUN_S, width = 20): string {
  const s = Math.min(totalS, Math.max(0, Math.floor(elapsedS)));
  const filled = Math.round((s / totalS) * width);
  return `[${"#".repeat(filled)}${".".repeat(width - filled)}] ${s}/${totalS} s`;
}

function useElapsed(running: boolean): number {
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return setStart(null);
    setStart(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [running]);
  return start === null ? 0 : (now - start) / 1000;
}

// STAND-REACT: live tap log, reaction-time plot, sway and the run summary.
export function StandReactView({ crewId, readings, running, onStart, onReplay, error }: {
  crewId: string;
  readings: Reading[];
  running: boolean;
  onStart: () => void;
  onReplay: () => void;
  error?: string;
}) {
  const elapsed = useElapsed(running);
  const mine = readings.filter((r) => r.crew_id === crewId);
  const run = latestRun(mine, running);
  const taps = run.filter((r) => r.type === "reaction_time");
  const t0 = taps.length ? Date.parse(taps[0].timestamp) : 0;
  const points = taps.map((r) => ({ t: (Date.parse(r.timestamp) - t0) / 1000, ms: Number(r.value) }));
  const last = (type: string) => run.filter((r) => r.type === type).at(-1);
  const sway = mine.filter((r) => r.type === "sway_rms").map((r) => Number(r.value));
  const median = last("reaction_time_median");
  const lapses = last("lapses");
  const source = taps.at(-1)?.source;

  return (
    <Panel title="stand-react" status={running ? "info" : error ? "warn" : undefined}>
      <div className="flex flex-wrap gap-x-4">
        <button type="button" onClick={onStart} disabled={running} className="hover:bg-fg hover:text-bg disabled:text-dim">
          [s] start {RUN_S} s test
        </button>
        <button type="button" onClick={onReplay} className="hover:bg-fg hover:text-bg">
          [r] replay last test
        </button>
      </div>
      {running && <div className="text-ok whitespace-pre">{progressBar(elapsed)}</div>}
      {error && (
        <div>
          <StatusTag status="warn" /> {error}
        </div>
      )}

      <div className="mt-1 max-h-40 overflow-y-auto" aria-live="polite">
        {taps.length === 0 && (
          <div>
            <StatusTag status="off" /> no taps yet
          </div>
        )}
        {taps.map((r, i) => (
          <div key={`${r.timestamp}-${i}`} className="whitespace-pre">
            {`tap ${String(i + 1).padStart(2, "0")}  ${String(r.value).padStart(4)} ms `}
            {Number(r.value) > LAPSE_MS && <StatusTag status="warn" />}
          </div>
        ))}
      </div>
      {source && <div className="text-dim">source: {source}</div>}

      {points.length > 0 && (
        <div className="mt-1 h-32" aria-label="reaction time per tap">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
              <XAxis dataKey="t" type="number" unit=" s" tick={AXIS} stroke={PALETTE.line} />
              <YAxis dataKey="ms" type="number" unit="ms" tick={AXIS} stroke={PALETTE.line} domain={[0, "auto"]} />
              <Tooltip
                isAnimationActive={false}
                cursor={false}
                contentStyle={{ background: PALETTE.bg, border: `1px solid ${PALETTE.line}`, borderRadius: 0, fontFamily: AXIS.fontFamily, fontSize: 12 }}
                itemStyle={{ color: PALETTE.fg }}
              />
              <Scatter data={points} fill={PALETTE.green} isAnimationActive={false} shape={(p: { cx?: number; cy?: number }) => <rect x={(p.cx ?? 0) - 1} y={(p.cy ?? 0) - 1} width={2} height={2} fill={PALETTE.green} />} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-1">
        {sway.length > 0 && (
          <div className="whitespace-pre">
            <Sparkline values={sway} />
            {`  sway_rms ${sway.at(-1)!.toFixed(3)} g`}
          </div>
        )}
        <KeyValue
          rows={[
            ["median", median ? `${median.value} ms` : "--"],
            ["lapses", lapses ? `${lapses.value} (taps over ${LAPSE_MS} ms)` : "--"],
          ]}
        />
      </div>
      <div className="mt-1 text-dim">20 s stage version, inspired by the PVT, not clinically validated</div>
    </Panel>
  );
}
