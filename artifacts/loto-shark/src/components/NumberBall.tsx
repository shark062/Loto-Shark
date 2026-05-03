import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface NumberBallProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  number: number;
  size?: "xs" | "sm" | "md" | "lg";
  onClick?: () => void;
  selected?: boolean;
  dimmed?: boolean;
  temperature?: "hot" | "warm" | "cold";
  variant?: string;
}

const DIGIT_COLORS: Record<number, { base: string; light: string; dark: string; text: string }> = {
  0: { base: '#C8C8C8', light: '#F4F4F4', dark: '#888888', text: '#111111' },
  1: { base: '#CC1111', light: '#FF4444', dark: '#880000', text: '#FFFFFF' },
  2: { base: '#CCAA00', light: '#FFEE33', dark: '#886600', text: '#111111' },
  3: { base: '#009900', light: '#22CC22', dark: '#005500', text: '#FFFFFF' },
  4: { base: '#7B3A10', light: '#BB6633', dark: '#4A1E06', text: '#FFFFFF' },
  5: { base: '#1155CC', light: '#4488FF', dark: '#003388', text: '#FFFFFF' },
  6: { base: '#DD1188', light: '#FF55BB', dark: '#990066', text: '#FFFFFF' },
  7: { base: '#1A1A1A', light: '#555555', dark: '#000000', text: '#FFFFFF' },
  8: { base: '#777777', light: '#BBBBBB', dark: '#444444', text: '#FFFFFF' },
  9: { base: '#EE7700', light: '#FFAA33', dark: '#AA4400', text: '#FFFFFF' },
};

const TEMP_GLOW: Record<string, string> = {
  hot:  '0 0 0 2px #FF4444, 0 0 12px rgba(255,60,60,0.55)',
  warm: '0 0 0 2px #FFCC00, 0 0 12px rgba(255,200,0,0.55)',
  cold: '0 0 0 2px #4499FF, 0 0 12px rgba(60,140,255,0.55)',
};

const SIZES: Record<string, { px: number; fontSize: number }> = {
  xs: { px: 26,  fontSize: 9  },
  sm: { px: 34,  fontSize: 11 },
  md: { px: 42,  fontSize: 14 },
  lg: { px: 54,  fontSize: 18 },
};

export function getBallStyle(number: number): {
  background: string;
  boxShadow: string;
  color: string;
} {
  const colors = DIGIT_COLORS[number % 10];
  return {
    background: `radial-gradient(circle at 38% 32%, ${colors.light} 0%, ${colors.base} 55%, ${colors.dark} 100%)`,
    boxShadow: '2px 3px 8px rgba(0,0,0,0.55), inset -2px -2px 4px rgba(0,0,0,0.25), inset 2px 2px 5px rgba(255,255,255,0.35)',
    color: colors.text,
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
  style: styleProp,
  ...rest
}: NumberBallProps) {
  const { px, fontSize } = SIZES[size] ?? SIZES.md;
  const { background, boxShadow: baseShadow, color } = getBallStyle(number);

  const extraShadows = [
    selected ? '0 0 0 3px #FFFFFF, 0 0 0 5px rgba(255,255,255,0.4)' : '',
    temperature ? TEMP_GLOW[temperature] : '',
  ].filter(Boolean).join(', ');

  const boxShadow = extraShadows ? `${baseShadow}, ${extraShadows}` : baseShadow;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      className={cn(
        'relative flex items-center justify-center select-none font-mono transition-all duration-150',
        onClick && 'cursor-pointer hover:scale-110 active:scale-95',
        className
      )}
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        background,
        boxShadow,
        color,
        fontSize,
        fontWeight: 900,
        opacity: dimmed ? 0.35 : 1,
        flexShrink: 0,
        ...styleProp,
      }}
      {...rest}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: '10%',
          left: '15%',
          width: '38%',
          height: '28%',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.62)',
          filter: 'blur(3px)',
          transform: 'rotate(-15deg)',
          pointerEvents: 'none',
        }}
      />
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          textShadow: color === '#FFFFFF'
            ? '0 1px 2px rgba(0,0,0,0.8)'
            : '0 1px 1px rgba(255,255,255,0.5)',
          letterSpacing: '-0.02em',
        }}
      >
        {number.toString().padStart(2, '0')}
      </span>
    </div>
  );
}
