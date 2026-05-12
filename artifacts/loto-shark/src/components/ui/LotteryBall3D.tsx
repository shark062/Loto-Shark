import { cn } from "@/lib/utils";
import { getBallColors } from "@/config/ballPalette";
import "@/styles/lottery-balls.css";

export interface LotteryBall3DProps {
  number: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  onClick?: () => void;
  selected?: boolean;
  dimmed?: boolean;
  temperature?: "hot" | "warm" | "cold";
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_PX: Record<string, number> = {
  xs: 28, sm: 34, md: 42, lg: 52, xl: 64,
};
const FONT_PX: Record<string, number> = {
  xs: 9, sm: 11, md: 14, lg: 17, xl: 21,
};

export function LotteryBall3D({
  number,
  size = "md",
  onClick,
  selected = false,
  dimmed = false,
  temperature,
  animate = false,
  className,
  style: styleProp,
}: LotteryBall3DProps) {
  const c = getBallColors(number);
  const px = SIZE_PX[size] ?? SIZE_PX.md;
  const fs = FONT_PX[size] ?? FONT_PX.md;

  const bg = `radial-gradient(circle at 33% 26%, ${c.light} 0%, ${c.light} 8%, ${c.base} 42%, ${c.dark} 80%, ${c.edge} 100%)`;

  const baseShadow = `3px 5px 18px rgba(0,0,0,0.75), inset -3px -4px 9px rgba(0,0,0,0.40), inset 2px 3px 8px rgba(255,255,255,0.44), inset 0 -2px 4px rgba(255,255,255,0.10)`;

  const ringExtra = selected
    ? ', 0 0 0 3px #FFFFFF, 0 0 0 6px rgba(255,255,255,0.32)'
    : '';
  const tempExtra = temperature === 'hot'  ? ', 0 0 0 2.5px #FF4444, 0 0 14px rgba(255,60,60,0.6)'
                  : temperature === 'warm' ? ', 0 0 0 2.5px #FFCC00, 0 0 14px rgba(255,200,0,0.6)'
                  : temperature === 'cold' ? ', 0 0 0 2.5px #4499FF, 0 0 14px rgba(68,153,255,0.6)'
                  : '';
  const boxShadow = baseShadow + ringExtra + tempExtra;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      className={cn(
        'lottery-ball',
        onClick && 'lottery-ball--clickable',
        selected && 'lottery-ball--selected',
        dimmed && 'lottery-ball--dimmed',
        animate && 'lottery-ball--pop',
        className
      )}
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        background: bg,
        boxShadow,
        color: c.text,
        flexShrink: 0,
        ...styleProp,
      }}
    >
      <span className="lottery-ball__gloss" aria-hidden />
      <span className="lottery-ball__specular" aria-hidden />
      <span className="lottery-ball__rim" aria-hidden />
      <span
        className="lottery-ball__label"
        style={{
          fontSize: fs,
          fontWeight: 900,
          textShadow: c.text === '#FFFFFF'
            ? '0 1px 3px rgba(0,0,0,0.88)'
            : '0 1px 2px rgba(255,255,255,0.6)',
        }}
      >
        {number.toString().padStart(2, '0')}
      </span>
    </div>
  );
}
