import type { ReactNode } from "react";

/** "round_trip" + dots to `width` + " ", e.g. "round_trip ........ ". */
export function leader(label: string, width: number): string {
  return `${label} ${".".repeat(Math.max(2, width - label.length))} `;
}

// Two-column text table with dotted leaders: "round_trip ........ 44 min".
export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  const width = Math.max(0, ...rows.map(([k]) => k.length)) + 4;
  return (
    <div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex">
          <span className="shrink-0 whitespace-pre text-dim">{leader(k, width)}</span>
          <span className="min-w-0 break-words">{v}</span>
        </div>
      ))}
    </div>
  );
}
