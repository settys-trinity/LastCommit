// Mission selector (always visible). Switching ISS -> Mars is the key demo moment:
// the same readings go from "message Earth" (tier 3) to "crew acts now" (tier 2, amber).
import { MISSIONS, MISSION_ORDER, MissionId, formatDelay } from "./missions";

interface Props {
  value: MissionId;
  onChange: (id: MissionId) => void;
}

export function MissionSelector({ value, onChange }: Props) {
  const current = MISSIONS[value];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 rounded-lg bg-slate-800 p-1" role="radiogroup" aria-label="Mission profile">
        {MISSION_ORDER.map((id) => {
          const m = MISSIONS[id];
          const active = id === value;
          return (
            <button
              key={id}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(id)}
              className={
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition " +
                (active ? "bg-sky-500 text-white" : "text-slate-300 hover:bg-slate-700")
              }
            >
              <div>{m.label}</div>
              <div className="text-xs opacity-80">{formatDelay(m.roundTripS)} round trip</div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">
        {current.note}. Source: {current.source}
      </p>
    </div>
  );
}
