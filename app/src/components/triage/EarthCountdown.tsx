import { useEffect, useState } from "react";
import type { OutboxPacket } from "../outbox/OutboxPanel";
import { formatRoundTrip } from "../shell/format";

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** 2640 -> "44:00" (mission time, minutes:seconds). */
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// EARTH REPLY: what the link to Earth means right now, for the latest report from this crew member.
// The round trip is always shown as the round trip (D15); the demo runs it at speedUp (x60: 44 min in 44 s).
export function EarthCountdown({ packet, speedUp }: { packet: OutboxPacket | undefined; speedUp: number }) {
  const now = useNow(250);
  if (!packet) return <div className="text-dim">No report sent. Nothing is waiting on Earth.</div>;

  const safeWait = `safe wait ${Math.round(packet.triage.safe_wait_s / 60)} min (design choice)`;
  if (packet.replyDueAt === null)
    return (
      <div>
        <div className="text-3xl font-bold text-fail">NO LINK TO EARTH</div>
        <div className="mt-1">Report queued until the link returns. Do not wait: the crew acts on its own.</div>
        <div className="text-dim">{safeWait}</div>
      </div>
    );

  const rt = `round trip ${formatRoundTrip(packet.mission.round_trip_s)}${speedUp !== 1 ? ` · demo runs x${speedUp}` : ""} · ${safeWait}`;

  // Earth answers within the safe wait: talk to the flight surgeon now (ISS, Moon).
  if (packet.triage.acts === "flight_surgeon")
    return (
      <div>
        <div className="text-3xl font-bold">EARTH IS IN REACH</div>
        <div className="mt-1">Message the flight surgeon now. Follow DO NOW until they reply.</div>
        <div className="text-dim">{rt}</div>
      </div>
    );

  // Earth is too far to wait for (Mars): the crew acts; the report goes for the record.
  const left = ((packet.replyDueAt - now) / 1000) * speedUp;
  if (left <= 0)
    return (
      <div>
        <div className="text-3xl font-bold text-ok">REPLY FROM EARTH RECEIVED</div>
        <div className="text-dim">{rt}</div>
      </div>
    );
  return (
    <div>
      <div className="text-dim">reply from Earth in</div>
      <div className="text-5xl font-bold tabular-nums">{mmss(left)}</div>
      <div className="mt-1">Do not wait for this reply: act now. The report is for the record.</div>
      <div className="text-dim">{rt}</div>
    </div>
  );
}