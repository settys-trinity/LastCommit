// Owner: Ansh. Real scoring (data/score_reference.py rules, in rules.ts) behind the app's signature.
// knowledge.json and baselines.json here are copies of data/; keep them identical.
import type { BodySystemResult, IndicatorResult, Reading } from "../types";
import baselinesJson from "../data/baselines.json";
import knowledgeJson from "../data/knowledge.json";
import { type Baselines, type Knowledge, type Worst, scoreCrew } from "./rules";

export type { Worst };

const KNOWLEDGE = knowledgeJson as unknown as Knowledge;
const BASELINES = baselinesJson as unknown as Baselines;

export function score(
  readings: Reading[],
  crewId: string,
): { readings: IndicatorResult[]; body_systems: BodySystemResult[]; worst: Worst | null } {
  return scoreCrew(readings, crewId, KNOWLEDGE, BASELINES);
}
