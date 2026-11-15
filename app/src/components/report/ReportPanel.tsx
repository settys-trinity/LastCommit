// Report panel. Owner: Nandini. Props only.
// Left: the on-board assessment, ready in seconds (time B). Right: Earth's diagnosis, locked until the
// round trip has passed (time A), then shown side by side with Agree / Differ.
// Download PDF = the browser's Save as PDF (cut order 2), printing only this panel.
import { useEffect, useState } from "react";
import { KeyValue, StatusTag } from "../term";
import { mmss, suggestVerdict, type Assessment, type GroundReply, type Verdict } from "./report";

interface Props {
  crewId: string;
  missionLabel: string;
  assessment: Assessment | null;
  loading?: boolean;
  ground: GroundReply | null;
  replyDueAt: number | null;      // ms; when Earth's reply can arrive (null = no link)
  speedUp: number;                 // same demo speed-up as the outbox
  onVerdict?: (v: Verdict) => void;
}

// Save as PDF prints only this panel, dark text on white.
const PRINT_CSS = `@media print {
  body * { visibility: hidden; }
  .farside-report, .farside-report * { visibility: visible; color: #000 !important; }
  .farside-report { position: absolute; left: 0; top: 0; width: 100%; }
  body::after { display: none; }
}`;

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function ReportPanel(p: Props) {
  const now = useNow(250);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  useEffect(() => setVerdict(null), [p.assessment, p.ground]);

  const remainingS = p.replyDueAt === null ? null : ((p.replyDueAt - now) / 1000) * p.speedUp;
  const arrived = remainingS !== null && remainingS <= 0 && p.ground !== null;
  const suggested = arrived && p.assessment && p.ground ? suggestVerdict(p.assessment, p.ground) : null;

  const choose = (v: Verdict) => {
    setVerdict(v);
    p.onVerdict?.(v);
  };

  return (
    <div className="farside-report">
      <style>{PRINT_CSS}</style>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="border border-line p-2">
          <div className="mb-1 flex justify-between">
            <span className="text-ok">ON BOARD (time B)</span>
            {p.assessment && (
              <span className="text-dim">
                answered in {p.assessment.time_b_s.toFixed(1)} s{p.assessment.source === "cache" ? " · cached" : ""}
              </span>
            )}
          </div>
          {p.loading && <div className="text-dim">assessing…</div>}
          {!p.loading && !p.assessment && (
            <div>
              <StatusTag status="off" /> run STAND-REACT or load a scenario
            </div>
          )}
          {p.assessment && (
            <>
              <div className="text-fg">{p.assessment.summary}</div>
              <KeyValue
                rows={[
                  ["tier", String(p.assessment.tier)],
                  ["who_acts", p.assessment.who_acts],
                ]}
              />
              {p.assessment.findings.length > 0 && (
                <ul className="mt-1">
                  {p.assessment.findings.map((f, i) => (
                    <li key={i}>
                      <span className="text-dim">{f.part.padEnd(5, " ")} </span>
                      {f.text}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-1 text-ok">do now</div>
              <ul>
                {p.assessment.do_now.map((a) => (
                  <li key={a}>&gt; {a}</li>
                ))}
              </ul>
              {p.assessment.message_to_earth && (
                <div className="mt-1">
                  <span className="text-dim">sent to Earth: </span>
                  {p.assessment.message_to_earth}
                </div>
              )}
            </>
          )}
        </div>

        <div className="border border-line p-2">
          <div className="mb-1 flex justify-between">
            <span className="text-fg">EARTH (time A)</span>
            <span className="text-dim">{p.missionLabel}</span>
          </div>
          {remainingS === null ? (
            <div>
              <StatusTag status="fail" /> no link: the crew decides alone
            </div>
          ) : !arrived ? (
            <div>
              <div className="text-dim">ground diagnosis arrives in</div>
              <div className="tabular-nums text-fg">{mmss(remainingS)}</div>
              {p.speedUp !== 1 && <div className="text-dim">demo speed x{p.speedUp}</div>}
            </div>
          ) : (
            <>
              <div className="text-fg">{p.ground!.headline}</div>
              <div>{p.ground!.diagnosis}</div>
              <div className="mt-1 text-ok">do now</div>
              <ul>
                {p.ground!.do_now.map((a) => (
                  <li key={a}>&gt; {a}</li>
                ))}
              </ul>
              {p.ground!.avoid.length > 0 && (
                <div className="mt-1">
                  <span className="text-warn">avoid: </span>
                  {p.ground!.avoid.join(" · ")}
                </div>
              )}
              <div className="mt-1 text-dim">{p.ground!.follow_up}</div>
              <div className="text-dim">{p.ground!.from}</div>
            </>
          )}
        </div>
      </div>

      {arrived && p.assessment && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-dim">Earth vs on board:</span>
          {(["agree", "differ"] as Verdict[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => choose(v)}
              aria-pressed={verdict === v}
              className={"border border-line px-2 " + (verdict === v ? "bg-fg text-bg" : "text-fg hover:text-ok")}
            >
              {v === "agree" ? "Agree" : "Differ"}
            </button>
          ))}
          {suggested && !verdict && <span className="text-dim">suggested: {suggested}</span>}
          {verdict && <StatusTag status={verdict === "agree" ? "ok" : "warn"} />}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!p.assessment}
          className="border border-line px-2 text-fg hover:text-ok disabled:text-dim"
        >
          Download PDF
        </button>
        <span className="text-dim">
          {p.crewId} · {p.missionLabel} · decision support, not diagnosis
        </span>
      </div>
    </div>
  );
}
