import type { ReactNode } from "react";

// Shell prompt "farside@c003:~$ " in green, then the children, with an optional blinking block cursor.
export function Prompt({ user = "farside@c003", path = "~", cursor = false, children }: {
  user?: string;
  path?: string;
  cursor?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="whitespace-pre-wrap">
      <span className="text-ok">{`${user}:${path}$ `}</span>
      {children}
      {cursor && <span className="cursor-blink bg-fg">&nbsp;</span>}
    </div>
  );
}
