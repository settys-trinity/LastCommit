import type { Triage } from "../../types";
import { formatRoundTrip } from "../shell/format";
import { KeyValue, Panel, type TagStatus } from "../term";

const TIER: Record<Triage["tier"], { label: string; cls: string; tag: TagStatus }> = {
  0: { label: "ALL CLEAR", cls: "text-dim", tag: "ok" },
  1: { label: "SELF-CARE", cls: "text-ok", tag: "warn" },
  2: { label: "CREW ACTS NOW", cls: "text-warn", tag: "warn" },
  3: { label: "MESSAGE EARTH", cls: "text-fail", tag: "fail" },
};

// TRIAGE: big tier line in the tier colour (D2: colour = who acts), then the details.
export function TriageCard({ triage }: { triage: Triage }) {
  const t = TIER[triage.tier];
  return (
    <Panel title="triage" status={t.tag}>
      <div className={`text-2xl font-bold ${t.cls}`}>{`TIER ${triage.tier}  ${t.label}`}</div>
      <KeyValue
        rows={[
          ["who_acts", triage.acts],
          ["reason", triage.reason || "--"],
          ["action", triage.action || "--"],
          ["round_trip", formatRoundTrip(triage.round_trip_s)],
          ["safe_wait", `${Math.round(triage.safe_wait_s / 60)} min (design choice)`],
        ]}
      />
    </Panel>
  );
}
