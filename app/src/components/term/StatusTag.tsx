// Status as a text tag, never colour alone: [ OK ] [WARN] [FAIL] [INFO] [ -- ].
export type TagStatus = "ok" | "warn" | "fail" | "info" | "off";

const TAGS: Record<TagStatus, [string, string]> = {
  ok: ["[ OK ]", "text-ok"],
  warn: ["[WARN]", "text-warn"],
  fail: ["[FAIL]", "text-fail"],
  info: ["[INFO]", "text-fg"],
  off: ["[ -- ]", "text-dim"],
};

export function StatusTag({ status }: { status: TagStatus }) {
  const [text, cls] = TAGS[status];
  return <span className={`${cls} whitespace-pre`}>{text}</span>;
}

/** Leading tag of a line, e.g. "[ OK ] baselines" -> ["ok", "baselines"], or null. */
export function splitTag(line: string): [TagStatus, string] | null {
  for (const [status, [text]] of Object.entries(TAGS) as [TagStatus, [string, string]][]) {
    if (line.startsWith(text)) return [status, line.slice(text.length)];
  }
  return null;
}
