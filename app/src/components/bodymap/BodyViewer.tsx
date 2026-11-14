import { useEffect, useRef, useState } from "react";
import { LazyAstronaut } from "../astronaut/LazyAstronaut";
import { PARTS, partRows, partSeries, partStatuses, type PartData, type PartId } from "../astronaut/parts";
import { KeyValue, Panel, Sparkline, StatusTag } from "../term";

// Full-screen body view: large detailed astronaut, every part clickable and tied to its live data. Esc closes.
export function BodyViewer({ data, crewId, onClose }: { data: PartData; crewId: string; onClose: () => void }) {
  const [part, setPart] = useState<PartId>("hands");
  const closeBtn = useRef<HTMLButtonElement>(null);
  const statuses = partStatuses(data);
  const info = PARTS.find((p) => p.id === part)!;
  const series = partSeries(part, data);
  const height = Math.min(640, Math.round(window.innerHeight * 0.72));

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="body view" className="fixed inset-0 z-40 overflow-y-auto bg-bg p-3">
      <Panel title={`body / crew ${crewId}`} status={statuses[part]}>
        <div className="flex justify-end">
          <button ref={closeBtn} type="button" onClick={onClose} className="hover:bg-fg hover:text-bg">
            [esc] close
          </button>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="shrink-0 overflow-x-auto">
            <LazyAstronaut parts={statuses} selected={part} onSelect={setPart} height={height} detail="high" showList={false} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-dim">click a part of the suit, or pick one:</div>
            <ul aria-label="astronaut parts" className="mb-3">
              {PARTS.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setPart(p.id)}
                    aria-pressed={p.id === part}
                    className={`w-full text-left ${p.id === part ? "bg-fg text-bg" : "hover:text-ok"}`}
                  >
                    <StatusTag status={statuses[p.id] ?? "off"} /> {p.id.padEnd(9)} {p.label}
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-line pt-1">
              <div className="uppercase">{info.label}</div>
              <div className="text-dim">source: {info.source}</div>
              <KeyValue rows={partRows(part, data)} />
              {series.length > 1 && (
                <div className="mt-1">
                  <Sparkline values={series} />
                </div>
              )}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
