import { useState } from "react";
import type { EngineResult, Status } from "../../types";
import type { BodySystem } from "../astronaut/AsciiAstronaut";
import { LazyAstronaut } from "../astronaut/LazyAstronaut";
import { Panel, StatusTag, type TagStatus } from "../term";
import knowledge from "../../data/knowledge.json";

const TAG: Record<Status, TagStatus> = { green: "ok", amber: "warn", red: "fail" };
const WORST: TagStatus[] = ["fail", "warn", "ok"];

// BODY panel: ASCII astronaut coloured by body system; selecting one lists its indicators.
export function BodyMap({ result }: { result: EngineResult }) {
  const [selected, setSelected] = useState<BodySystem | null>(null);
  const systems = Object.fromEntries(result.body_systems.map((b) => [b.system, b.status])) as Partial<
    Record<BodySystem, Status>
  >;
  const tags = result.body_systems.map((b) => TAG[b.status]);
  const status = WORST.find((t) => tags.includes(t));
  const indicators = knowledge.indicators.filter((i) => i.body_system === selected);

  return (
    <Panel title="body" status={status}>
      <div className="overflow-x-auto">
        <LazyAstronaut systems={systems} onSelect={setSelected} height={300} />
      </div>
      {selected && (
        <div className="mt-2 border-t border-line pt-1">
          <div className="uppercase text-dim">{selected}</div>
          {indicators.map((i) => {
            const r = result.readings.find((x) => x.indicator === i.type);
            return (
              <div key={i.type} className="whitespace-pre-wrap">
                <StatusTag status={r ? TAG[r.status] : "off"} /> {i.indicator}
                <span className="text-dim">
                  {"  "}
                  {r?.z != null ? `z ${r.z.toFixed(1)}` : "baseline pending"}  hazards: {i.hazards.join(", ")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
