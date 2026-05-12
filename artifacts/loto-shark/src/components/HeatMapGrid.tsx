import { NumberBall } from "@/components/NumberBall";
import { Flame } from "lucide-react";
import type { NumberFrequency } from "@/types/lottery";

interface HeatMapGridProps {
  frequencies: NumberFrequency[];
  maxNumbers: number;
  isLoading?: boolean;
  onNumberClick?: (number: number) => void;
}

const TEMP_RING = {
  hot:  { outline: '2px solid #FF4444', glow: '0 0 8px rgba(255,68,68,0.45)' },
  warm: { outline: '2px solid #FFCC00', glow: '0 0 8px rgba(255,200,0,0.45)' },
  cold: { outline: '2px solid #4499FF', glow: '0 0 8px rgba(68,153,255,0.45)' },
};

export default function HeatMapGrid({
  frequencies,
  maxNumbers,
  isLoading,
  onNumberClick,
}: HeatMapGridProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/8 p-4" style={{ background: "#121826" }}>
        <div className="flex items-center gap-2 mb-3">
          <Flame className="h-4 w-4 text-red-400" />
          <span className="text-[13px] font-bold text-white">Carregando mapa...</span>
        </div>
        <div className="number-grid grid grid-cols-10 gap-1.5">
          {[...Array(maxNumbers)].map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-full bg-white/[0.07] animate-pulse"
              style={{ width: 32, height: 32 }}
            />
          ))}
        </div>
      </div>
    );
  }

  const getTemp = (n: number): "hot" | "warm" | "cold" => {
    const freq = frequencies.find(f => f.number === n);
    return (freq?.temperature as any) || 'cold';
  };

  return (
    <div className="rounded-2xl border border-white/8 p-4" style={{ background: "#121826" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-red-400" />
          <span className="text-[13px] font-bold text-white">Mapa de Calor</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Quente
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />Morno
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Frio
          </span>
        </div>
      </div>

      <div className="number-grid grid gap-1.5" style={{ gridTemplateColumns: `repeat(10, 1fr)` }}>
        {Array.from({ length: maxNumbers }, (_, i) => i + 1).map(n => {
          const temp = getTemp(n);
          return (
            <NumberBall
              key={n}
              number={n}
              size="xs"
              temperature={temp}
              onClick={onNumberClick ? () => onNumberClick(n) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
