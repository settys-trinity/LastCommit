import { useEffect, useState } from "react";
import { Panel, StatusTag } from "../term";
import { BoxBreathing } from "./BoxBreathing";
import { POINTS, QUESTIONS, score, type AnswerId, type Answers, type Question } from "./questionnaire";

const opt = "border border-line px-3 py-1 hover:bg-fg hover:text-bg";
const on = "border border-fg bg-fg px-3 py-1 text-bg";

// WELLBEING page: Ansh's 5-question check-in (about 30 s) and the 1-minute box-breathing circle.
// Answers go to App (for POST /assess); they never change the tier (D13). Keys: d dashboard, h home.
export function WellbeingView({ crewId, answers, points, breaths,onSubmit, onBreathingDone, onClose }: {
  crewId: string;
  answers: Answers | null;
  points: number;
  breaths: number;
  onSubmit: (a: Answers) => void;
  onBreathingDone: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Partial<Answers>>(answers ?? {});
  const [submitted, setSubmitted] = useState<Answers | null>(answers);
  const result = submitted ? score(submitted) : null;
  const complete = QUESTIONS.every((q) => draft[q.id] !== undefined);
  const set = (id: AnswerId, v: number | string) => setDraft((d) => ({ ...d, [id]: v }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "d") onClose();
      else if (e.key === "h") window.location.assign("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    if (!complete) return;
    const a = draft as Answers;
    setSubmitted(a);
    onSubmit(a);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="wellbeing" className="fixed inset-0 z-40 overflow-y-auto bg-bg p-3">
      <Panel title={`wellbeing / crew ${crewId}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-dim">a 30-second check-in and a 1-minute breathing break · points {points}</span>
          <span className="flex gap-6">
            <button type="button" onClick={onClose} className="hover:bg-fg hover:text-bg">[d] dashboard</button>
            <a href="/" className="hover:bg-fg hover:text-bg">[h] home</a>
          </span>
        </div>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          {/* Check-in */}
          <section>
            <div className="mb-3 text-xl font-bold">CHECK-IN</div>
            <ol className="flex flex-col gap-5">
              {QUESTIONS.map((q, i) => (
                <li key={q.id}>
                  <div className="mb-2 text-lg">
                    <span className="text-dim">{i + 1}. </span>
                    {q.text}
                  </div>
                  <QuestionInput q={q} value={draft[q.id]} onPick={(v) => set(q.id, v)} />
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={submit}
              disabled={!complete}
              className="mt-5 w-full border border-fg px-3 py-2 text-left text-xl font-bold hover:bg-fg hover:text-bg disabled:border-line disabled:text-dim disabled:hover:bg-transparent"
            >
              {complete ? `[ SUBMIT CHECK-IN  +${POINTS.questionnaire} points ]` : "[ answer all 5 to submit ]"}
            </button>
          </section>

          {/* Result and breathing */}
          <section className="flex flex-col gap-6">
            {result && submitted && (
              <div>
                <div className="mb-2 text-xl font-bold">RESULT</div>
                <div className={`px-3 py-2 text-2xl font-bold ${result.flags.length === 0 ? "border border-ok text-ok" : result.flags.length === 1 ? "bg-ok text-bg" : "bg-warn text-bg"}`}>
                  {result.label}
                </div>
                <ul className="mt-2 flex flex-col gap-1">
                  {result.flags.length === 0 && (
                    <li>
                      <StatusTag status="ok" /> Nothing to flag. Keep your routine.
                    </li>
                  )}
                  {result.flags.map((f) => (
                    <li key={f.id}>
                      <StatusTag status="warn" /> {f.message}
                    </li>
                  ))}
                </ul>
                <div className="mt-1 text-dim">Self-report only: it informs the on-board assessment and never changes the tier.</div>
              </div>
            )}

            <div>
              <div className="mb-2 text-xl font-bold">BREATHING BREAK</div>
              {breaths > 0 && (
                <div className="mb-2">
                <StatusTag status="ok" /> breathing done {breaths}× this session
                </div>
              )}
              {result?.offerBreathing && (
                <div className="mb-2">
                  <StatusTag status="info" /> Your answers suggest a short breathing break.
                </div>
              )}
              <BoxBreathing onDone={onBreathingDone} />
              <div className="mt-1 text-center text-dim">+{POINTS.breathing_session} points when the minute is done</div>
            </div>
          </section>
        </div>
      </Panel>
    </div>
  );
}

// One question's buttons: a 1-5 scale, a +/- stepper for hours, or a list of choices.
function QuestionInput({ q, value, onPick }: { q: Question; value: number | string | undefined; onPick: (v: number | string) => void }) {
  switch (q.type) {
    case "scale": {
      const { min, max, labels } = q;
      return (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: max - min + 1 }, (_, k) => min + k).map((n) => (
            <button key={n} type="button" onClick={() => onPick(n)} className={value === n ? on : opt}>
              {n}
              {labels?.[String(n)] && <span className="ml-2 text-sm">{labels[String(n)]}</span>}
            </button>
          ))}
        </div>
      );
    }
    case "number": {
      const { min, max, step } = q;
      const v = typeof value === "number" ? value : undefined;
      const nudge = (d: number) => onPick(v === undefined ? 7 : Math.min(max, Math.max(min, v + d)));
      return (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => nudge(-step)} className={opt} aria-label="less">−</button>
          <span className="w-24 text-center text-2xl font-bold tabular-nums">{v === undefined ? "--" : `${v} h`}</span>
          <button type="button" onClick={() => nudge(step)} className={opt} aria-label="more">+</button>
          {v === undefined && <span className="text-dim">press − or + (starts at 7 h)</span>}
        </div>
      );
    }
    case "choice": {
      const { options } = q;
      return (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <button key={o} type="button" onClick={() => onPick(o)} className={value === o ? on : opt}>
              {o}
            </button>
          ))}
        </div>
      );
    }
  }
}