// Report data types and the agree/differ comparison. Owner: Nandini.
// Assessment = Om's POST /assess output (on board, "time B"); ground = Ansh's data/ground_replies.json
// (Earth's reply, shown only once the round trip has passed, "time A").


export type BodyPart = "head" | "chest" | "arm" | "legs" | "air";

/** Om's POST /assess response (bridge, 14 Nov 23:00). The AI never changes the tier. */
export interface Assessment {
  crew_id: string;
  mission: string;                 // "iss" | "moon" | "mars" | "conjunction"
  tier: 0 | 1 | 2 | 3;             // copied from the engine
  who_acts: string;
  summary: string;                 // one or two plain sentences
  findings: { part: BodyPart; text: string }[];
  do_now: string[];
  message_to_earth: string;
  time_b_s: number;                // seconds the on-board answer took
  source: "live" | "cache";        // cache when the AI took over 15 s
  made_at: string;
}

/** One entry of Ansh's data/ground_replies.json ("replies"); simulated flight surgeon reply. */
export interface GroundReply {
  scenario: string;                // "nominal" | "hypoxia" | "fatigue" | ...
  from: string;
  headline: string;
  diagnosis: string;
  do_now: string[];
  avoid: string[];
  follow_up: string;
}

/** Pick the reply for a scenario from ground_replies.json ({meta, replies}). */
export function findGroundReply(file: { replies: GroundReply[] }, scenario: string): GroundReply | null {
  return file.replies.find((r) => r.scenario === scenario) ?? null;
}

export type Verdict = "agree" | "differ";

/** Simple overlap so the panel can suggest agree/differ; the crew still makes the call. */
export function suggestVerdict(a: Assessment, g: GroundReply): Verdict {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const ours = new Set(a.do_now.map(norm));
  const shared = g.do_now.map(norm).filter((x) => ours.has(x)).length;
  return shared > 0 || g.do_now.length === 0 ? "agree" : "differ";
}

/** "43:12" */
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
