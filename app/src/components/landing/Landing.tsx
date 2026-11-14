import { useEffect } from "react";
import { LazyAstronaut } from "../astronaut/LazyAstronaut";

const ALL_OK = { helmet: "ok", visor: "ok", chest: "ok", abdomen: "ok", backpack: "ok", hands: "ok", legs: "ok" } as const;

// The two ways in. "/demo#body" opens the demo straight into the body view (BodyMap reads the #body hash).
const OPTIONS = [
  { key: "d", label: "dashboard access", href: "/demo" },
  { key: "b", label: "body view", href: "/demo#body" },
] as const;

// Public landing page: only the astronaut, centred, with the two options at the bottom.
// Press d or b (or click an option). Enter or a click on the astronaut opens the dashboard.
export function Landing() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const option = OPTIONS.find((o) => o.key === key);
      if (option) window.location.assign(option.href);
      else if (e.key === "Enter") window.location.assign("/demo");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 pb-24">
      <a href="/demo" aria-label="Open the FARSIDE dashboard" className="text-[11px] sm:text-sm">
        <LazyAstronaut parts={ALL_OK} height={560} showList={false} />
      </a>
      <nav aria-label="open FARSIDE" className="absolute inset-x-0 bottom-6 flex justify-center gap-10 text-lg">
        {OPTIONS.map((o) => (
          <a key={o.key} href={o.href} className="px-2 hover:bg-fg hover:text-bg">
            <span className="text-ok">[{o.key}]</span> - {o.label}
          </a>
        ))}
      </nav>
    </main>
  );
}