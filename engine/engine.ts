// FARSIDE rules engine. Takes `reading` objects (docs/schemas.md section 1) one at a time
// and returns an `engine_result` (docs/engine_contract.md) after each one.
//
//   const engine = new Engine(knowledge, baselines, { round_trip_s: 2640 }); // Mars demo
//   const result = engine.ingest(reading);   // null if the reading type is not an indicator
//
// The delay router (tier 2 vs 3) is Shreya's. A default that follows the contract is
// built in; pass `router` to use hers.

import type { Baselines, Indicator, Knowledge, Status } from "../data/knowledge.types.ts";
import { scoreIndicator } from "./score.ts";

export type { Status };

export interface Reading {
  crew_id: string;
  timestamp: string;
  type: string;
  value: number | string | boolean;
  unit: string;
  source: string;
}

export interface IndicatorResult { indicator: string; z: number | null; status: Status }
export interface BodySystemResult { system: string; status: Status }
export type Acts = "none" | "crew" | "crew_medical_officer" | "flight_surgeon";

export interface Triage {
  tier: 0 | 1 | 2 | 3;
  reason: string;
  action: string;
  acts: Acts;
  round_trip_s: number | null;
  safe_wait_s: number;
}

export interface EngineResult {
  crew_id: string;
  timestamp: string;
  readings: IndicatorResult[];
  body_systems: BodySystemResult[];
  triage: Triage;
}

/** Decides tier 2 or 3 for a red finding. */
export type Router = (round_trip_s: number | null, safe_wait_s: number) => { tier: 2 | 3; acts: Acts };

/** Contract rule: wait for Earth only when the round trip fits inside the safe wait. */
export const defaultRouter: Router = (rt, sw) =>
  rt != null && rt <= sw ? { tier: 3, acts: "flight_surgeon" } : { tier: 2, acts: "crew_medical_officer" };

export interface EngineOptions {
  /** Mission round trip in seconds (docs/delay_table.md). null = no link (solar conjunction). */
  round_trip_s?: number | null;
  /** 600 s placeholder, UNSOURCED (docs/schemas.md "Safe wait"). */
  safe_wait_s?: number;
  /**
   * Readings used to build a personal baseline for types with no baseline in baselines.json
   * (station and check-in types). DESIGN_CHOICE: 3, matching the plan's "3 baseline runs".
   */
  baseline_runs?: number;
  router?: Router;
}

interface Baseline { mean: number; spread: number; from: "baselines.json" | "runtime" | "set" }

const RANK: Record<Status, number> = { green: 0, amber: 1, red: 2 };

export class Engine {
  readonly indicators = new Map<string, Indicator>();
  readonly systems: string[] = [];
  private history = new Map<string, number[]>();      // `${crew}|${type}` -> values
  private baselines = new Map<string, Baseline>();     // `${crew}|${type}` -> baseline
  private latest = new Map<string, Map<string, { status: Status; z: number | null; reason: string }>>();
  private opts: Required<EngineOptions>;

  constructor(knowledge: Knowledge, baselines?: Baselines, opts: EngineOptions = {}) {
    for (const ind of knowledge.indicators) {
      this.indicators.set(ind.type, ind);
      if (!this.systems.includes(ind.body_system)) this.systems.push(ind.body_system);
    }
    for (const [crew, c] of Object.entries(baselines?.crew ?? {})) {
      for (const [type, m] of Object.entries(c.markers)) {
        this.baselines.set(`${crew}|${type}`, { mean: m.mean, spread: m.spread, from: "baselines.json" });
      }
    }
    this.opts = {
      round_trip_s: opts.round_trip_s ?? null,
      safe_wait_s: opts.safe_wait_s ?? 600,
      baseline_runs: opts.baseline_runs ?? 3,
      router: opts.router ?? defaultRouter,
    };
  }

  /** Switch mission (the app's mission selector). Re-run `result()` to see the new triage. */
  setRoundTrip(round_trip_s: number | null): void {
    this.opts.round_trip_s = round_trip_s;
  }

  /** Set a personal baseline by hand, e.g. from earlier sessions. */
  setBaseline(crew_id: string, type: string, mean: number, spread: number): void {
    this.baselines.set(`${crew_id}|${type}`, { mean, spread, from: "set" });
  }

  getBaseline(crew_id: string, type: string): Baseline | undefined {
    return this.baselines.get(`${crew_id}|${type}`);
  }

