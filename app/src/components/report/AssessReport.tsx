// On-board assessment vs Earth's reply, wired. Owner: Nandini.
// Drop-in for App.tsx: <AssessReport crewId missionId triage readings packet speedUp />.
// Calls Om's POST /assess on the bridge; with no bridge (public site, replay) it uses the same cached
// answers the bridge falls back to, marked "cache". Earth's reply comes from Ansh's ground_replies.json
// and appears only after the round trip. The AI never changes the tier (it is copied from the engine).
import { useEffect, useRef, useState } from "react";
import type { Reading, Triage } from "../../types";
import type { OutboxPacket } from "../outbox/OutboxPanel";
import { getMission, type MissionId } from "../../engine/delay";
import { BRIDGE_URL } from "../../hooks/useStream";
import { StatusTag } from "../term";
import type { Answers } from "../wellbeing/questionnaire";
import groundFile from "../../data/ground_replies.json";
import cache from "./assess_cache.json";
import { ReportPanel } from "./ReportPanel";
import { findGroundReply, type Assessment, type GroundReply } from "./report";

type Scenario = "nominal" | "hypoxia" | "fatigue";
type Cached = Pick<Assessment, "summary" | "findings" | "do_now" | "message_to_earth">;

/** Which pre-written case fits: the cache hint for /assess and the key for Earth's reply. */
export function pickScenario(triage: Triage): Scenario {
  if (triage.tier === 0) return "nominal";
  return /air|oxygen|spo2|co2|hypox/i.test(`${triage.reason} ${triage.action}`) ? "hypoxia" : "fatigue";
}

interface Props {
  crewId: string;
  missionId: MissionId;
  triage: Triage;
  readings: Reading[];
  packet: OutboxPacket | undefined; // latest outbox packet for this crew (gives the reply time)
  speedUp: number;
  checkin?: Answers | null;          // Diksha's 5-question check-in; context for /assess, never the tier (D13)
}

export function AssessReport({ crewId, missionId, triage, readings, packet, speedUp, checkin }: Props) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const readingsRef = useRef(readings);
  readingsRef.current = readings;
  const mission = getMission(missionId);
  const scenario = pickScenario(triage);
  // a new check-in also re-asks, so the answer reflects how the astronaut says they feel
  const key = `${crewId}|${missionId}|${triage.tier}|${triage.reason}|${checkin ? JSON.stringify(checkin) : ""}`;

  useEffect(() => {
    if (triage.tier === 0) {
      setAssessment(null);
      return;
    }
    let cancelled = false;
    const started = performance.now();
    setLoading(true);
    const fallback = (): Assessment => ({
      ...((cache as Record<Scenario, Cached>)[scenario]),
      crew_id: crewId,
      mission: missionId,
      tier: triage.tier,
      who_acts: triage.acts,
      time_b_s: (performance.now() - started) / 1000,
      source: "cache",
      made_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    });
    const body = {
      crew_id: crewId,
      mission: missionId,
      tier: triage.tier,
      who_acts: triage.acts,
      readings: readingsRef.current.slice(-30),
      engine_findings: [triage.reason, triage.action].filter(Boolean),
      scenario,
      ...(checkin ? { questionnaire: checkin } : {}),
    };
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 20_000);
    fetch(`${BRIDGE_URL}/assess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? (r.json() as Promise<Assessment>) : Promise.reject(new Error(`/assess ${r.status}`))))
      .then((a) => !cancelled && setAssessment(a))
      .catch(() => !cancelled && setAssessment(fallback()))
      .finally(() => {
        window.clearTimeout(timer);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearTimeout(timer);
    };
    // re-assess only when the triage, crew or mission changes, not on every reading
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (triage.tier === 0)
    return (
      <div>
        <StatusTag status="ok" /> all clear: no assessment needed, nothing sent to Earth
      </div>
    );

  const ground: GroundReply | null = findGroundReply(groundFile as { replies: GroundReply[] }, scenario);
  return (
    <ReportPanel
      crewId={crewId}
      missionLabel={mission.label}
      assessment={assessment}
      loading={loading}
      ground={ground}
      replyDueAt={packet ? packet.replyDueAt : mission.round_trip_s === null ? null : Date.now()}
      speedUp={speedUp}
    />
  );
}
