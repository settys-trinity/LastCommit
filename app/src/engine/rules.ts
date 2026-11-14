// Rules engine scoring. Owner: Ansh. TypeScript port of data/score_reference.py.
// Rules: docs/knowledge_schema.md. Output shape: docs/engine_contract.md.
// Pure functions, no imports of data, so tests can feed any knowledge/baselines.
// rules.test.ts checks this file against score_reference.py (parity_cases.json).

import type { Baselines, Direction, Indicator, Knowledge, Limit } from "../../../data/knowledge.types.ts";
import type { BodySystemResult, IndicatorResult, Reading, Status } from "../types";

export type { Baselines, Indicator, Knowledge };

/**
 * Readings that build a personal baseline for types with no baseline in baselines.json
 * (station and check-in types). DESIGN_CHOICE: 3, the plan's "3 baseline runs".
 * Those first readings are scored without z (absolute and normal-range limits only).
 */
export const BASELINE_RUNS = 3;

export interface Worst {
  indicator: string;
  status: Status;
  z: number | null;
  reason: string;
  action: string;
}

export interface Scored {
  status: Status;
  z: number | null; // bad-direction z of the latest value, 2 dp; null without a baseline
  reason: string;   // why the limit fired; "" when green
}

const RANK: Record<Status, number> = { green: 0, amber: 1, red: 2 };

// ---------------------------------------------------------------- one indicator

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

function zOf(ind: Indicator, v: number, mean: number | null, spread: number | null): number | null {
  if (mean == null || spread == null) return null;
  const s = effectiveSpread(ind, mean, spread);
  return s > 0 ? badZ((v - mean) / s, ind.direction) : null;
}

const ABS = ["below", "at_or_below", "above", "at_or_above"] as const;

function absHit(l: Limit, v: number, only?: (typeof ABS)[number]): boolean {
  return (
    ((!only || only === "below") && l.below != null && v < l.below) ||
    ((!only || only === "at_or_below") && l.at_or_below != null && v <= l.at_or_below) ||
    ((!only || only === "above") && l.above != null && v > l.above) ||
    ((!only || only === "at_or_above") && l.at_or_above != null && v >= l.at_or_above)
  );
}

/** e.g. "6 h or less", "under 54 mg/dL": the absolute limit the value hits. */
function absText(l: Limit, v: number, u: string): string {
  const k = ABS.find((key) => absHit(l, v, key));
  if (!k) return "";
  const lim = l[k];
  return { below: `under ${lim}${u}`, at_or_below: `${lim}${u} or less`, above: `over ${lim}${u}`, at_or_above: `${lim}${u} or more` }[k];
}

/**
 * Why a limit triggers on the latest value, or null. Same order as score_reference.py:
 * z, then outside_normal, then absolute limits held on each of the last `streak` readings.
 */
function trigger(ind: Indicator, l: Limit, history: number[], mean: number | null, spread: number | null): string | null {
  const v = history[history.length - 1];
  const u = ind.unit === "count" || ind.unit.startsWith("score") ? "" : ` ${ind.unit}`;

  const bz = zOf(ind, v, mean, spread);
  if (l.z != null && bz != null && bz >= l.z) return `${Math.round(bz * 10) / 10} SD worse than own baseline`;

  if (l.outside_normal) {
    const { min, max } = ind.normal_range;
    if (min != null && v < min) return `${v}${u}, under the normal minimum of ${min}${u}`;
    if (max != null && v > max) return `${v}${u}, over the normal maximum of ${max}${u}`;
  }

  if (ABS.some((k) => l[k] != null)) {
    const n = Math.max(1, l.streak);
    const recent = history.slice(-n);
    if (recent.length === n && recent.every((x) => absHit(l, x))) {
      return n > 1 ? `${n} readings in a row at ${absText(l, v, u)}` : `${v}${u} (${absText(l, v, u)})`;
    }
  }
  return null;
}

