import { useEffect } from "react";
import { sendMsg, sendTier } from "./useBridgeCommands";
import type { StreamMode } from "./useStream";

// OLED text per tier (plan C7). Used by StationPreview and sent to the station, so both always match.
export const STATION_LINES: Record<0 | 1 | 2 | 3, [string, string]> = {
  0: ["ALL CLEAR", ""],
  1: ["SELF-CARE", "FOLLOW APP STEPS"],
  2: ["ACT NOW", "CREW MED OFFICER"],
  3: ["MESSAGE EARTH", "FLIGHT SURGEON"],
};

/** Exactly what the station gets in MSG: line 1 padded to 16 so line 2 starts on the second OLED row. */
export function stationMessage(tier: 0 | 1 | 2 | 3): string {
  const [l1, l2] = STATION_LINES[tier];
  return l1.padEnd(16) + l2;
}

// Live mode only: on tier change (debounced 500 ms) send the engine tier unchanged, then the OLED text.
export function useStationSync(tier: 0 | 1 | 2 | 3, mode: StreamMode) {
  useEffect(() => {
    if (mode !== "live") return;
    const t = window.setTimeout(async () => {
      await sendTier(tier);
      await sendMsg(stationMessage(tier));
    }, 500);
    return () => window.clearTimeout(t);
  }, [tier, mode]);
}
