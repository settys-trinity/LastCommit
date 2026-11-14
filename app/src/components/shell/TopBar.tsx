import type { ReactNode } from "react";
import type { StreamMode } from "../../hooks/useStream";
import { CrewSelector } from "./CrewSelector";

// One-line status bar: "FARSIDE │ crew C003 │ mission MARS │ link 44 min │ [LIVE]" plus bracketed text buttons.
export function TopBar({ crewId, onCrewChange, missionLabel, link, missionSlot, mode, onLoadScenario, onReset }: {
  crewId: string;
  onCrewChange: (id: string) => void;
  missionLabel: string;
  link: string;
  missionSlot: ReactNode;
  mode: StreamMode;
  onLoadScenario: () => void;
  onReset: () => void;
}) {
  const sep = <span className="text-line"> │ </span>;
  return (
    <header className="border-b border-line px-2 py-1">
      <div className="flex flex-wrap items-center whitespace-pre">
        <a href="/" className="font-bold text-ok hover:bg-ok hover:text-bg">FARSIDE</a>
        {sep}
        <span className="text-dim">crew </span>
        <span>{crewId}</span>
        {sep}
        <span className="text-dim">mission </span>
        <span className="uppercase">{missionLabel}</span>
        {sep}
        <span className="text-dim">link </span>
        <span>{link}</span>
        {sep}
        <span className={mode === "live" ? "text-ok" : "text-warn"}>{mode === "live" ? "[LIVE]" : "[REPLAY]"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 whitespace-pre">
        <CrewSelector value={crewId} onChange={onCrewChange} />
        {missionSlot}
        <button type="button" onClick={onLoadScenario} className="hover:bg-fg hover:text-bg">[load mars-day-143]</button>
        <button type="button" onClick={onReset} className="hover:bg-fg hover:text-bg">[reset]</button>
      </div>
    </header>
  );
}
