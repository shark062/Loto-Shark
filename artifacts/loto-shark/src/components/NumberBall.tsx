import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";
import "@/styles/lottery-balls.css";

interface NumberBallProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  number: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  onClick?: () => void;
  selected?: boolean;
  dimmed?: boolean;
  temperature?: "hot" | "warm" | "cold"; // kept for API compat — NOT rendered as glow
  variant?: string;
  animate?: boolean;
}

/* ─── Realistic colour palette by last digit ─────────────────
   Matches official Caixa/Bingo physical ball colours.
   Each entry: light (highlight transition), base (main), dark (shadow side).
   NO neon — NO fluorescent — physical plastic only.
──────────────────────────────────────────────────────────── */
const PALETTE: Record<number, { light: string; base: string; dark: string; text: string }> = {
  0: { light: '#F8F8F8', base: '#D8D8D8', dark: '#9A9A9A', text: '#1A1A1A' }, // White
  1: { light: '#E84040', base: '#BE0000', dark: '#780000', text: '#FFFFFF' }, // Red
  2: { light: '#FFE030', base: '#E8B800', dark: '#A07400', text: '#1A1A1A' }, // Yellow
  3: { light: '#2CC02C', base: '#147014', dark: '#074007', text: '#FFFFFF' }, // Green
  4: { light: '#A86030', base: '#6E3010', dark: '#3E1606', text: '#FFFFFF' }, // Brown
  5: { light: '#3A88E8', base: '#0F52C0', dark: '#082E80', text: '#FFFFFF' }, // Blue
  6: { light: '#F040A8', base: '#C00878', dark: '#840050', text: '#FFFFFF' }, // Pink
  7: { light: '#484848', base: '#181818', dark: '#060606', text: '#FFFFFF' }, // Black
  8: { light: '#BBBBBB', base: '#787878', dark: '#424242', text: '#FFFFFF' }, // Gray
  9: { light: '#FF9020', base: '#D85800', dark: '#963000', text: '#FFFFFF' }, // Orange
};

/* ─── Build background: layered radial gradients ────────────
   Layer 1 (top): broad elliptical specular — fades to transparent
   Layer 2 (base): sphere body — light → base colour → dark → near-black
──────────────────────────────────────────────────────────── */
export function getBallStyle(number: number): {
  background: string;
  boxShadow: string;
  color: string;
} {
  const c = PALETTE[number % 10];
  return {
    background: [
      // Top highlight ellipse — upper-left, generous size for realistic plastic sheen
      `radial-gradient(ellipse 58% 44% at 31% 24%, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.60) 18%, rgba(255,255,255,0.20) 40%, rgba(255,255,255,0) 60%)`,
      // Sphere body — light transition → base colour → shadow → near-black edge
      `radial-gradient(circle at 42% 40%, ${c.light} 0%, ${c.base} 44%, ${c.dark} 70%, rgba(0,0,0,0.78) 100%)`,
    ].join(', '),
    // Realistic physical shadow — NO neon, NO colour glow
    boxShadow: [
      '3px 5px 14px rgba(0,0,0,0.55)',         // natural drop shadow
      '1px 2px 4px rgba(0,0,0,0.28)',           // close contact shadow
      'inset -4px -5px 12px rgba(0,0,0,0.40)', // inner depth (dark lower-right)
      'inset 1px 2px 4px rgba(255,255,255,0.12)', // inner surface top catch
    ].join(', '),
    color: c.text,
  };
}

export function NumberBall({
  number,
  className,
  size = "md",
  onClick,
  selected = false,
  dimmed = false,
  temperature: _temperature, // accepted, intentionally unused — no glow rendered
  variant: _variant,
  animate = false,
  style: styleProp,
  ...rest
}: NumberBallProps) {
  const { background, boxShadow, color } = getBallStyle(number);

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      className={cn(
        `lottery-ball lottery-ball--${size}`,
        onClick  && 'lottery-ball--clickable',
        selected && 'lottery-ball--selected',
        dimmed   && 'lottery-ball--dimmed',
        animate  && 'lottery-ball--pop',
        className,
      )}
      style={{
        background,
        boxShadow,
        color,
        fontWeight: 900,
        ...styleProp,
      }}
      {...rest}
    >
      {/* Highlight layers — rendered by CSS in lottery-balls.css */}
      <span className="lottery-ball__gloss"    aria-hidden />
      <span className="lottery-ball__specular" aria-hidden />
      <span className="lottery-ball__rim"      aria-hidden />

      <span
        className="lottery-ball__label"
        style={{
          fontSize: 'inherit',
          fontWeight: 'inherit',
          // Crisp text shadow — contrast only, NO neon
          textShadow: color === '#FFFFFF'
            ? '0 1px 3px rgba(0,0,0,0.80)'
            : '0 1px 2px rgba(255,255,255,0.50)',
        }}
      >
        {number.toString().padStart(2, '0')}
      </span>
    </div>
  );
}
