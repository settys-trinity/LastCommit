/** Round trip for the screen: "0.5 s", "2.6 s", "44 min" or "no link" (null). */
export function formatRoundTrip(seconds: number | null): string {
  if (seconds === null) return "no link";
  if (seconds < 60) return `${seconds} s`;
  return `${Math.round(seconds / 60)} min`;
}
