import { useEffect, useState } from "react";
import type { Reading } from "../../types";
import { StatusTag } from "../term";
import { latestRun, progressBar } from "./StandReactView";

const LAPSE_MS = 355; // bridge/station.py LAPSE_MS (D7)

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

// NEXT STEP: one big start button (a progress bar while running) and the last result on one line.
// The full tap log and chart live in StandReactView; the per-part results live in the body view.
export function TestStrip({ crewId, readings, running, onStart, onReplay, error }: {
  crewId: string;
  readings: Reading[];
  running: boolean;
  onStart: () => void;
  onReplay: () => void;
  error?: string;
}) {
  const elapsed = useElapsed(running);
  const run = latestRun(readings.filter((r) => r.crew_id === crewId), running);
  const last = (type: string) => run.filter((r) => r.type === type).at(-1);
  const taps = run.filter((r) => r.type === "reaction_time").length;
  const median = last("reaction_time_median");
  const lapses = last("lapses");
  const sway = last("sway_rms");

  return (
    <div>
      {running ? (
        <div className="border border-ok px-3 py-2 text-xl whitespace-pre text-ok">{`TEST RUNNING  ${progressBar(elapsed)}  taps ${taps}`}</div>
      ) : (
        <button type="button" onClick={onStart} className="w-full border border-fg px-3 py-2 text-left text-xl font-bold hover:bg-fg hover:text-bg">
          [s] START 20 s TEST
        </button>
      )}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4">
        <span className="text-dim">last test</span>
        {median ? (
          <span>{`median ${median.value} ms · ${lapses?.value ?? "--"} ${Number(lapses?.value) === 1 ? "lapse" : "lapses"} (over ${LAPSE_MS} ms) · sway ${sway ? `${Number(sway.value).toFixed(3)} g` : "--"}`}</span>
        ) : (
          <span className="text-dim">none yet</span>
        )}
        <button type="button" onClick={onReplay} className="text-dim hover:bg-fg hover:text-bg">
          [r] replay last test
        </button>
      </div>
      {error && (
        <div className="mt-1">
          <StatusTag status="warn" /> {error}
        </div>
      )}
      <div className="mt-1 text-dim">20 s stage version, inspired by the PVT, not clinically validated</div>
    </div>
  );
}
