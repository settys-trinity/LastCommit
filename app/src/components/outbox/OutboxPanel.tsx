// Earth outbox. Owner: Nandini. Props only (plan C9); Shreya calls send() in App.tsx.
// Every triage at tier 1+ becomes a report to Earth with a reply countdown = mission round trip,
// run at SPEED_UP (60: the 44 min Mars round trip counts down in 44 s; say so on stage, D15).
//   Tier 3: message Earth, follow the action until the reply arrives.
//   Tier 2: crew medical officer acts now; the report still goes to Earth for the record.
//   Tier 1: crew self-care, logged to Earth.
//   No link (solar conjunction): queued until the link returns.
import { useEffect, useState } from "react";
import type { Triage } from "../../types";
import type { Mission } from "../../engine/delay";
import { formatCountdown, formatRoundTrip } from "../mission/format";

export interface OutboxPacket {
  id: number;
  crewId: string;
  createdAt: number;          // ms, Date.now()
  mission: Mission;
  triage: Triage;
  replyDueAt: number | null;  // ms; null = no link, queued
}

let nextId = 1;

/** Keeps the packet list. Call send() when a new triage at tier >= 1 arrives or the mission changes. */
export function useEarthOutbox(speedUp: number) {
  const [packets, setPackets] = useState<OutboxPacket[]>([]);
  const send = (crewId: string, mission: Mission, triage: Triage) => {
    if (triage.tier === 0) return;
    const now = Date.now();
    const rt = mission.round_trip_s;
    const packet: OutboxPacket = {
      id: nextId++,
      crewId,
      createdAt: now,
      mission,
      triage,
      replyDueAt: rt === null ? null : now + (rt * 1000) / speedUp,
    };
    setPackets((p) => [packet, ...p].slice(0, 10));
  };
  return { packets, send };
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const WHILE_WAITING: Record<Triage["acts"], string> = {
  flight_surgeon: "Follow the action on the triage card until the flight surgeon replies.",
  crew_medical_officer: "Crew medical officer acts now. Report sent for the record; do not wait.",
  crew: "Self-care in progress. Logged for the flight surgeon's next review.",
  none: "",
};

interface Props {
  packets: OutboxPacket[];
  speedUp: number;
}

export function OutboxPanel({ packets, speedUp }: Props) {
  const now = useNow(250);
  return (
    <section className="border border-neutral-700 p-3 font-mono text-sm text-neutral-300">
      <header className="mb-2 flex items-baseline justify-between">
        <h2 className="text-green-400">&gt; earth outbox</h2>
        {speedUp !== 1 && <span className="text-xs text-neutral-500">demo speed x{speedUp}</span>}
      </header>
      {packets.length === 0 && <p className="text-neutral-500">no reports sent</p>}
      <ul className="flex flex-col">
        {packets.map((p) => {
          const remainingS = p.replyDueAt === null ? null : ((p.replyDueAt - now) / 1000) * speedUp;
          const replied = remainingS !== null && remainingS <= 0;
          return (
            <li key={p.id} className="border-t border-neutral-800 py-2 first:border-t-0">
              <div className="flex items-center justify-between">
                <span>
                  #{p.id} {p.crewId} {p.mission.label} tier {p.triage.tier}
                </span>
                {remainingS === null ? (
                  <span className="text-red-400">[QUEUED: NO LINK]</span>
                ) : replied ? (
                  <span className="text-green-400">[REPLY RECEIVED]</span>
                ) : (
                  <span className="text-xl tabular-nums text-neutral-100">reply in {formatCountdown(remainingS)}</span>
                )}
              </div>
              <p className="text-neutral-400">{p.triage.reason}</p>
              <p className="text-xs text-neutral-500">
                {formatRoundTrip(p.mission.round_trip_s)}. {WHILE_WAITING[p.triage.acts]}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
