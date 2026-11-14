// FARSIDE terminal palette (D18). Keep in step with the @theme block in index.css.
export const PALETTE = {
  bg: "#0b0c0b",
  panel: "#0f110f",
  fg: "#c9cfc9",
  dim: "#5f665f",
  green: "#4af626",
  amber: "#ffb000",
  red: "#ff4d4d",
  line: "#2a2f2a",
} as const;

// "grey": body text in fg. "green": body text in green (classic phosphor look).
export const TEXT_MODE: "grey" | "green" = "grey";
