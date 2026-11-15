// Check-in questionnaire: questions, flags, labels and points all come from Ansh's data/questionnaire.json
// (copy in app/src/data). Answers are assessment input only: they are not readings and never change the tier (D13).
import file from "../../data/questionnaire.json";

/** The five answers, as sent to POST /assess (bridge/assess.py, Questionnaire). */
export type Answers = { mood: number; sleep_h: number; stress: number; focus: number; symptom: string };
export type AnswerId = keyof Answers;

export type Question =
  | { id: AnswerId; text: string; type: "scale"; min: number; max: number; labels?: Record<string, string> }
  | { id: AnswerId; text: string; type: "number"; min: number; max: number; step: number }
  | { id: AnswerId; text: string; type: "choice"; options: string[] };

type Flag = { id: AnswerId; flag_if: string; message: string };
type Overall = { flags?: number; flags_at_least?: number; label: string };
type File = {
  questions: Question[];
  scoring: { flags: Flag[]; overall: Overall[]; offer_breathing_if: string };
  points: { questionnaire: number; breathing_session: number };
};

const Q = file as unknown as File;
export const QUESTIONS = Q.questions;
export const POINTS = Q.points;

/** "value <= 3", "value != 'none'" -> true/false for one answer. Unknown rules never flag. */
export function test(rule: string, value: number | string): boolean {
  const m = rule.trim().match(/^(\w+)\s*(<=|>=|!=|==|<|>)\s*'?([\w.]+)'?$/);
  if (!m) return false;
  const [, , op, raw] = m;
  const target = Number.isNaN(Number(raw)) ? raw : Number(raw);
  switch (op) {
    case "<=": return Number(value) <= Number(target);
    case ">=": return Number(value) >= Number(target);
    case "<": return Number(value) < Number(target);
    case ">": return Number(value) > Number(target);
    case "==": return value === target;
    case "!=": return value !== target;
  }
  return false;
}

export type Score = { flags: { id: AnswerId; message: string }[]; label: string; offerBreathing: boolean };

/** Flags, overall label and whether to offer breathing, by Ansh's rules. */
export function score(a: Answers): Score {
  const flags = Q.scoring.flags.filter((f) => test(f.flag_if.replace(/^value/, f.id), a[f.id])).map((f) => ({ id: f.id, message: f.message }));
  const n = flags.length;
  const overall = Q.scoring.overall.find((o) => (o.flags !== undefined ? o.flags === n : n >= (o.flags_at_least ?? Infinity)));
  // "mood <= 3 or stress >= 4": each part names its own answer.
  const offerBreathing = Q.scoring.offer_breathing_if
    .split(/\s+or\s+/)
    .some((part) => {
      const id = part.trim().split(/\s/)[0] as AnswerId;
      return id in a && test(part, a[id]);
    });
  return { flags, label: overall?.label ?? "", offerBreathing };
}
