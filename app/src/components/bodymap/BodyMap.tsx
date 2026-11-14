import { useCallback, useEffect, useState } from "react";
import { LazyAstronaut } from "../astronaut/LazyAstronaut";
import { partStatuses, type PartData } from "../astronaut/parts";
import { Panel, StatusTag, type TagStatus } from "../term";
import { BodyViewer } from "./BodyViewer";

const ORDER: TagStatus[] = ["fail", "warn", "ok"];
const SHORT: [string, string][] = [
  ["brain_behaviour", "brain"],
  ["neurovestibular", "vestib"],
  ["metabolism", "metab"],
];
const TAG = { green: "ok", amber: "warn", red: "fail" } as const;

// BODY panel: one small astronaut and a one-line system summary. Click opens the full body view.
export function BodyMap({ data, crewId }: { data: PartData; crewId: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "b" && !e.ctrlKey && !e.metaKey && !e.altKey) setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const scored = data.result.readings.length > 0;
  const tags: TagStatus[] = data.result.body_systems.map((b) => (scored ? TAG[b.status] : "off"));
  const status = ORDER.find((t) => tags.includes(t));

  return (
    <Panel title="body" status={status}>
      {!open && (
        <div className="overflow-x-auto" onClick={() => setOpen(true)}>
          <LazyAstronaut parts={partStatuses(data)} height={220} showList={false} />
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 whitespace-pre">
        {SHORT.map(([sys, short]) => {
          const b = data.result.body_systems.find((x) => x.system === sys);
          return (
            <span key={sys}>
              <StatusTag status={b && scored ? TAG[b.status] : "off"} /> {short}
            </span>
          );
        })}
      </div>
      <button type="button" onClick={() => setOpen(true)} className="hover:bg-fg hover:text-bg">
        [b] open body view
      </button>
      {open && <BodyViewer data={data} crewId={crewId} onClose={close} />}
    </Panel>
  );
}
