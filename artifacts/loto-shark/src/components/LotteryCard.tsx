import { Card, CardContent } from "@/components/ui/card";
import type { NextDrawInfo } from "@/types/lottery";

interface LotteryCardProps {
  lotteryName: string;
  displayName: string;
  color: string;
  icon: string;
  nextDraw?: NextDrawInfo;
  isLoading?: boolean;
}

export default function LotteryCard({ 
  lotteryName, 
  displayName, 
  color, 
  icon, 
  nextDraw,
  isLoading 
}: LotteryCardProps) {
  const formatTimeRemaining = (timeRemaining?: { days: number; hours: number; minutes: number; seconds?: number }) => {
    if (!timeRemaining) return "Carregando...";
    const { days, hours, minutes, seconds } = timeRemaining;
    return `${days.toString().padStart(2, '0')}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${(seconds || 0).toString().padStart(2, '0')}s`;
  };

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string; gradient: string }> = {
      green: { 
        bg: "bg-neon-green", 
        text: "text-neon-green", 
        gradient: "from-neon-green/20 to-accent/20" 
      },
      purple: { 
        bg: "bg-neon-purple", 
        text: "text-neon-purple", 
        gradient: "from-neon-purple/20 to-neon-pink/20" 
      },
      pink: { 
        bg: "bg-neon-pink", 
        text: "text-neon-pink", 
        gradient: "from-neon-pink/20 to-destructive/20" 
      },
      cyan: { 
        bg: "bg-primary", 
        text: "text-primary", 
        gradient: "from-primary/20 to-secondary/20" 
      },
      gold: { 
        bg: "bg-neon-gold", 
        text: "text-neon-gold", 
        gradient: "from-neon-gold/20 to-accent/20" 
      },
    };

    return colorMap[color] || colorMap.cyan;
  };

  const colorClasses = getColorClasses(color);

  if (isLoading) {
    return (
      <Card className="bg-black/25 backdrop-blur-sm animate-pulse rounded-3xl">
        <CardContent className="p-6 min-h-[280px]">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-black/20 rounded-3xl w-32"></div>
            <div className="w-8 h-8 bg-black/20 rounded-full"></div>
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 bg-black/20 rounded-3xl w-20"></div>
                <div className="h-4 bg-black/20 rounded-3xl w-24"></div>
              </div>
            ))}
            <div className="h-16 bg-black/20 rounded-3xl"></div>
            <div className="h-16 bg-black/20 rounded-3xl"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="bg-black/25 backdrop-blur-md border-white/20 transition-all duration-300 group rounded-3xl"
      data-testid={`lottery-card-${lotteryName}`}
    >
      <CardContent className="p-6 min-h-[280px]">
        <div className="flex items-center justify-between mb-4">
          <h4 className={`text-lg font-bold ${colorClasses.text} neon-text`} data-testid={`lottery-name-${lotteryName}`}>
            {displayName}
          </h4>
          <div className={`w-8 h-8 ${colorClasses.bg} rounded-full flex items-center justify-center`}>
            <span className="text-black text-sm">{icon}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Concurso:</span>
            <span className="font-mono text-accent" data-testid={`contest-number-${lotteryName}`}>
              {nextDraw?.contestNumber || "---"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Data:</span>
            <span className="font-mono text-foreground" data-testid={`draw-date-${lotteryName}`}>
              {nextDraw ? new Date(nextDraw.drawDate).toLocaleDateString('pt-BR') : "---"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Horário:</span>
            <span className="font-mono text-foreground" data-testid={`draw-time-${lotteryName}`}>
              20:00
            </span>
          </div>

          {/* Countdown Timer */}
          <div className="bg-muted/30 rounded-3xl p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Tempo Restante</div>
            <div 
              className={`font-mono text-lg ${colorClasses.text} neon-text`}
              data-testid={`countdown-${lotteryName}`}
            >
              {formatTimeRemaining(nextDraw?.timeRemaining)}
            </div>
          </div>

          {/* Prize Amount */}
          <div className={`bg-gradient-to-r ${colorClasses.gradient} rounded-3xl p-3 text-center`}>
            <div className="text-xs text-muted-foreground mb-1">Prêmio Estimado</div>
            <div 
              className={`font-bold text-xl ${colorClasses.text} neon-text`}
              data-testid={`prize-amount-${lotteryName}`}
            >
              {nextDraw?.estimatedPrize || "R$ 0,00"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}