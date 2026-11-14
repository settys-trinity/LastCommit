// Scoring for one indicator: TypeScript port of data/score_reference.py.
// Rules: docs/knowledge_schema.md. Keep this file and score_reference.py in step;
// engine/score.test.ts checks them against each other (parity_cases.json).

import type { Direction, Indicator, Limit, Status } from "../data/knowledge.types.ts";

export type { Status };

/** Spread used for z: never below the indicator's floor (min_spread). */
export function effectiveSpread(ind: Indicator, mean: number, spread: number): number {
  const ms = ind.min_spread;
  const floor = ms.mode === "absolute" ? (ms.value ?? 0) : (mean * (ms.cv_pct ?? 0)) / 100;
  return Math.max(spread, floor);
}

/** Deviation in the harmful direction. Positive is worse. */
export function badZ(z: number, direction: Direction): number {
  if (direction === "low_is_bad") return -z;
  if (direction === "high_is_bad") return z;
  return Math.abs(z);
}

/** Bad-direction z of a value, or null when there is no baseline yet. */
export function zOf(ind: Indicator, value: number, mean: number | null, spread: number | null): number | null {
  if (mean == null || spread == null) return null;
  const s = effectiveSpread(ind, mean, spread);
  if (s <= 0) return null; // floor of 0 and no spread: z is undefined
  return badZ((value - mean) / s, ind.direction);
}

function outsideNormal(ind: Indicator, v: number): boolean {
  const { min, max } = ind.normal_range;
  return (min != null && v < min) || (max != null && v > max);
}

const ABS_KEYS = ["below", "at_or_below", "above", "at_or_above"] as const;
const ABS_WORDS = { below: "under", at_or_below: "or less", above: "over", at_or_above: "or more" } as const;

function absHit(limit: Limit, v: number): boolean {
  return (
    (limit.below != null && v < limit.below) ||
    (limit.at_or_below != null && v <= limit.at_or_below) ||
    (limit.above != null && v > limit.above) ||
    (limit.at_or_above != null && v >= limit.at_or_above)
  );
}

/** Text for the absolute limit that the value hits, e.g. "6 h or less". */
function absText(limit: Limit, v: number, unit: string): string {
  for (const k of ABS_KEYS) {
    const lim = limit[k];
    if (lim == null) continue;
    const hit = k === "below" ? v < lim : k === "at_or_below" ? v <= lim : k === "above" ? v > lim : v >= lim;
    if (!hit) continue;
    const u = unit ? ` ${unit}` : "";
    return k === "below" || k === "above" ? `${ABS_WORDS[k]} ${lim}${u}` : `${lim}${u} ${ABS_WORDS[k]}`;
  }
  return "";
}

/**
 * Why a limit triggers, or null if it does not. Same order of checks as score_reference.py:
 * z, then outside_normal, then absolute limits over the last `streak` readings.
 * @param history values oldest to newest; the last one is the current reading.
 */
export function trigger(
  ind: Indicator,
  limit: Limit,
  history: number[],
  mean: number | null,
  spread: number | null,
): string | null {
  const v = history[history.length - 1];
  const unit = ind.unit === "count" || ind.unit.startsWith("score") ? "" : ind.unit;
  const u = unit ? ` ${unit}` : "";

  const bz = zOf(ind, v, mean, spread);
  if (limit.z != null && bz != null && bz >= limit.z) {
    return `${round(bz, 1)} SD worse than own baseline`;
  }
  if (limit.outside_normal && outsideNormal(ind, v)) {
    const { min, max } = ind.normal_range;
    return min != null && v < min ? `${v}${u}, under the normal minimum of ${min}${u}` : `${v}${u}, over the normal maximum of ${max}${u}`;
  }
  if (ABS_KEYS.some((k) => limit[k] != null)) {
    const n = Math.max(1, limit.streak);
    const recent = history.slice(-n);
    if (recent.length === n && recent.every((x) => absHit(limit, x))) {
      const what = absText(limit, v, unit);
      return n > 1 ? `${n} readings in a row at ${what}` : `${v}${u} (${what})`;
    }
  }
  return null;
}

export interface Scored {
  status: Status;
  z: number | null; // bad-direction z of the latest value, rounded to 2 dp
  reason: string;   // "" when green
}

/** Status of the latest value in `history`: red if red_limit triggers, else amber, else green. */
export function scoreIndicator(
  ind: Indicator,
  history: number[],
  mean: number | null = null,
  spread: number | null = null,
): Scored {
  if (history.length === 0) throw new Error(`${ind.type}: empty history`);
  const bz = zOf(ind, history[history.length - 1], mean, spread);
  const z = bz == null ? null : round(bz, 2);
  const red = trigger(ind, ind.red_limit, history, mean, spread);
  if (red) return { status: "red", z, reason: red };
  const amber = trigger(ind, ind.amber_limit, history, mean, spread);
  if (amber) return { status: "amber", z, reason: amber };
  return { status: "green", z, reason: "" };
}

function round(x: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}
