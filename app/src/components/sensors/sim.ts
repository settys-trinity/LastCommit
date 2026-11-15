// Simulation-mode types and helpers. Owner: Nandini.
// Shape copied from bridge/sim.py (daksh/sim-mode): {"kind":"sim","data":SimData}, one per second.
// Display data only, like cabin_air: never a crew reading, never sent to the rules engine.

export type ChannelStatus = "green" | "amber" | "red";
export type SimChannelKey = "spo2" | "hr" | "rr" | "sbp" | "skin_c" | "tilt_deg" | "co2_ppm" | "rt_ms";

export interface SimChannel {
  value: number;
  unit: string;
  label: string;
  status: ChannelStatus;
}

export interface SimData {
  timestamp: string;
  source: "simulation";
  scenario: string;
  channels: Partial<Record<SimChannelKey, SimChannel>>;
  worst: ChannelStatus;
  mission?: string;
  tier?: number;
  who_acts?: string;
}

export const SIM_ORDER: SimChannelKey[] = ["spo2", "hr", "rr", "sbp", "skin_c", "tilt_deg", "co2_ppm", "rt_ms"];

/** Source tag shown next to every value: station hardware, Wokwi simulation, or preset scenario data. */
export type SourceTag = "station" | "simulation" | "preset";

/** Reading.source -> on-screen tag. Scenario replay, check-in and the saved stress feed are presets. */
export function sourceTag(source: string): SourceTag {
  if (source === "station") return "station";
  if (source === "simulation") return "simulation";
  return "preset";
}

/** Bridge calls for the Station / Simulation switch (bridge/serial_bridge.py: POST /sim, POST /sim/stop). */
export async function startSim(bridgeUrl: string, scenario: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${bridgeUrl}/sim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario, speed: 1.0, loop: true }),
    });
    return res.ok ? { ok: true } : { ok: false, error: `POST /sim ${res.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function stopSim(bridgeUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${bridgeUrl}/sim/stop`, { method: "POST" });
    return res.ok ? { ok: true } : { ok: false, error: `POST /sim/stop ${res.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
