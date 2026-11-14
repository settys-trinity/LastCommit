// Owner: Ansh. Pre-flight lab baselines for one crew member, from NASA OSDR (Inspiration4).
// Props only (contract C9). Mount in App.tsx:
//   import { BaselinePanel } from "./components/baseline/BaselinePanel";
//   <BaselinePanel crewId={crewId} />
import { TIMEPOINTS, baselineRows, fmt, studyUrl } from "./baselineRows";

export function BaselinePanel({ crewId }: { crewId: string }) {
  const rows = baselineRows(crewId);
  const studies = [...new Set(rows.map((r) => r.study))];

  return (
    <section aria-labelledby="baseline-title" className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-slate-100">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="baseline-title" className="text-base font-semibold">NASA OSDR Inspiration4 baseline</h2>
        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300">{crewId}</span>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-300">
          No pre-flight baseline for {crewId}. Lab readings are compared with the clinical reference range only.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-300">
            Pre-flight blood draws 92, 44 and 3 days before launch. New lab values are compared with this person's own
            mean and spread.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm tabular-nums">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th scope="col" className="py-1 pr-3 font-medium">Marker</th>
                  {TIMEPOINTS.map((tp) => (
                    <th key={tp} scope="col" className="py-1 pr-3 text-right font-medium">{tp}</th>
                  ))}
                  <th scope="col" className="py-1 pr-3 text-right font-medium">Mean ± spread</th>
                  <th scope="col" className="py-1 text-right font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.type} className="border-t border-slate-800">
                    <th scope="row" className="py-1.5 pr-3 font-normal">
                      <span className="block">{r.label}</span>
                      <span className="text-xs text-slate-400">
                        {r.unit}
                        {r.scored && <span className="ml-2 rounded bg-sky-900 px-1.5 text-sky-200">scored</span>}
                      </span>
                    </th>
                    {r.draws.map((d) => (
                      <td
                        key={d.timepoint}
                        className={`py-1.5 pr-3 text-right ${d.outsideRange ? "font-semibold text-amber-300" : ""}`}
                        title={d.outsideRange ? "Outside the reference range" : undefined}
                      >
                        {d.value === null ? "–" : fmt(d.value)}
                      </td>
                    ))}
                    <td className="py-1.5 pr-3 text-right">
                      {fmt(r.mean)} ± {fmt(r.spread)}
                      {r.spreadIsFloor && (
                        <span className="text-slate-400" title="Spread raised to the biological-variation floor"> *</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right text-slate-300">
                      {fmt(r.refRange[0])}–{fmt(r.refRange[1])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            {rows.some((r) => r.spreadIsFloor) && "* spread raised to the biological-variation floor. "}
            Amber values are outside the lab's reference range. 4 crew with 3 draws each: shows the method, not a
            medical finding. Source:{" "}
            {studies.map((s, i) => (
              <span key={s}>
                {i > 0 && ", "}
                <a href={studyUrl(s)} target="_blank" rel="noreferrer" className="underline hover:text-slate-200">
                  NASA OSDR {s}
                </a>
              </span>
            ))}
            .
          </p>
        </>
      )}
    </section>
  );
}
