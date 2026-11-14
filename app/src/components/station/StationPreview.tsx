import { STATION_LINES } from "../../hooks/useStationSync";
import { Panel } from "../term";

const LEDS = [
  { tier: 1, label: "self-care", cls: "text-ok" },
  { tier: 2, label: "crew medical officer", cls: "text-warn" },
  { tier: 3, label: "message earth", cls: "text-fail" },
] as const;

// STATION: what the tier LEDs and the 16x2 OLED text show right now (same text the app sends).
export function StationPreview({ tier }: { tier: 0 | 1 | 2 | 3 }) {
  const [l1, l2] = STATION_LINES[tier];
  return (
    <Panel title="station">
      {LEDS.map((led) => (
        <div key={led.tier} className={`whitespace-pre ${led.tier === tier ? led.cls : "text-dim"}`}>
          {led.tier === tier ? "(●) " : "( ) "}
          {led.label}
          {led.tier === tier ? "  <- on" : ""}
        </div>
      ))}
      <pre aria-label={`OLED: ${l1} ${l2}`} className="m-0 mt-1 leading-tight text-ok">
        {`┌${"─".repeat(16)}┐\n│${l1.padEnd(16)}│\n│${l2.padEnd(16)}│\n└${"─".repeat(16)}┘`}
      </pre>
    </Panel>
  );
}
