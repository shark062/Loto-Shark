import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";
import "@/styles/lottery-balls.css";

interface NumberBallProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  number: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  onClick?: () => void;
  selected?: boolean;
  dimmed?: boolean;
  temperature?: "hot" | "warm" | "cold";
  variant?: string;
  animate?: boolean;
}

const DIGIT_COLORS: Record<number, { base: string; light: string; dark: string; text: string }> = {
  0: { base: '#CECECE', light: '#F4F4F4', dark: '#888888', text: '#1A1A1A' },
  1: { base: '#C80000', light: '#FF3030', dark: '#7A0000', text: '#FFFFFF' },
  2: { base: '#F5CC00', light: '#FFE840', dark: '#A08000', text: '#1A1A1A' },
  3: { base: '#157A15', light: '#1EB81E', dark: '#084808', text: '#FFFFFF' },
  4: { base: '#7A3210', light: '#B0581C', dark: '#421606', text: '#FFFFFF' },
  5: { base: '#1A6ED4', light: '#3A96FF', dark: '#0A408A', text: '#FFFFFF' },
  6: { base: '#D83890', light: '#FF66C0', dark: '#8A1058', text: '#FFFFFF' },
  7: { base: '#1C1C1C', light: '#545454', dark: '#080808', text: '#FFFFFF' },
  8: { base: '#868686', light: '#C4C4C4', dark: '#4A4A4A', text: '#FFFFFF' },
  9: { base: '#F07000', light: '#FFA030', dark: '#AA3A00', text: '#FFFFFF' },
};

export function getBallStyle(number: number): {
  background: string;
  boxShadow: string;
  color: string;
} {
  const c = DIGIT_COLORS[number % 10];
  return {
    background: `radial-gradient(circle at 33% 27%, ${c.light} 0%, ${c.light} 10%, ${c.base} 46%, ${c.dark} 88%, #000 100%)`,
    boxShadow: `3px 5px 16px rgba(0,0,0,0.72), inset -3px -4px 8px rgba(0,0,0,0.38), inset 2px 3px 7px rgba(255,255,255,0.42), inset 0 -1px 3px rgba(255,255,255,0.10)`,
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
  temperature,
  variant: _variant,
  animate = false,
  style: styleProp,
  ...rest
}: NumberBallProps) {
  const { background, boxShadow: baseShadow, color } = getBallStyle(number);

  const selectedRing = selected
    ? ', 0 0 0 3px #FFFFFF, 0 0 0 5.5px rgba(255,255,255,0.35)'
    : '';

  const tempGlow: Record<string, string> = {
    hot:  ', 0 0 0 2px #FF4444, 0 0 14px rgba(255,60,60,0.60)',
    warm: ', 0 0 0 2px #FFCC00, 0 0 14px rgba(255,200,0,0.60)',
    cold: ', 0 0 0 2px #4499FF, 0 0 14px rgba(60,140,255,0.60)',
  };

  const boxShadow = baseShadow + (selectedRing) + (temperature ? tempGlow[temperature] ?? '' : '');

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      className={cn(
        `lottery-ball lottery-ball--${size}`,
        onClick && 'lottery-ball--clickable',
        selected && 'lottery-ball--selected',
        dimmed && 'lottery-ball--dimmed',
        animate && 'lottery-ball--pop',
        className
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
      <span className="lottery-ball__gloss" aria-hidden />
      <span className="lottery-ball__specular" aria-hidden />
      <span className="lottery-ball__rim" aria-hidden />
      <span
        className="lottery-ball__label"
        style={{
          fontSize: 'inherit',
          fontWeight: 'inherit',
          textShadow: color === '#FFFFFF'
            ? '0 1px 3px rgba(0,0,0,0.85)'
            : '0 1px 2px rgba(255,255,255,0.55)',
        }}
      >
        {number.toString().padStart(2, '0')}
      </span>
    </div>
  );
}
