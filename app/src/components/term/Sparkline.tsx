const BLOCKS = "▁▂▃▄▅▆▇█";

/** Values -> block characters, scaled between their own min and max. */
export function sparkline(values: number[]): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  return values
    .map((v) => BLOCKS[span === 0 ? 0 : Math.round(((v - min) / span) * (BLOCKS.length - 1))])
    .join("");
}

// Text sparkline using ▁▂▃▄▅▆▇█.
export function Sparkline({ values }: { values: number[] }) {
  return <span className="whitespace-pre text-ok">{sparkline(values)}</span>;
}
