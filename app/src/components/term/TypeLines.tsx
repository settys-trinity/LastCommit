import { useEffect, useState } from "react";
import { splitTag, StatusTag } from "./StatusTag";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Types lines out one by one (all at once with reduced motion). Leading [ OK ]/[INFO] tags are coloured.
export function TypeLines({ lines, speedMs = 250 }: { lines: string[]; speedMs?: number }) {
  const [shown, setShown] = useState(() => (reducedMotion() ? lines.length : 0));

  useEffect(() => {
    if (shown >= lines.length) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), speedMs);
    return () => window.clearTimeout(t);
  }, [shown, lines.length, speedMs]);

  return (
    <div>
      {lines.slice(0, shown).map((line, i) => {
        const tagged = splitTag(line);
        return (
          <div key={i} className="whitespace-pre-wrap">
            {tagged ? (
              <>
                <StatusTag status={tagged[0]} />
                {tagged[1]}
              </>
            ) : (
              line
            )}
          </div>
        );
      })}
    </div>
  );
}
