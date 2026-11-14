// Owner: Ansh. Pre-flight lab baselines for one crew member, from NASA OSDR (Inspiration4).
// Props only (contract C9), terminal style (D18): Panel, KeyValue, StatusTag, theme colours.
//   import { BaselinePanel } from "./components/baseline/BaselinePanel";
//   <BaselinePanel crewId={crewId} />
import { Fragment, type ReactNode } from "react";
import { KeyValue, Panel, StatusTag } from "../term";
import { TIMEPOINTS, baselineRows, fmt, studyUrl } from "./baselineRows";

export function BaselinePanel({ crewId }: { crewId: string }) {
  const rows = baselineRows(crewId);

  if (rows.length === 0) {
    return (
      <Panel title="baseline" status="off">
        <div className="text-dim">no pre-flight baseline for {crewId}: lab values use the reference range only</div>
      </Panel>
    );
  }

  const studies = [...new Set(rows.map((r) => r.study))];
  return (
    <Panel title="baseline" status="info">
      <div className="text-dim">NASA OSDR Inspiration4, pre-flight draws {TIMEPOINTS.join(" ")}</div>
      <KeyValue
        rows={rows.map((r): [string, ReactNode] => [
          r.label,
          <>
            {/* line 1: the three draws, out-of-range ones tagged; line 2: mean ± spread and the reference range */}
            <div className="whitespace-pre-wrap">
              {r.draws.map((d, i) => (
                <Fragment key={d.timepoint}>
                  {i > 0 && "  "}
                  <span className={d.outsideRange ? "text-warn" : undefined}>{d.value === null ? "--" : fmt(d.value)}</span>
                  {d.outsideRange && (
                    <>
                      {" "}
                      <StatusTag status="warn" />
                    </>
                  )}
                </Fragment>
              ))}
              {r.scored && <span className="text-ok">{"  scored"}</span>}
            </div>
            <div className="whitespace-pre-wrap text-dim">
              {`${fmt(r.mean)} ± ${fmt(r.spread)}${r.spreadIsFloor ? "*" : ""} ${r.unit}  ref ${fmt(r.refRange[0])}-${fmt(r.refRange[1])}`}
            </div>
          </>,
        ])}
      />
      <div className="text-dim">
        {rows.some((r) => r.spreadIsFloor) && "* spread raised to the biological-variation floor. "}
        [WARN] = outside the lab reference range. 4 crew, 3 draws each: shows the method, not a medical finding.
      </div>
      <div className="text-dim">
        source:{" "}
        {studies.map((s, i) => (
          <Fragment key={s}>
            {i > 0 && ", "}
            <a href={studyUrl(s)} target="_blank" rel="noreferrer" className="text-fg underline">
              NASA OSDR {s}
            </a>
          </Fragment>
        ))}
      </div>
    </Panel>
  );
}
