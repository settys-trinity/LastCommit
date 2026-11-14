// OutboxPanel (Earth outbox): every triage at tier 1+ is packed into a report for the flight surgeon.
// Shows a reply countdown = mission round trip (sped up for the demo, and we say so on stage).
//   Tier 3: crew follows waiting instructions until the reply arrives.
//   Tier 2: crew medical officer acts now; packet still goes to Earth for the record.
//   Tier 1: self-care, logged to Earth.
//   No link (solar conjunction): packet is queued until the link returns.
import { useEffect, useState } from "react";
import { Mission, formatCountdown, formatDelay } from "./missions";

// Same shape as docs/engine_contract.md
export interface Triage {
  tier: 0 | 1 | 2 | 3;
  reason: string;
  action: string;
  acts: "none" | "crew" | "crew_medical_officer" | "flight_surgeon";
  round_trip_s: number | null;
  safe_wait_s: number;
}

export interface OutboxPacket {
  id: number;
  crewId: string;
  createdAt: number;        // ms, Date.now()
  mission: Mission;
  triage: Triage;
  replyDueAt: number | null; // ms; null = no link, queued
}

let nextId = 1;

/** Hook: keeps the packet list. Call send() when a new triage at tier >= 1 arrives. */
export function useEarthOutbox(speedUp = 1) {
  const [packets, setPackets] = useState<OutboxPacket[]>([]);
  const send = (crewId: string, mission: Mission, triage: Triage) => {
    if (triage.tier === 0) return;
    const now = Date.now();
    const rt = mission.roundTripS;
    setPackets((p) => [
      { id: nextId++, crewId, createdAt: now, mission, triage,
        replyDueAt: rt === null ? null : now + (rt * 1000) / speedUp },
      ...p,
    ].slice(0, 10));
  };
  const clear = () => setPackets([]);
  return { packets, send, clear };
}

function useNow(intervalMs = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const WHILE_WAITING: Record<Triage["acts"], string> = {
  flight_surgeon: "Follow the action on the triage card and stay on the channel until the flight surgeon replies.",
  crew_medical_officer: "Crew medical officer acts now. This report is for the record; do not wait for the reply.",
  crew: "Self-care in progress. Logged for the flight surgeon's next review.",
  none: "",
};

interface Props {
  packets: OutboxPacket[];
  speedUp: number;
}

export function OutboxPanel({ packets, speedUp }: Props) {
  const now = useNow();
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Earth outbox</h2>
        {speedUp !== 1 && (
          <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-300">
            demo speed x{speedUp}
          </span>
        )}
      </header>
      {packets.length === 0 && <p className="text-sm text-slate-400">No reports sent.</p>}
      <ul className="flex flex-col gap-3">
        {packets.map((p) => {
          const remainingS = p.replyDueAt === null ? null : ((p.replyDueAt - now) / 1000) * speedUp;
          const replied = remainingS !== null && remainingS <= 0;
          return (
            <li key={p.id} className="rounded-lg bg-slate-800 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono">
                  #{p.id} · {p.crewId} · {p.mission.label} · tier {p.triage.tier}
                </span>
                {remainingS === null ? (
                  <span className="text-red-300">Queued: no link</span>
                ) : replied ? (
                  <span className="text-green-300">Reply received</span>
                ) : (
                  <span className="font-mono text-2xl tabular-nums text-sky-300">
                    {formatCountdown(remainingS)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-300">{p.triage.reason}</p>
              <p className="mt-1 text-xs text-slate-400">
                Round trip {formatDelay(p.mission.roundTripS)}. {WHILE_WAITING[p.triage.acts]}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
