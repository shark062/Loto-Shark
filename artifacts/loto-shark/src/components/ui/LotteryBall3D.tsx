/**
 * LotteryBall3D — Realistic physical lottery ball renderer.
 *
 * Visual goal: identical to real Caixa/bingo plastic balls.
 * Technique: multi-layer CSS radial-gradients + inset shadows.
 * Strict NO-neon policy: zero colored rings, zero glow, zero sci-fi fx.
 */

import { cn } from "@/lib/utils";
import "@/styles/lottery-balls.css";

export interface LotteryBall3DProps {
  number: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  onClick?: () => void;
  selected?: boolean;
  dimmed?: boolean;
  temperature?: "hot" | "warm" | "cold"; // API-compat only — no visual effect
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/* ─── Palette — realistic physical ball colours ──────────── */
const PALETTE: Record<number, {
  light: string; // highlight fade-to colour
  base:  string; // main ball body
  dark:  string; // shadow-side colour
  text:  string; // label colour
}> = {
  0: { light: '#F8F8F8', base: '#D4D4D4', dark: '#989898', text: '#1A1A1A' }, // White
  1: { light: '#E84040', base: '#BE0000', dark: '#780000', text: '#FFFFFF' }, // Red
  2: { light: '#FFE030', base: '#E8B800', dark: '#A07400', text: '#1A1A1A' }, // Yellow
  3: { light: '#2CC02C', base: '#147014', dark: '#074007', text: '#FFFFFF' }, // Green
  4: { light: '#A86030', base: '#6E3010', dark: '#3E1606', text: '#FFFFFF' }, // Brown
  5: { light: '#3A88E8', base: '#0F52C0', dark: '#082E80', text: '#FFFFFF' }, // Blue
  6: { light: '#F040A8', base: '#C00878', dark: '#840050', text: '#FFFFFF' }, // Pink/Magenta
  7: { light: '#484848', base: '#181818', dark: '#060606', text: '#FFFFFF' }, // Black
  8: { light: '#BBBBBB', base: '#787878', dark: '#424242', text: '#FFFFFF' }, // Gray
  9: { light: '#FF9020', base: '#D85800', dark: '#963000', text: '#FFFFFF' }, // Orange
};

/* ─── Pixel sizes ────────────────────────────────────────── */
const SIZE_PX: Record<string, number> = { xs: 28, sm: 34, md: 42, lg: 52, xl: 64 };
const FONT_PX: Record<string, number> = { xs: 9,  sm: 11, md: 14, lg: 17, xl: 21 };

/* ─── Sphere gradient builder ────────────────────────────── */
function buildBackground(c: typeof PALETTE[number]): string {
  return [
    // Layer 1 — generous specular ellipse (upper-left) — realistic glossy plastic sheen
    `radial-gradient(ellipse 58% 44% at 31% 24%,
        rgba(255,255,255,0.90) 0%,
        rgba(255,255,255,0.60) 18%,
        rgba(255,255,255,0.20) 40%,
        rgba(255,255,255,0.00) 60%)`,
    // Layer 2 — sphere body: light → base colour → shadow → near-black extremity
    `radial-gradient(circle at 42% 40%,
        ${c.light} 0%,
        ${c.base}  44%,
        ${c.dark}  70%,
        rgba(0,0,0,0.78) 100%)`,
  ].join(', ');
}

/* ─── Physical shadow builder ────────────────────────────── */
function buildShadow(selected: boolean): string {
  const base = [
    '3px 5px 14px rgba(0,0,0,0.55)',           // natural drop shadow
    '1px 2px 4px rgba(0,0,0,0.28)',             // contact shadow
    'inset -4px -5px 12px rgba(0,0,0,0.40)',   // inner depth — dark lower-right
    'inset 1px 2px 4px rgba(255,255,255,0.12)', // inner surface catch
  ].join(', ');

  // Selected: subtle neutral white outline — NO neon, NO colour glow
  const ring = selected
    ? ', 0 0 0 2.5px rgba(255,255,255,0.82), 0 0 0 4px rgba(255,255,255,0.14)'
    : '';

  return base + ring;
}

/* ─── Component ──────────────────────────────────────────── */
export function LotteryBall3D({
  number,
  size = "md",
  onClick,
  selected = false,
  dimmed   = false,
  temperature: _temperature, // intentionally unused — no glow rendered
  animate  = false,
  className,
  style: styleProp,
}: LotteryBall3DProps) {
  const c  = PALETTE[number % 10];
  const px = SIZE_PX[size] ?? SIZE_PX.md;
  const fs = FONT_PX[size] ?? FONT_PX.md;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      } : undefined}
      className={cn(
        'lottery-ball',
        `lottery-ball--${size}`,
        onClick  && 'lottery-ball--clickable',
        selected && 'lottery-ball--selected',
        dimmed   && 'lottery-ball--dimmed',
        animate  && 'lottery-ball--pop',
        className,
      )}
      style={{
        width:        px,
        height:       px,
        borderRadius: '50%',
        background:   buildBackground(c),
        boxShadow:    buildShadow(selected),
        color:        c.text,
        flexShrink:   0,
        ...styleProp,
      }}
    >
      {/* CSS highlight layers — defined in lottery-balls.css */}
      <span className="lottery-ball__gloss"    aria-hidden />
      <span className="lottery-ball__specular" aria-hidden />
      <span className="lottery-ball__rim"      aria-hidden />

      <span
        className="lottery-ball__label"
        style={{
          fontSize:   fs,
          fontWeight: 900,
          // Contrast shadow only — crisp, physical; NO neon
          textShadow: c.text === '#FFFFFF'
            ? '0 1px 3px rgba(0,0,0,0.82)'
            : '0 1px 2px rgba(255,255,255,0.52)',
        }}
      >
        {number.toString().padStart(2, '0')}
      </span>
    </div>
  );
}
