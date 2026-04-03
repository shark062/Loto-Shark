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
      <Card className="bg-black/20 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-primary flex items-center">
            <Flame className="h-5 w-5 mr-2 text-destructive" />
            Carregando Mapa de Calor...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-10 gap-2 mb-4">
            {[...Array(60)].map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-black/20 rounded-lg animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/20 backdrop-blur-sm" data-testid="heat-map-grid">
      <CardHeader>
        <CardTitle className="text-primary flex items-center">
          <Flame className="h-5 w-5 mr-2 text-destructive" />
          Mapa de Calor dos Números
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Numbers Grid */}
        <div className="grid grid-cols-10 gap-1.5 mb-6">
          {Array.from({ length: maxNumbers }, (_, i) => {
            const number = i + 1;
            const freq = frequencies.find(f => f.number === number);
            const style = getNumberStyle(number);

            return (
              <button
                key={number}
                onClick={() => onNumberClick?.(number)}
                className={`aspect-square ${style} rounded-2xl flex items-center justify-center font-bold text-sm shadow-md hover:scale-105 transition-all duration-200 cursor-pointer border-2`}
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
        <div className="flex justify-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-500 rounded border border-red-400 flex items-center justify-center text-xs">
              🔥
            </div>
            <span className="text-muted-foreground">
              Quentes ({frequencies.filter(f => f.temperature === 'hot').length})
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-500 rounded border border-yellow-400 flex items-center justify-center text-xs">
              ♨️
            </div>
            <span className="text-muted-foreground">
              Mornos ({frequencies.filter(f => f.temperature === 'warm').length})
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded border border-blue-400 flex items-center justify-center text-xs">
              ❄️
            </div>
            <span className="text-muted-foreground">
              Frios ({frequencies.filter(f => f.temperature === 'cold').length})
            </span>
          </div>
        </div>

        {/* Statistics */}
        {frequencies.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            <div className="bg-black/20 rounded-lg p-3">
              <div className="text-2xl font-bold text-destructive">
                {frequencies.filter(f => f.temperature === 'hot').length}
              </div>
              <div className="text-xs text-muted-foreground">Números Quentes</div>
            </div>
            <div className="bg-black/20/10 rounded-lg p-3">
              <div className="text-2xl font-bold text-amber-500">
                {frequencies.filter(f => f.temperature === 'warm').length}
              </div>
              <div className="text-xs text-muted-foreground">Números Mornos</div>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <div className="text-2xl font-bold text-primary">
                {frequencies.filter(f => f.temperature === 'cold').length}
              </div>
              <div className="text-xs text-muted-foreground">Números Frios</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}