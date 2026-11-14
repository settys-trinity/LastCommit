import { useEffect, useRef, useState } from "react";
import type { Reading } from "../../types";
import { LazyAstronaut } from "../astronaut/LazyAstronaut";
import { checkinReading, hint, PARTS, partRows, partSeries, partStatuses, type PartData, type PartId } from "../astronaut/parts";
import { KeyValue, Panel, Sparkline, StatusTag } from "../term";

const SLEEP_HOURS = [4, 5, 6, 7, 8, 9];
const MOODS: [number, string][] = [
  [1, "very low"],
  [2, "low"],
  [3, "okay"],
  [4, "good"],
  [5, "very good"],
];
const VIEW_NOTE: Partial<Record<PartId, string>> = {
  abdomen: "A blood draw cannot run on this station. This is the lab result, scored against this person's own pre-flight baseline.",
  backpack: "Read live from the station's gas sensor every 5 s. It describes the cabin, not the crew member, and never sets a tier.",
};

// BODY page: a large astronaut where only the highlighted points are clickable. Hover a point for
// "<part>: click here to run <test>"; click it to run that test, click it again (or press x) to unselect.
// Keys: d dashboard, h home.
export function BodyViewer({ data, crewId, running, onRunTest, onCheckin, onClose }: {
  data: PartData;
  crewId: string;
  running: boolean;
  onRunTest: () => void;
  onCheckin: (r: Reading) => void;
  onClose: () => void;
}) {
  const [part, setPart] = useState<PartId | null>(null);
  const [saved, setSaved] = useState("");
  const closeBtn = useRef<HTMLButtonElement>(null);
  const statuses = partStatuses(data);
  const info = part ? PARTS.find((p) => p.id === part)! : null;
  const series = part ? partSeries(part, data) : [];
  const height = Math.max(460, Math.min(1000, Math.round(window.innerHeight * 0.86)));

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "d") onClose(); // back to the dashboard
      else if (e.key === "h") window.location.assign("/"); // home: the landing page
      else if (e.key === "x") setPart(null); // unselect the test
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const choose = (id: PartId) => {
    setSaved("");
    if (id === part) return setPart(null); // clicking the selected point again unselects it
    setPart(id); // selecting only opens the test; the run button in the panel starts it
  };
  const checkin = (type: "sleep_hours" | "mood", value: number) => {
    onCheckin(checkinReading(crewId, type, value));
    setSaved(type === "sleep_hours" ? `saved: ${value} h sleep` : `saved: mood ${value}`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="body view"
      className="fixed inset-0 z-40 overflow-y-auto bg-bg p-3"
      onClick={(e) => {
        // A click on empty space unselects; markers, buttons, links and the test panel keep the selection.
        if (!(e.target as HTMLElement).closest("button, a, [data-keep]")) setPart(null);
      }}
    >      <Panel title={`body / crew ${crewId}`} status={part ? statuses[part] : undefined}>
        <div className="flex items-center justify-between gap-4">
          <span className="text-dim">click a highlighted point on the astronaut to open its test</span>
          <span className="flex gap-6">
            <button ref={closeBtn} type="button" onClick={onClose} className="hover:bg-fg hover:text-bg">
              [d] dashboard
            </button>
            <a href="/" className="hover:bg-fg hover:text-bg">
              [h] home
            </a>
          </span>
        </div>
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-center">
          <div className="shrink-0">
            <LazyAstronaut parts={statuses} selected={part} onSelect={choose} height={height} showList={false} hotspots look="solid" />
          </div>

          <div data-keep className="w-full min-w-0 lg:w-[60ch] lg:shrink-0">
            {!info && (
              <ul aria-label="tests by body part" className="mb-3">
                {PARTS.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => choose(p.id)} className="w-full text-left hover:text-ok">
                      <StatusTag status={statuses[p.id] ?? "off"} /> {hint(p.id)}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {info && part && (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="text-2xl font-bold uppercase">
                    {info.name} <span className="text-dim">/</span> {info.label}
                  </div>
                  <button type="button" onClick={() => setPart(null)} className="shrink-0 border border-line px-2 hover:bg-fg hover:text-bg">
                    [x] unselect
                  </button>
                </div>
                <div className="mb-2 text-dim">source: {info.source}</div>

                {info.action === "standreact" && (
                  <div className="mb-2">
                    <button type="button" onClick={onRunTest} disabled={running} className="border border-fg px-2 py-1 hover:bg-fg hover:text-bg disabled:border-dim disabled:text-dim">
                      {running ? "test running: tap the pad and stand still" : "[ run 20 s STAND-REACT ]"}
                    </button>
                    <div className="mt-1 text-dim">one 20 s run measures reaction time (hands), lapses (brain) and sway (legs) together</div>
                  </div>
                )}

                {info.action === "sleep" && (
                  <div className="mb-2">
                    <div>how many hours did you sleep last night?</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {SLEEP_HOURS.map((h) => (
                        <button key={h} type="button" onClick={() => checkin("sleep_hours", h)} className="border border-line px-2 py-1 hover:bg-fg hover:text-bg">
                          {h === 9 ? "9+" : h} h
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {info.action === "mood" && (
                  <div className="mb-2">
                    <div>how do you feel right now?</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {MOODS.map(([n, word]) => (
                        <button key={n} type="button" onClick={() => checkin("mood", n)} className="border border-line px-2 py-1 hover:bg-fg hover:text-bg">
                          {n} {word}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {VIEW_NOTE[part] && <div className="mb-2">{VIEW_NOTE[part]}</div>}
                {saved && (
                  <div className="mb-2">
                    <StatusTag status="ok" /> {saved}
                  </div>
                )}

                <div className="border-t border-line pt-1">
                  <div className="mb-1">
                    <StatusTag status={statuses[part] ?? "off"} /> result
                  </div>
                  <KeyValue rows={partRows(part, data)} />
                  {series.length > 1 && (
                    <div className="mt-1">
                      <Sparkline values={series} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}