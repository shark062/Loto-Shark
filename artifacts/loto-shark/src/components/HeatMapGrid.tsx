import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Snowflake, Sun } from "lucide-react";
import type { NumberFrequency } from "@/types/lottery";

interface HeatMapGridProps {
  frequencies: NumberFrequency[];
  maxNumbers: number;
  isLoading?: boolean;
  onNumberClick?: (number: number) => void;
}

export default function HeatMapGrid({
  frequencies,
  maxNumbers,
  isLoading,
  onNumberClick
}: HeatMapGridProps) {
  const getNumberStyle = (number: number) => {
    const freq = frequencies.find(f => f.number === number);
    const temperature = freq?.temperature || 'cold';

    const styles = {
      hot: "bg-red-500/80 text-white border-red-400 hover:bg-red-600/90",
      warm: "bg-yellow-500/80 text-white border-yellow-400 hover:bg-yellow-600/90",
      cold: "bg-blue-500/80 text-white border-blue-400 hover:bg-blue-600/90"
    };

    return styles[temperature];
  };

  const getTemperatureIcon = (temperature: string) => {
    switch (temperature) {
      case 'hot': return '🔥';
      case 'warm': return '♨️';
      case 'cold': return '❄️';
      default: return '❄️';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-primary flex items-center">
            <Flame className="h-5 w-5 mr-2 text-destructive" />
            Carregando Mapa de Calor...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="number-grid grid grid-cols-10 gap-1.5 mb-4">
            {[...Array(60)].map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-white/[0.07] rounded-lg animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="heat-map-grid">
      <CardHeader>
        <CardTitle className="text-primary flex items-center gap-2">
          <Flame className="h-5 w-5 text-destructive" />
          Mapa de Calor dos Números
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Numbers Grid */}
        <div
          className="number-grid mb-6 grid grid-cols-10 gap-1.5"
        >
          {Array.from({ length: maxNumbers }, (_, i) => {
            const number = i + 1;
            const freq = frequencies.find(f => f.number === number);
            const style = getNumberStyle(number);

            return (
              <button
                key={number}
                onClick={() => onNumberClick?.(number)}
                className={`aspect-square ${style} rounded-lg flex items-center justify-center font-bold text-[10px] shadow-sm hover:scale-105 transition-all duration-200 cursor-pointer border`}
                title={`Número ${number} - ${freq?.frequency || 0} vezes - ${freq?.temperature || 'cold'}`}
                data-testid={`number-${number}`}
                data-temperature={freq?.temperature || 'cold'}
              >
                {number.toString().padStart(2, '0')}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-red-500/80 border border-red-400 text-[10px]">🔥</span>
            <span className="text-muted-foreground">
              Quentes ({frequencies.filter(f => f.temperature === 'hot').length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-yellow-500/80 border border-yellow-400 text-[10px]">♨️</span>
            <span className="text-muted-foreground">
              Mornos ({frequencies.filter(f => f.temperature === 'warm').length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-blue-500/80 border border-blue-400 text-[10px]">❄️</span>
            <span className="text-muted-foreground">
              Frios ({frequencies.filter(f => f.temperature === 'cold').length})
            </span>
          </div>
        </div>

        {/* Statistics */}
        {frequencies.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <div className="text-xl font-bold text-red-400">
                {frequencies.filter(f => f.temperature === 'hot').length}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Quentes</div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
              <div className="text-xl font-bold text-amber-400">
                {frequencies.filter(f => f.temperature === 'warm').length}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Mornos</div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
              <div className="text-xl font-bold text-primary">
                {frequencies.filter(f => f.temperature === 'cold').length}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Frios</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}