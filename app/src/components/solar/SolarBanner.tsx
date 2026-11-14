import type { SolarEvent } from "../../hooks/useStream";
import { StatusTag } from "../term";

/** "2024-05-09T13:59:00-SEP-001" + "2024-05-09T13:59Z" -> "2024-05-09T13:59 SEP-001  instruments: 1". */
export function solarLine(data: Record<string, unknown>): string {
  const id = String(data.sepID ?? "");
  const time = String(data.eventTime ?? "").replace(/Z$/, "");
  const sep = id.split("-").slice(-2).join("-");
  const n = Array.isArray(data.instruments) ? data.instruments.length : 0;
  return `${time} ${sep}  instruments: ${n}`;
}

// One log line for the cached DONKI solar particle event. Renders nothing without an event.
export function SolarBanner({ solarEvent }: { solarEvent: SolarEvent | null }) {
  if (!solarEvent) return null;
  return (
    <div className="whitespace-pre-wrap">
      <StatusTag status="info" /> NASA DONKI solar particle event {solarLine(solarEvent.data)}
      {solarEvent.cached && <span className="text-dim">  (cached)</span>}
    </div>
  );
}
