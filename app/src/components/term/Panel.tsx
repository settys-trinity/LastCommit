import type { ReactNode } from "react";
import { StatusTag, type TagStatus } from "./StatusTag";

// Box-drawn frame; the title sits in the top border as "┌─ TITLE ─", optional status tag at the right.
export function Panel({ title, status, children }: { title: string; status?: TagStatus; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="flex items-center whitespace-pre text-line">
        <span>┌─ </span>
        <span className="text-fg uppercase">{title}</span>
        <span> ─</span>
        <span className="mx-1 h-0 flex-1 self-center border-t border-line" />
        {status && <StatusTag status={status} />}
        <span>{status ? " ─┐" : "─┐"}</span>
      </div>
      <div className="border-x border-b border-line px-2 pb-1">{children}</div>
    </section>
  );
}
