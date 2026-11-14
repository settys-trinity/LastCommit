import { useCallback, useEffect, useRef, useState } from "react";
import type { Reading, StreamMessage } from "../types";
import scenario from "../data/scenario_mars_day143.json";

const BRIDGE = "localhost:8000";
const WS_URL = `ws://${BRIDGE}/ws/stream`;
const HTTP_URL = `http://${BRIDGE}`;
const CONNECT_TIMEOUT_MS = 3000;
const RECONNECT_MS = 3000;
const REPLAY_GAP_MS = 2000;

export type StreamMode = "live" | "replay";
export type SolarEvent = { data: Record<string, unknown>; cached: boolean };

// The serial bridge does not loop: readings arrive only after POST /scenario, /start or /replay.
export function useStream() {
  const [mode, setMode] = useState<StreamMode>("live");
  const [readingsByCrew, setReadingsByCrew] = useState<Record<string, Reading[]>>({});
  const [solarEvent, setSolarEvent] = useState<SolarEvent | null>(null);
  const modeRef = useRef<StreamMode>("live");
  const playback = useRef<number[]>([]);

  const addReading = useCallback((r: Reading) => {
    setReadingsByCrew((prev) => ({ ...prev, [r.crew_id]: [...(prev[r.crew_id] ?? []), r] }));
  }, []);

  const switchMode = useCallback((m: StreamMode) => {
    modeRef.current = m;
    setMode(m);
  }, []);

  useEffect(() => {
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
      };
      ws.onclose = () => {
        window.clearTimeout(connectTimer);
        if (stopped) return;
        // Dropped or never opened: retry. Stays in replay mode until a connection opens.
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
      const res = await fetch(`${HTTP_URL}/scenario`, { method: "POST" });
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
    setReadingsByCrew({});
  }, []);

  useEffect(() => stopPlayback, []);

  return { mode, readingsByCrew, solarEvent, loadScenario, resetReadings };
}
