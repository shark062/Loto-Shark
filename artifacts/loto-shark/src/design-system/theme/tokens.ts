import { COLORS } from "./colors";

export const TOKENS = {
  spacing: {
    xs:  "4px",
    sm:  "8px",
    md:  "12px",
    lg:  "16px",
    xl:  "24px",
    "2xl": "32px",
  },
  radius: {
    sm:  "8px",
    md:  "12px",
    lg:  "16px",
    xl:  "20px",
    full: "9999px",
  },
  fontSize: {
    heading:   "22px",
    subheading:"16px",
    body:      "14px",
    caption:   "12px",
    micro:     "11px",
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold:"600",
    bold:   "700",
  },
  transition: "all 0.2s ease",
  colors: COLORS,
} as const;
