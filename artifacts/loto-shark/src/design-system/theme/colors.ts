export const COLORS = {
  bg:      "#0B0F19",
  surface: "#121826",
  card:    "#182235",
  accent:  "#00D2FF",
  success: "#00E5A8",
  warning: "#FFB020",
  danger:  "#FF4C6A",
  text:    "#E5EEF7",
  textMuted: "#7A8FA6",
  border:  "rgba(255,255,255,0.08)",
  borderAccent: "rgba(0,210,255,0.25)",
} as const;

export type ColorKey = keyof typeof COLORS;