  /** Clear one crew member's readings (and runtime baselines), e.g. on "Replay last test". */
  reset(crew_id?: string): void {
    for (const map of [this.history, this.baselines]) {
      for (const k of [...map.keys()]) {
        if (crew_id && !k.startsWith(`${crew_id}|`)) continue;
        if (map === this.baselines && this.baselines.get(k)!.from === "baselines.json") continue;
        map.delete(k);
      }
    }
    if (crew_id) this.latest.delete(crew_id);
    else this.latest.clear();
  }

  /**
   * Score one reading and return the crew member's full result.
   * Returns null for readings the engine does not score: types not in knowledge.json
   * (per-tap reaction_time, symptom, stress_label, ...) and non-numeric values.
   */
  ingest(r: Reading): EngineResult | null {
    const ind = this.indicators.get(r.type);
    if (!ind || typeof r.value !== "number" || !Number.isFinite(r.value)) return null;

    const key = `${r.crew_id}|${r.type}`;
    const hist = this.history.get(key) ?? [];
    hist.push(r.value);
    this.history.set(key, hist);

    const b = this.baselines.get(key);
    const scored = scoreIndicator(ind, hist, b?.mean ?? null, b?.spread ?? null);

    // Build a runtime baseline from the first `baseline_runs` readings. Those readings
    // are scored before it exists, so they only use absolute and normal-range limits.
    if (!b && hist.length >= this.opts.baseline_runs) {
      const first = hist.slice(0, this.opts.baseline_runs);
      const mean = first.reduce((a, x) => a + x, 0) / first.length;
      const sd = first.length > 1 ? Math.sqrt(first.reduce((a, x) => a + (x - mean) ** 2, 0) / (first.length - 1)) : 0;
      this.baselines.set(key, { mean, spread: sd, from: "runtime" });
    }

    const crew = this.latest.get(r.crew_id) ?? new Map();
    crew.set(r.type, scored);
    this.latest.set(r.crew_id, crew);
    return this.result(r.crew_id, r.timestamp);
  }

  /** Current result for a crew member without adding a reading (e.g. after setRoundTrip). */
  result(crew_id: string, timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z")): EngineResult {
    const crew = this.latest.get(crew_id) ?? new Map();
    const readings: IndicatorResult[] = [];
    for (const type of this.indicators.keys()) {
      const s = crew.get(type);
      if (s) readings.push({ indicator: type, z: s.z, status: s.status });
    }
    const body_systems = this.systems.map((system) => ({ system, status: this.systemStatus(system, readings) }));
    return { crew_id, timestamp, readings, body_systems, triage: this.triage(crew) };
  }

  /** red if any indicator is red; amber if 2+ are amber, a correlated_with group counting once. */
  private systemStatus(system: string, readings: IndicatorResult[]): Status {
    const mine = readings.filter((r) => this.indicators.get(r.indicator)!.body_system === system);
    if (mine.some((r) => r.status === "red")) return "red";
    const amber = mine.filter((r) => r.status === "amber").map((r) => r.indicator);
    const groups: string[][] = [];
    for (const t of amber) {
      const linked = new Set([t, ...this.indicators.get(t)!.correlated_with]);
      const g = groups.find((grp) => grp.some((x) => linked.has(x) || this.indicators.get(x)!.correlated_with.includes(t)));
      if (g) g.push(t);
      else groups.push([t]);
    }
    return groups.length >= 2 ? "amber" : "green";
  }

  private triage(crew: Map<string, { status: Status; z: number | null; reason: string }>): Triage {
    const { round_trip_s, safe_wait_s, router } = this.opts;
    // Worst indicator: red over amber, then the higher z (contract). Ties keep knowledge.json order.
    let worst: { type: string; status: Status; z: number | null; reason: string } | null = null;
    for (const type of this.indicators.keys()) {
      const s = crew.get(type);
      if (!s || s.status === "green") continue;
      if (
        !worst ||
        RANK[s.status] > RANK[worst.status] ||
        (RANK[s.status] === RANK[worst.status] && (s.z ?? -Infinity) > (worst.z ?? -Infinity))
      ) {
        worst = { type, ...s };
      }
    }
    if (!worst) return { tier: 0, reason: "", action: "", acts: "none", round_trip_s, safe_wait_s };

    const ind = this.indicators.get(worst.type)!;
    const reason = `${worst.type} ${worst.status}: ${worst.reason}`;
    if (worst.status === "amber") {
      return { tier: 1, reason, action: ind.action.amber, acts: "crew", round_trip_s, safe_wait_s };
    }
    const { tier, acts } = router(round_trip_s, safe_wait_s);
    return { tier, reason, action: ind.action.red, acts, round_trip_s, safe_wait_s };
  }
}
