// TEMP STUB. Owner: Ansh. Replace the body with the real scoring from data/score_reference.py (docs/knowledge_schema.md). Keep this signature.
// shortcut: no baselines, so z is always null and z limits never trigger; only absolute, streak and outside_normal limits apply.
import type { BodySystemResult, IndicatorResult, Reading, Status } from "../types";
import knowledge from "../data/knowledge.json";

interface Limit {
  outside_normal: boolean;
  below: number | null;
  at_or_below: number | null;
  above: number | null;
  at_or_above: number | null;
  streak: number;
}

interface Indicator {
  type: string;
  body_system: string;
  unit: string;
  correlated_with: string[];
  normal_range: { min: number | null; max: number | null };
  amber_limit: Limit;
  red_limit: Limit;
  action: { amber: string; red: string };
}

const INDICATORS = knowledge.indicators as Indicator[];
const RANK: Record<Status, number> = { green: 0, amber: 1, red: 2 };

export interface Worst {
  indicator: string;
  status: Status;
  z: number | null;
  reason: string;
  action: string;
}

function outsideNormal(ind: Indicator, v: number): boolean {
  const { min, max } = ind.normal_range;
  return (min !== null && v < min) || (max !== null && v > max);
}

function absHit(l: Limit, v: number): boolean {
  return (
    (l.below !== null && v < l.below) ||
    (l.at_or_below !== null && v <= l.at_or_below) ||
    (l.above !== null && v > l.above) ||
    (l.at_or_above !== null && v >= l.at_or_above)
  );
}

function absText(l: Limit, unit: string): string {
  const parts: string[] = [];
  if (l.below !== null) parts.push(`below ${l.below} ${unit}`);
  if (l.at_or_below !== null) parts.push(`at ${l.at_or_below} ${unit} or less`);
  if (l.above !== null) parts.push(`above ${l.above} ${unit}`);
  if (l.at_or_above !== null) parts.push(`at ${l.at_or_above} ${unit} or more`);
  return parts.join(" or ");
}

/** Why the limit triggers on the latest value in history (oldest..newest), or null if it does not. */
function trigger(ind: Indicator, l: Limit, history: number[]): string | null {
  const v = history[history.length - 1];
  if (l.outside_normal && outsideNormal(ind, v)) return `${v} ${ind.unit} outside normal range`;
  const hasAbs = [l.below, l.at_or_below, l.above, l.at_or_above].some((x) => x !== null);
  const n = l.streak || 1;
  const recent = history.slice(-n);
  if (hasAbs && recent.length === n && recent.every((x) => absHit(l, x))) {
    return n > 1 ? `${n} readings ${absText(l, ind.unit)}` : `${v} ${ind.unit}, ${absText(l, ind.unit)}`;
  }
  return null;
}

export function score(
  readings: Reading[],
  crewId: string,
): { readings: IndicatorResult[]; body_systems: BodySystemResult[]; worst: Worst | null } {
  const mine = readings
    .filter((r) => r.crew_id === crewId && typeof r.value === "number")
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const results: IndicatorResult[] = [];
  const amberGroups: Record<string, Set<string>> = {};
  const redSystems = new Set<string>();
  let worst: Worst | null = null;

  for (const ind of INDICATORS) {
    const history = mine.filter((r) => r.type === ind.type).map((r) => r.value as number);
    if (history.length === 0) continue;

    const red = trigger(ind, ind.red_limit, history);
    const amber = red ? null : trigger(ind, ind.amber_limit, history);
    const status: Status = red ? "red" : amber ? "amber" : "green";
    results.push({ indicator: ind.type, z: null, status });

    if (status === "red") redSystems.add(ind.body_system);
    if (status === "amber") {
      // Correlated indicators count as one amber (docs/engine_contract.md).
      const group = [ind.type, ...ind.correlated_with].sort()[0];
      (amberGroups[ind.body_system] ??= new Set()).add(group);
    }
    // Ties keep the first indicator: z is always null in this stub.
    if (status !== "green" && (!worst || RANK[status] > RANK[worst.status])) {
      worst = {
        indicator: ind.type,
        status,
        z: null,
        reason: `${ind.type} ${status}: ${red ?? amber}`,
        action: status === "red" ? ind.action.red : ind.action.amber,
      };
    }
  }

  const systems = [...new Set(INDICATORS.map((i) => i.body_system))];
  const body_systems: BodySystemResult[] = systems.map((system) => ({
    system,
    status: redSystems.has(system) ? "red" : (amberGroups[system]?.size ?? 0) >= 2 ? "amber" : "green",
  }));

  return { readings: results, body_systems, worst };
}
