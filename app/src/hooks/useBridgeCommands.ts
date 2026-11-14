import { useCallback, useEffect, useRef } from "react";
import type { Reading } from "../types";
import { BRIDGE_URL, type StreamMode } from "./useStream";

export type CommandResult = { ok: boolean; error?: string };

// Bridge errors in words (firmware/README.md section 6).
const ERRORS: Record<number, string> = {
  400: "unknown crew id",
  404: "no finished test to replay yet",
  409: "test already running",
  503: "station not connected",
};

/** POST to the bridge. Never throws. */
export async function post(path: string, body?: unknown): Promise<CommandResult> {
  try {
    const res = await fetch(`${BRIDGE_URL}${path}`, {
      method: "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res.ok ? { ok: true } : { ok: false, error: ERRORS[res.status] ?? `${path} failed: HTTP ${res.status}` };
  } catch {
    return { ok: false, error: `bridge unreachable at ${BRIDGE_URL}` };
  }
}

export const sendTier = (n: 0 | 1 | 2 | 3) => post("/tier", { n });
export const sendMsg = (text: string) => post("/msg", { text });

const LAPSE_MS = 355; // same as bridge/station.py LAPSE_MS and knowledge.json (D7)
const SIM_TAPS = 8;
const SIM_GAP_MS = 2000;

/** Replay-mode STAND-REACT run: 8 taps 2 s apart, then sway, median and lapses (bridge order). */
export function simulatedRun(crewId: string, start = Date.now(), rand = Math.random): Reading[] {
  const at = (ms: number) => new Date(start + ms).toISOString().replace(/\.\d{3}Z$/, "Z");
  const r = (type: string, value: number, unit: string, ms: number): Reading => ({
    crew_id: crewId, timestamp: at(ms), type, value, unit, source: "replay",
  });
  const taps = Array.from({ length: SIM_TAPS }, () => Math.round(280 + rand() * 170));
  const sorted = [...taps].sort((a, b) => a - b);
  const median = (sorted[3] + sorted[4]) / 2;
  const endMs = SIM_TAPS * SIM_GAP_MS;
  return [
    ...taps.map((ms, i) => r("reaction_time", ms, "ms", (i + 1) * SIM_GAP_MS)),
    r("sway_rms", 0.05, "g", endMs),
    r("reaction_time_median", median, "ms", endMs),
    r("lapses", taps.filter((ms) => ms > LAPSE_MS).length, "count", endMs),
  ];
}

// Bridge commands for the app. Each returns { ok, error? } and never throws.
// In replay mode startTest/replayLast simulate the station locally.
export function useBridgeCommands(mode: StreamMode, addReadings: (rs: Reading[]) => void) {
  const timers = useRef<number[]>([]);
  const lastSim = useRef<Reading[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const play = useCallback(
    (run: Reading[]) => {
      const t0 = Date.parse(run[0].timestamp);
      timers.current = run.map((rd) =>
        window.setTimeout(() => addReadings([{ ...rd, timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z") }]), Date.parse(rd.timestamp) - t0),
      );
    },
    [addReadings],
  );

  const startTest = useCallback(
    async (crewId: string, durationS = 20): Promise<CommandResult> => {
      if (mode === "live") return post("/start", { crew_id: crewId, duration_s: durationS });
      lastSim.current = simulatedRun(crewId);
      play(lastSim.current);
      return { ok: true };
    },
    [mode, play],
  );

  const replayLast = useCallback(async (): Promise<CommandResult> => {
    if (mode === "live") return post("/replay");
    if (lastSim.current.length === 0) return { ok: false, error: ERRORS[404] };
    play(lastSim.current);
    return { ok: true };
  }, [mode, play]);

  const arm = useCallback((crewId: string) => post("/arm", { crew_id: crewId, duration_s: 20 }), []);

  return { startTest, arm, sendTier, sendMsg, replayLast };
}