/** Status of the latest value in `history` (oldest first): red, else amber, else green. */
export function scoreIndicator(ind: Indicator, history: number[], mean: number | null = null, spread: number | null = null): Scored {
  if (history.length === 0) throw new Error(`${ind.type}: empty history`);
  const bz = zOf(ind, history[history.length - 1], mean, spread);
  const z = bz == null ? null : Math.round(bz * 100) / 100;
  const red = trigger(ind, ind.red_limit, history, mean, spread);
  if (red) return { status: "red", z, reason: red };
  const amber = trigger(ind, ind.amber_limit, history, mean, spread);
  if (amber) return { status: "amber", z, reason: amber };
  return { status: "green", z, reason: "" };
}

// ---------------------------------------------------------------- one crew member

/** Baseline for z: baselines.json for lab types, else the first BASELINE_RUNS readings. */
export function baselineFor(
  crewId: string,
  type: string,
  history: number[],
  baselines: Baselines | null,
): { mean: number; spread: number } | null {
  const lab = baselines?.crew[crewId]?.markers[type];
  if (lab) return { mean: lab.mean, spread: lab.spread };
  // The baseline exists from reading BASELINE_RUNS + 1 on; the first runs build it.
  if (history.length <= BASELINE_RUNS) return null;
  const first = history.slice(0, BASELINE_RUNS);
  const mean = first.reduce((a, x) => a + x, 0) / first.length;
  const sd = first.length > 1 ? Math.sqrt(first.reduce((a, x) => a + (x - mean) ** 2, 0) / (first.length - 1)) : 0;
  return { mean, spread: sd };
}

/** red if any indicator is red; amber if 2+ are amber, each correlated_with group counting once. */
export function bodySystemStatus(indicators: Indicator[], results: IndicatorResult[], system: string): Status {
  const byType = new Map(indicators.map((i) => [i.type, i]));
  const mine = results.filter((r) => byType.get(r.indicator)?.body_system === system);
  if (mine.some((r) => r.status === "red")) return "red";
  const groups = new Set(
    mine.filter((r) => r.status === "amber").map((r) => [r.indicator, ...byType.get(r.indicator)!.correlated_with].sort()[0]),
  );
  return groups.size >= 2 ? "amber" : "green";
}

/**
 * Score every indicator for one crew member from all their readings so far.
 * Readings of types not in knowledge.json (per-tap reaction_time, symptom, stress_label, ...)
 * and non-numeric values are ignored.
 */
export function scoreCrew(
  readings: Reading[],
  crewId: string,
  knowledge: Knowledge,
  baselines: Baselines | null,
): { readings: IndicatorResult[]; body_systems: BodySystemResult[]; worst: Worst | null } {
  const mine = readings
    .filter((r) => r.crew_id === crewId && typeof r.value === "number" && Number.isFinite(r.value))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const results: IndicatorResult[] = [];
  let worst: Worst | null = null;

  for (const ind of knowledge.indicators) {
    const history = mine.filter((r) => r.type === ind.type).map((r) => r.value as number);
    if (history.length === 0) continue;
    const b = baselineFor(crewId, ind.type, history, baselines);
    const s = scoreIndicator(ind, history, b?.mean ?? null, b?.spread ?? null);
    results.push({ indicator: ind.type, z: s.z, status: s.status });

    // Worst: red over amber, then the higher z (docs/engine_contract.md). Ties keep knowledge.json order.
    if (
      s.status !== "green" &&
      (!worst || RANK[s.status] > RANK[worst.status] ||
        (RANK[s.status] === RANK[worst.status] && (s.z ?? -Infinity) > (worst.z ?? -Infinity)))
    ) {
      worst = {
        indicator: ind.type,
        status: s.status,
        z: s.z,
        reason: `${ind.type} ${s.status}: ${s.reason}`,
        action: s.status === "red" ? ind.action.red : ind.action.amber,
      };
    }
  }

  const systems = [...new Set(knowledge.indicators.map((i) => i.body_system))];
  const body_systems = systems.map((system) => ({ system, status: bodySystemStatus(knowledge.indicators, results, system) }));
  return { readings: results, body_systems, worst };
}
