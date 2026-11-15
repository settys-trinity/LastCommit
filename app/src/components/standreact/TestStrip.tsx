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

// NEXT STEP: one big start button (a progress bar and the live last tap while running), the run's taps as they
// arrive (lapses marked * and in amber, not by colour alone), and the last result on one line.
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
  const tapReadings = run.filter((r) => r.type === "reaction_time");
  const taps = tapReadings.length;
  const lastTap = tapReadings.at(-1);
  const slow = (r: Reading) => Number(r.value) > LAPSE_MS;
  // Where the taps came from: the real station, or the replay/simulation. Live taps prove the hardware on stage.
  const from = lastTap ? (lastTap.source === "station" ? "live from the station" : `source: ${lastTap.source}`) : "";
  const median = last("reaction_time_median");
  const lapses = last("lapses");
  const sway = last("sway_rms");

  return (
    <div>
      {running ? (
        <div className="border border-ok px-3 py-2 text-xl whitespace-pre-wrap text-ok">
          {`TEST RUNNING  ${progressBar(elapsed)}  taps ${taps}`}
          {lastTap && (
            <span className={slow(lastTap) ? "text-warn" : "text-fg"}>
              {`  · last ${lastTap.value} ms`}
              {slow(lastTap) && " [WARN]"}
            </span>
          )}
        </div>
      ) : (
        <button type="button" onClick={onStart} className="w-full border border-fg px-3 py-2 text-left text-xl font-bold hover:bg-fg hover:text-bg">
          [s] START 20 s TEST
        </button>
      )}
      {tapReadings.length > 0 && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3" aria-live="polite">
          <span className="text-dim">{running ? "taps" : "last taps"}</span>
          {tapReadings.slice(-12).map((r, i) => (
            <span key={`${r.timestamp}-${i}`} className={`tabular-nums ${slow(r) ? "text-warn" : ""}`}>
              {`${r.value}${slow(r) ? "*" : ""}`}
            </span>
          ))}
          <span className="text-dim">ms · * over {LAPSE_MS} ms (lapse) · {from}</span>
        </div>
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
