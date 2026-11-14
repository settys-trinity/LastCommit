// Mission selector. Owner: Nandini. Props only (plan C9). Missions come from engine/delay.ts (D4).
// Switching ISS -> Mars is the key demo moment: tier 3 (message Earth) -> tier 2 (crew acts now).
// D18: theme colours only; the selected mission is inverse video.
import { MISSIONS, formatRoundTrip } from "./format";

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export function MissionSelector({ value, onChange }: Props) {
  const current = MISSIONS.find((m) => m.id === value);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex border border-line" role="radiogroup" aria-label="Mission profile">
        {MISSIONS.map((m) => {
          const active = m.id === value;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(m.id)}
              className={
                "flex-1 border-r border-line px-2 py-1 text-left last:border-r-0 " +
                (active ? "bg-fg text-bg" : "text-fg hover:text-ok")
              }
            >
              <div>{m.label}</div>
              <div className={active ? "text-bg" : "text-dim"}>{formatRoundTrip(m.round_trip_s)}</div>
            </button>
          );
        })}
      </div>
      {current && <p className="text-dim">source: {current.source}</p>}
    </div>
  );
}
