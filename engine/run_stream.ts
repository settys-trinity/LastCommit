// Connect to the bridge stream, run every reading through the engine and print the triage.
//
//   python -m uvicorn mock_server:app --app-dir bridge --port 8000      (terminal 1)
//   node engine/run_stream.ts [round_trip_s|iss|moon|mars|conjunction] [ws url]   (terminal 2)
//
// Default mission is Mars (2640 s round trip, docs/delay_table.md demo value).
import { readFileSync } from "node:fs";

import { Engine, type Reading } from "./engine.ts";

const MISSIONS: Record<string, number | null> = { iss: 0.5, moon: 2.6, mars: 2640, conjunction: null };
const arg = (process.argv[2] ?? "mars").toLowerCase();
const roundTrip = arg in MISSIONS ? MISSIONS[arg] : Number(arg);
const url = process.argv[3] ?? "ws://localhost:8000/ws/stream?speed=4";

const load = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const engine = new Engine(load("../data/knowledge.json"), load("../data/baselines.json"), { round_trip_s: roundTrip });

const COLOUR = { green: "\x1b[32m", amber: "\x1b[33m", red: "\x1b[31m" } as const;
const OFF = "\x1b[0m";
const TIER_STATUS = ["green", "amber", "amber", "red"] as const; // tier 2 = crew acts now = amber LED

let seen = 0;
const ws = new WebSocket(url);
ws.onopen = () => console.log(`connected to ${url}, round trip ${roundTrip ?? "none (no link)"} s`);
ws.onerror = () => console.error(`cannot connect to ${url}: is the bridge running?`);
ws.onmessage = (ev) => {
  const msg = JSON.parse(String(ev.data));
  if (msg.kind === "solar_event") {
    console.log(`solar event ${msg.data.sepID}${msg.cached ? " (cached)" : ""}`);
    return;
  }
  if (msg.kind !== "reading") return;
  const r: Reading = msg.data;
  const res = engine.ingest(r);
  const head = `${r.timestamp} ${r.crew_id} ${r.type}=${r.value}`;
  if (!res) {
    console.log(`${head}  (not scored)`);
  } else {
    const t = res.triage;
    const c = COLOUR[TIER_STATUS[t.tier]];
    const systems = res.body_systems.map((b) => `${b.system}:${b.status}`).join(" ");
    console.log(`${head}  ${c}tier ${t.tier} ${t.acts}${OFF}  ${t.reason}\n    ${systems}`);
  }
  // The mock loops forever; stop after one pass of the scenario.
  if (++seen >= 10) ws.close();
};
