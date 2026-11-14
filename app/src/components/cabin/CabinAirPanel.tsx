import type { CabinAirSample } from "../../types";
import { KeyValue, Panel, Sparkline, StatusTag } from "../term";

const BASELINE_N = 12; // first minute at one sample per 5 s

/** Baseline = mean of the first 12 samples; change = latest vs baseline in percent. Null until 12 samples. */
export function cabinChange(values: number[]): { baseline: number; changePct: number } | null {
  if (values.length < BASELINE_N) return null;
  const baseline = values.slice(0, BASELINE_N).reduce((a, b) => a + b, 0) / BASELINE_N;
  if (baseline === 0) return null;
  return { baseline, changePct: ((values[values.length - 1] - baseline) / baseline) * 100 };
}

// CABIN AIR: uncalibrated gas sensor index shown only as change from the session start (docs/schemas.md).
export function CabinAirPanel({ samples }: { samples: CabinAirSample[] }) {
  const values = samples.map((s) => s.value);
  const c = cabinChange(values);
  return (
    <Panel title="cabin air">
      {samples.length === 0 ? (
        <div>
          <StatusTag status="off" /> waiting for station
        </div>
      ) : (
        <>
          <Sparkline values={values.slice(-60)} />
          <KeyValue
            rows={[
              [
                "change",
                c ? `${c.changePct >= 0 ? "+" : ""}${c.changePct.toFixed(1)}% from session start` : `collecting baseline (${values.length}/${BASELINE_N})`,
              ],
            ]}
          />
          <div className="text-dim">uncalibrated sensor index</div>
        </>
      )}
    </Panel>
  );
}
