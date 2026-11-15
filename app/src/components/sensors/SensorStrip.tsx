// Sensor strip. Owner: Nandini. Props only: the app passes readings, the latest sim message and cabin air.
// Every value carries its source tag, so judges always see what is real hardware, Wokwi simulation or preset data.
import type { ChangeEvent } from "react";
import type { Reading } from "../../types";
import { StatusTag, type TagStatus } from "../term";
import { SIM_ORDER, sourceTag, type ChannelStatus, type SimData, type SourceTag } from "./sim";

export type SensorMode = "station" | "simulation";

interface Props {
  mode: SensorMode;
  onModeChange: (mode: SensorMode) => void;
  scenarios: string[];            // feeds the bridge offers, e.g. ["nominal","hypoxia","fatigue"]
  scenario: string;
  onScenarioChange: (scenario: string) => void;
  readings: Reading[];            // the selected crew member's readings
  sim: SimData | null;            // latest {"kind":"sim"} data, or null
  cabinAir?: { value: number } | null;
  error?: string;
}

const TAG_TEXT: Record<SourceTag, string> = { station: "STATION", simulation: "SIM", preset: "PRESET" };
const STATUS: Record<ChannelStatus, TagStatus> = { green: "ok", amber: "warn", red: "fail" };

const STATION_TYPES: { type: string; label: string; unit: string; pct?: boolean }[] = [
  { type: "reaction_time_median", label: "Reaction time (median)", unit: "ms" },
  { type: "lapses", label: "Lapses (>= 355 ms)", unit: "" },
  { type: "sway_rms", label: "Balance sway", unit: "g" },
  { type: "sleep_hours", label: "Sleep", unit: "h" },
  { type: "mood", label: "Mood (1-5)", unit: "" },
  { type: "stress_prob", label: "Stress (model)", unit: "", pct: true },
];

function Cell({ label, value, tag, status }: { label: string; value: string; tag: SourceTag; status?: TagStatus }) {
  return (
    <div className="min-w-[10rem] flex-1 border border-line px-2 py-1">
      <div className="text-dim">{label}</div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-fg">{value}</span>
        {status && <StatusTag status={status} />}
      </div>
      <div className={tag === "station" ? "text-ok" : tag === "simulation" ? "text-warn" : "text-dim"}>
        [{TAG_TEXT[tag]}]
      </div>
    </div>
  );
}

function latest(readings: Reading[], type: string): Reading | undefined {
  let best: Reading | undefined;
  for (const r of readings) if (r.type === type && (!best || r.timestamp >= best.timestamp)) best = r;
  return best;
}

function fmt(v: Reading["value"], unit: string, pct?: boolean): string {
  if (typeof v !== "number") return String(v);
  if (pct) return `${Math.round(v * 100)}%`;
  return unit ? `${v} ${unit}` : `${v}`;
}

export function SensorStrip(p: Props) {
  const cells =
    p.mode === "simulation"
      ? SIM_ORDER.flatMap((k) => {
          const c = p.sim?.channels[k];
          return c
            ? [<Cell key={k} label={c.label} value={`${c.value} ${c.unit}`} tag="simulation" status={STATUS[c.status]} />]
            : [];
        })
      : [
          ...STATION_TYPES.flatMap(({ type, label, unit, pct }) => {
            const r = latest(p.readings, type);
            return r ? [<Cell key={type} label={label} value={fmt(r.value, unit, pct)} tag={sourceTag(r.source)} />] : [];
          }),
          ...(p.cabinAir
            ? [<Cell key="cabin" label="Cabin air (index)" value={`${p.cabinAir.value}`} tag="station" />]
            : []),
        ];

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <div className="flex border border-line" role="radiogroup" aria-label="Data source">
          {(["station", "simulation"] as SensorMode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={p.mode === m}
              onClick={() => p.onModeChange(m)}
              className={"px-2 py-0.5 " + (p.mode === m ? "bg-fg text-bg" : "text-fg hover:text-ok")}
            >
              {m === "station" ? "Station" : "Simulation"}
            </button>
          ))}
        </div>
        {p.mode === "simulation" && (
          <select
            aria-label="Simulation scenario"
            value={p.scenario}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => p.onScenarioChange(e.target.value)}
            className="border border-line bg-bg px-1 text-fg"
          >
            {p.scenarios.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <span className="text-dim">
          {p.mode === "simulation"
            ? "8-channel ideal system, recorded from Wokwi (ESP32)"
            : "3 physical sensors on the station + preset scenario data"}
        </span>
        {p.error && <span className="text-fail">{p.error}</span>}
      </div>
      {cells.length === 0 ? (
        <div>
          <StatusTag status="off" /> {p.mode === "simulation" ? "waiting for simulation feed" : "no readings yet"}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">{cells}</div>
      )}
    </div>
  );
}
