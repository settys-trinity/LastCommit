import { useEffect } from "react";
import { LazyAstronaut } from "../astronaut/LazyAstronaut";

const ALL_OK = { helmet: "ok", ears: "ok", chest: "ok", abdomen: "ok", backpack: "ok", hands: "ok", legs: "ok" } as const;

// Public landing page: only the spinning astronaut, centred. Click it or press Enter to open /demo.
export function Landing() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") window.location.assign("/demo");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden p-4">
      <a href="/demo" aria-label="Open the FARSIDE demo" className="text-[11px] sm:text-sm">
        <LazyAstronaut parts={ALL_OK} height={560} showList={false} />
      </a>
    </main>
  );
}