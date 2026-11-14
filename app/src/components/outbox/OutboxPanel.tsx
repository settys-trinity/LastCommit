// Earth outbox. Owner: Nandini. Props only (plan C9); Shreya calls send() in App.tsx and frames it in <Panel>.
// Every triage at tier 1+ becomes a report to Earth with a reply countdown = mission round trip,
// run at SPEED_UP (60: the 44 min Mars round trip counts down in 44 s; say so on stage, D15).
//   Tier 3: message Earth, follow the action until the reply arrives.
//   Tier 2: crew medical officer acts now; the report still goes to Earth for the record.
//   Tier 1: crew self-care, logged to Earth.
//   No link (solar conjunction): queued until the link returns.
import { useEffect, useState } from "react";
import type { Triage } from "../../types";
import type { Mission } from "../../engine/delay";
import { StatusTag } from "../term";
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
    <div>
      {speedUp !== 1 && <div className="text-dim">demo speed x{speedUp}</div>}
      {packets.length === 0 && <div className="text-dim">no reports sent</div>}
      <ul>
        {packets.map((p) => {
          const remainingS = p.replyDueAt === null ? null : ((p.replyDueAt - now) / 1000) * speedUp;
          const replied = remainingS !== null && remainingS <= 0;
          return (
            <li key={p.id} className="border-t border-line py-1 first:border-t-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-fg">
                  #{p.id} {p.crewId} {p.mission.label} tier {p.triage.tier}
                </span>
                {remainingS === null ? (
                  <span>
                    <StatusTag status="fail" /> queued: no link
                  </span>
                ) : replied ? (
                  <span>
                    <StatusTag status="ok" /> reply received
                  </span>
                ) : (
                  <span className="tabular-nums text-fg">reply in {formatCountdown(remainingS)}</span>
                )}
              </div>
              <div className="text-fg">{p.triage.reason}</div>
              <div className="text-dim">
                {formatRoundTrip(p.mission.round_trip_s)}. {WHILE_WAITING[p.triage.acts]}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
