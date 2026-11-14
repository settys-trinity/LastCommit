// Stress vs mood panel. Owner: Nandini. Props only (plan C9): no WebSocket, no evaluate().
// Shreya frames it in <Panel title="stress / mood"> (App.tsx). D18: theme colours, status as text tags.
// A flag on this panel only: it never changes the triage tier (D13).
import type { Reading } from "../../types";
import { KeyValue, Sparkline, StatusTag } from "../term";
import { checkStressMood } from "./stressMoodCheck";

interface Props {
  crewId: string;
  readings: Reading[]; // everything received so far, any order
}

export function StressMoodPanel({ crewId, readings }: Props) {
  const mine = readings
    .filter((r) => r.crew_id === crewId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const probs = mine.filter((r) => r.type === "stress_prob").map((r) => Number(r.value));
  const moods = mine.filter((r) => r.type === "mood");
  const mood = moods.length ? Number(moods[moods.length - 1].value) : null;
  const check = checkStressMood(mood, probs);
  const replayed = mine.some((r) => r.type === "stress_prob" && r.source === "ml_saved");
  const recent = probs.slice(-20);
  const stressed = recent.filter((p) => p >= 0.5).length;

  return (
    <div>
      <div>
        {check.flag ? <StatusTag status="warn" /> : <StatusTag status={check.result === "consistent" ? "ok" : "off"} />}{" "}
        {check.flag ? "mismatch" : check.result.split("_").join(" ")}
      </div>
      <KeyValue
        rows={[
          ["body (stress model)", check.stressLevel === null ? "--" : `${Math.round(check.stressLevel * 100)}% stress`],
          ["self-report (mood 1-5)", mood ?? "--"],
          [
            "windows",
            recent.length ? (
              <span>
                <Sparkline values={recent} /> {stressed}/{recent.length} windows &ge; 0.5
              </span>
            ) : (
              "--"
            ),
          ],
        ]}
      />
      <div className={check.flag ? "text-warn" : "text-fg"}>{check.message}</div>
      {replayed && (
        <div className="text-dim">
          Stress feed replays held-out WESAD subject S17 (never in training), standing in for a Bio-Monitor shirt.
          Not the person on stage. Model: 91.6% accuracy on unseen people, heart and breathing only.
        </div>
      )}
    </div>
  );
}
