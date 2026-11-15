import { useCallback, useEffect, useRef, useState } from "react";
import type { CabinAirSample, Reading, StreamMessage } from "../types";
import type { SimData } from "../components/sensors/sim";
import scenario from "../data/scenario_mars_day143.json";

export const BRIDGE_URL: string = import.meta.env.VITE_BRIDGE_URL || "http://localhost:8000";
const WS_URL = `${BRIDGE_URL.replace(/^http/, "ws")}/ws/stream`; // http -> ws, https -> wss
const CABIN_AIR_MAX = 120;
const CONNECT_TIMEOUT_MS = 3000;
const RECONNECT_MS = 3000;
const REPLAY_GAP_MS = 2000;

// Public site (Vercel) or any non-local host: no bridge, replay from saved data only.
const PUBLIC_SITE =
  import.meta.env.VITE_PUBLIC_SITE === "1" || (typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname));

export type StreamMode = "live" | "replay";

// C003 starts every session with 3 earlier STAND-REACT runs as its personal baseline (the engine needs
// 3 runs per crew member before it can flag one), so the first live run on stage is already judged.
// Values: the 3 baseline runs from the Mars day 143 scenario. Dated 3, 2 and 1 days before app start,
// so every live run sorts after them. Source "replay": recorded earlier, not live.
const BASELINE_CREW = "C003";
const BASELINE_RUNS: { median: number; lapses: number; sway: number }[] = [
  { median: 340, lapses: 1, sway: 0.049 },
  { median: 350, lapses: 0, sway: 0.052 },
  { median: 345, lapses: 1, sway: 0.05 },
];

export function baselineSeed(now: number = Date.now()): Record<string, Reading[]> {
  const day = 24 * 60 * 60 * 1000;
  const readings = BASELINE_RUNS.flatMap((run, i) => {
    const timestamp = new Date(now - (BASELINE_RUNS.length - i) * day).toISOString().replace(/\.\d{3}Z$/, "Z");
    const base = { crew_id: BASELINE_CREW, timestamp, source: "replay" as const };
    return [
      { ...base, type: "reaction_time_median", value: run.median, unit: "ms" },
      { ...base, type: "lapses", value: run.lapses, unit: "count" },
      { ...base, type: "sway_rms", value: run.sway, unit: "g" },
    ];
  });
  return { [BASELINE_CREW]: readings };
}
export type SolarEvent = { data: Record<string, unknown>; cached: boolean };

// The serial bridge does not loop: readings arrive only after POST /scenario, /start or /replay.
export function useStream() {
  const [mode, setMode] = useState<StreamMode>(PUBLIC_SITE ? "replay" : "live");
  const [readingsByCrew, setReadingsByCrew] = useState<Record<string, Reading[]>>(() => baselineSeed());
  const [solarEvent, setSolarEvent] = useState<SolarEvent | null>(null);
  const [cabinAir, setCabinAir] = useState<CabinAirSample[]>([]);
  const [sim, setSim] = useState<SimData | null>(null); // latest Wokwi feed line (Simulation mode)
  const modeRef = useRef<StreamMode>(PUBLIC_SITE ? "replay" : "live");
  const playback = useRef<number[]>([]);

  const addReading = useCallback((r: Reading) => {
    setReadingsByCrew((prev) => ({ ...prev, [r.crew_id]: [...(prev[r.crew_id] ?? []), r] }));
  }, []);

  /** Adds readings made in the app (replay-mode STAND-REACT simulation). */
  const addReadings = useCallback((rs: Reading[]) => rs.forEach(addReading), [addReading]);

  const switchMode = useCallback((m: StreamMode) => {
    modeRef.current = m;
    setMode(m);
  }, []);

  useEffect(() => {
    if (PUBLIC_SITE) return; // never open a WebSocket on the public site
    let ws: WebSocket | null = null;
    let connectTimer = 0;
    let retryTimer = 0;
    let stopped = false;

    const connect = () => {
      ws = new WebSocket(WS_URL);
      connectTimer = window.setTimeout(() => {
        if (ws?.readyState !== WebSocket.OPEN) switchMode("replay");
      }, CONNECT_TIMEOUT_MS);
      ws.onopen = () => {
        window.clearTimeout(connectTimer);
        switchMode("live");
      };
      ws.onmessage = (e) => {
        let msg: StreamMessage;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return; // ignore anything that is not JSON
        }
        if (msg.kind === "solar_event") setSolarEvent({ data: msg.data, cached: msg.cached });
        else if (msg.kind === "reading") addReading(msg.data);
        else if (msg.kind === "sim") setSim(msg.data);
        else if (msg.kind === "cabin_air") {
          const sample = msg.data;
          setCabinAir((prev) => [...prev, sample].slice(-CABIN_AIR_MAX));
        }
        // Unknown kinds are ignored (docs/schemas.md: the app ignores kinds it does not know).
      };
      ws.onclose = () => {
        window.clearTimeout(connectTimer);
        if (stopped) return;
        // Dropped or never opened (no bridge): fall back to replay now. onclose clears the connect timer,
        // so without this the app stayed on [LIVE] with no bridge. onopen switches back to live.
        switchMode("replay");
        retryTimer = window.setTimeout(connect, RECONNECT_MS);
      };
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(connectTimer);
      window.clearTimeout(retryTimer);
      ws?.close();
    };
  }, [addReading, switchMode]);

  const stopPlayback = () => {
    playback.current.forEach((t) => window.clearTimeout(t));
    playback.current = [];
  };

  const loadScenario = useCallback(async () => {
    if (modeRef.current === "live") {
      const res = await fetch(`${BRIDGE_URL}/scenario`, { method: "POST" });
      if (!res.ok) throw new Error(`POST /scenario failed: ${res.status}`);
      return;
    }
    stopPlayback();
    playback.current = (scenario as Reading[]).map((r, i) =>
      window.setTimeout(() => addReading(r), (i + 1) * REPLAY_GAP_MS),
    );
  }, [addReading]);

  const resetReadings = useCallback(() => {
    stopPlayback();
    setReadingsByCrew(baselineSeed()); // reset keeps C003's 3 baseline runs
  }, []);

  useEffect(() => stopPlayback, []);

  return { mode, readingsByCrew, solarEvent, cabinAir, sim, loadScenario, resetReadings, addReadings };
}
