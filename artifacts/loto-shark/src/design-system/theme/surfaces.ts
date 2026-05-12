import { COLORS } from "./colors";

export const SURFACES = {
  base: {
    background: COLORS.bg,
    color: COLORS.text,
  },
  card: {
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "16px",
  },
  surface: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "12px",
  },
  accent: {
    border: `1px solid ${COLORS.borderAccent}`,
    borderRadius: "12px",
  },
} as const;
