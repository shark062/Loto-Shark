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
  0: { base: '#D0D0D0', light: '#F8F8F8', dark: '#909090', text: '#111111' }, // Branco/Prata
  1: { base: '#CC0000', light: '#EE4444', dark: '#880000', text: '#FFFFFF' }, // Vermelho
  2: { base: '#FFD700', light: '#FFF066', dark: '#CC9900', text: '#111111' }, // Amarelo vivo
  3: { base: '#1A7A1A', light: '#2EAA2E', dark: '#0A4A0A', text: '#FFFFFF' }, // Verde escuro
  4: { base: '#8B4513', light: '#BF6E30', dark: '#552808', text: '#FFFFFF' }, // Marrom chocolate
  5: { base: '#3374C4', light: '#66AAFF', dark: '#1A509A', text: '#FFFFFF' }, // Azul médio
  6: { base: '#DD44AA', light: '#FF77CC', dark: '#991177', text: '#FFFFFF' }, // Rosa pink
  7: { base: '#1A1A1A', light: '#606060', dark: '#000000', text: '#FFFFFF' }, // Preto
  8: { base: '#888888', light: '#C8C8C8', dark: '#505050', text: '#FFFFFF' }, // Cinza prata
  9: { base: '#FF7700', light: '#FFAA44', dark: '#CC4400', text: '#FFFFFF' }, // Laranja vivo
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
    background: `radial-gradient(circle at 34% 28%, ${colors.light} 0%, ${colors.base} 48%, ${colors.dark} 100%)`,
    boxShadow: '2px 4px 10px rgba(0,0,0,0.60), inset -2px -3px 5px rgba(0,0,0,0.30), inset 2px 2px 6px rgba(255,255,255,0.40)',
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
      {/* Reflexo especular superior */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: '8%',
          left: '12%',
          width: '40%',
          height: '30%',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.72)',
          filter: 'blur(2.5px)',
          transform: 'rotate(-20deg)',
          pointerEvents: 'none',
        }}
      />
      {/* Ponto brilhante pequeno */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: '12%',
          left: '18%',
          width: '18%',
          height: '14%',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.90)',
          filter: 'blur(1px)',
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
