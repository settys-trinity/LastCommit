import { STATION_LINES } from "../../hooks/useStationSync";

const LED: Record<0 | 1 | 2 | 3, { name: string; cls: string; who: string }> = {
  0: { name: "OFF", cls: "text-dim", who: "" },
  1: { name: "GREEN", cls: "text-ok", who: "self-care" },
  2: { name: "AMBER", cls: "text-warn", who: "crew medical officer" },
  3: { name: "RED", cls: "text-fail", who: "message Earth" },
};

// One line: what the station's tier LED and OLED screen show right now (same text the app sends, C7).
export function StationLine({ tier }: { tier: 0 | 1 | 2 | 3 }) {
  const led = LED[tier];
  const screen = STATION_LINES[tier].filter(Boolean).join(" / ");
  return (
    <div className="whitespace-pre-wrap">
      <span className="text-dim">station LED </span>
      <span className={`font-bold ${led.cls}`}>● {led.name}</span>
      {led.who && <span className="text-dim"> ({led.who})</span>}
      <span className="text-dim">   screen </span>
      <span>"{screen}"</span>
    </div>
  );
}
