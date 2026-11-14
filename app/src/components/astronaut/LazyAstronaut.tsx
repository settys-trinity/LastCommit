import { lazy, Suspense, type ComponentProps } from "react";
import { StaticAstronaut } from "./StaticAstronaut";

// three.js loads in its own chunk; the static figure shows until it arrives.
const AsciiAstronaut = lazy(() => import("./AsciiAstronaut"));

export function LazyAstronaut(props: ComponentProps<typeof AsciiAstronaut>) {
  return (
    <Suspense fallback={<StaticAstronaut />}>
      <AsciiAstronaut {...props} />
    </Suspense>
  );
}
