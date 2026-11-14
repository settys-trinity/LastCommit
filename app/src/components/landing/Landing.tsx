import { useEffect } from "react";
import { Prompt, TypeLines } from "../term";
import { LazyAstronaut } from "../astronaut/LazyAstronaut";

const ALL_OK = { brain_behaviour: "green", neurovestibular: "green", metabolism: "green" } as const;
import { COPY } from "./copy";

// Public landing page rendered as a terminal session. Enter opens /demo.
export function Landing() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") window.location.assign("/demo");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="mx-auto flex max-w-[160ch] flex-col gap-8 p-4 lg:flex-row lg:items-start">
      <div className="min-w-0 max-w-[100ch] flex-1">
        <TypeLines lines={COPY.boot} speedMs={180} />
        {COPY.sections.map((s) => (
          <section key={s.cmd} className="mt-6">
            <Prompt>{s.cmd}</Prompt>
            {s.out.map((line) => (
              <div key={line} className="whitespace-pre-wrap">
                {line}
              </div>
            ))}
          </section>
        ))}
        <div className="mt-8">
          <Prompt cursor>
            <a href="/demo" className="text-ok underline underline-offset-4 hover:bg-ok hover:text-bg">
              {COPY.demoCmd}
            </a>
          </Prompt>
          <div className="text-dim"># {COPY.demoHint}</div>
        </div>
      </div>
      <aside className="shrink-0 overflow-x-auto text-[11px] sm:text-sm">
        <LazyAstronaut systems={ALL_OK} height={420} />
      </aside>
    </main>
  );
}
