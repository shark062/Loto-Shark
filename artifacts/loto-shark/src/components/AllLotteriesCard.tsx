import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLotteryTypes, useNextDrawInfo } from "@/hooks/useLotteryData";
import {
  Trophy,
  TrendingUp,
  Sparkles,
  Calendar,
  DollarSign,
  Clock,
  Zap,
  Target,
  ShoppingCart
} from "lucide-react";
import type { LotteryType } from "@/types/lottery";

interface LotteryCardProps {
  lottery: LotteryType;
}

function SingleLotteryCard({ lottery }: LotteryCardProps) {
  const [, setLocation] = useLocation();
  const { data: nextDraw, isLoading } = useNextDrawInfo(lottery.id);

  const getEmojiForLottery = (id: string) => {
    const emojis: Record<string, string> = {
      'megasena': '💎',
      'lotofacil': '⭐',
      'quina': '🪙',
      'lotomania': '♾️',
      'duplasena': '👑',
      'supersete': '🚀',
      'milionaria': '➕',
      'timemania': '🎁'
    };
    return emojis[id] || '🎰';
  };

  const getPrizeColor = (id: string) => {
    const colors: Record<string, string> = {
      'megasena': 'text-emerald-400',
      'lotofacil': 'text-purple-400',
      'quina': 'text-yellow-400',
      'lotomania': 'text-pink-400',
      'duplasena': 'text-yellow-400',
      'supersete': 'text-red-400',
      'milionaria': 'text-green-400',
      'timemania': 'text-rose-400'
    };
    return colors[id] || 'text-pink-400';
  };

  const getGradientClass = (id: string) => {
    const gradients: Record<string, string> = {
      'megasena': 'from-emerald-500/20 to-green-600/20',
      'lotofacil': 'from-purple-500/20 to-violet-600/20',
      'quina': 'from-yellow-500/20 to-amber-600/20',
      'lotomania': 'from-pink-500/20 to-rose-600/20',
      'duplasena': 'from-orange-500/20 to-amber-600/20',
      'supersete': 'from-red-500/20 to-pink-600/20',
      'milionaria': 'from-green-500/20 to-emerald-600/20',
      'timemania': 'from-rose-500/20 to-pink-600/20'
    };
    return gradients[id] || 'from-primary/20 to-secondary/20';
  };

  if (isLoading) {
    return (
      <Card className="border border-white/20 bg-black/25 backdrop-blur-md animate-pulse rounded-3xl">
        <CardContent className="p-4">
          <div className="h-24 bg-muted/20 rounded mb-3"></div>
          <div className="h-4 bg-muted/20 rounded mb-2"></div>
          <div className="h-3 bg-muted/20 rounded mb-4"></div>
          <div className="flex gap-2">
            <div className="h-8 bg-muted/20 rounded flex-1"></div>
            <div className="h-8 bg-muted/20 rounded flex-1"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-white/20 bg-black/25 backdrop-blur-md hover:scale-105 transition-all duration-300 relative overflow-hidden group rounded-3xl">
      <CardContent className="p-4 relative z-10">
        <div className="text-center mb-3">
          <div className="text-3xl mb-2">{getEmojiForLottery(lottery.id)}</div>
          <h3 className="font-bold text-lg text-foreground mb-1" data-testid={`lottery-name-${lottery.id}`}>
            {lottery.displayName}
          </h3>
          <p className="text-xs text-muted-foreground">
            {lottery.minNumbers}-{lottery.maxNumbers} números • {lottery.totalNumbers} disponíveis
          </p>
        </div>

        <div className="space-y-2 mb-4 text-center">
          {nextDraw ? (
            <>
              <div className="flex items-center justify-center space-x-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Concurso #{nextDraw.contestNumber}
                </span>
              </div>

              <div className={`text-lg font-bold ${getPrizeColor(lottery.id)} neon-text`} data-testid={`lottery-prize-${lottery.id}`}>
                {nextDraw.estimatedPrize}
              </div>

              {nextDraw.timeRemaining && (
                <div className="flex items-center justify-center space-x-1">
                  <Clock className="h-3 w-3 text-yellow-400 animate-pulse" />
                  <span className="text-xs font-mono text-yellow-400 font-bold">
                    {String(nextDraw.timeRemaining.days).padStart(2, '0')}d {String(nextDraw.timeRemaining.hours).padStart(2, '0')}h {String(nextDraw.timeRemaining.minutes).padStart(2, '0')}m {String(nextDraw.timeRemaining.seconds || 0).padStart(2, '0')}s
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Carregando dados...</div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2 border-t border-border/30">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs hover:bg-transparent"
            onClick={() => setLocation(`/generator?lottery=${lottery.id}`)}
            data-testid={`quick-generate-${lottery.id}`}
          >
            <Zap className="h-3 w-3 mr-1" />
            Gerar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs hover:bg-transparent"
            onClick={() => setLocation(`/heat-map?lottery=${lottery.id}`)}
            data-testid={`quick-heatmap-${lottery.id}`}
          >
            <Target className="h-3 w-3 mr-1" />
            Mapa
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs hover:bg-transparent"
            onClick={() => setLocation(`/cart?lottery=${lottery.id}`)}
            data-testid={`quick-cart-${lottery.id}`}
          >
            <ShoppingCart className="h-3 w-3 mr-1" />
            Carrinho
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AllLotteriesCard() {
  const { data: lotteryTypes, isLoading: lotteriesLoading } = useLotteryTypes();

  if (lotteriesLoading) {
    return (
      <Card className="bg-black/25 backdrop-blur-md border-white/10 rounded-3xl">
        <CardHeader>
          <CardTitle className="text-primary flex items-center justify-between">
            <div className="flex items-center">
              <Trophy className="h-5 w-5 mr-2 text-accent animate-pulse" />
              Carregando Modalidades...
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="bg-black/25 backdrop-blur-md border-white/10 animate-pulse rounded-3xl">
                <CardContent className="p-4">
                  <div className="h-24 bg-muted/20 rounded mb-3"></div>
                  <div className="h-4 bg-muted/20 rounded mb-2"></div>
                  <div className="h-3 bg-muted/20 rounded mb-4"></div>
                  <div className="flex gap-2">
                    <div className="h-8 bg-muted/20 rounded flex-1"></div>
                    <div className="h-8 bg-muted/20 rounded flex-1"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!lotteryTypes || lotteryTypes.length === 0) {
    return (
      <Card className="bg-black/25 backdrop-blur-md border-white/10 rounded-3xl">
        <CardHeader>
          <CardTitle className="text-primary flex items-center justify-between">
            <div className="flex items-center">
              <Trophy className="h-5 w-5 mr-2 text-destructive" />
              Erro ao Carregar Modalidades
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="text-muted-foreground mb-4">
            Não foi possível carregar as modalidades de loteria
          </div>
          <Button onClick={() => window.location.reload()}>
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/25 backdrop-blur-md border-white/10 rounded-3xl">
      <CardHeader>
        <CardTitle className="text-primary flex items-center justify-between">
          <div className="flex items-center">
            <Trophy className="h-5 w-5 mr-2 text-accent" />
            Todas as Modalidades
          </div>
          <Badge variant="secondary" className="text-xs rounded-3xl">
            {lotteryTypes.length} modalidades
          </Badge>
        </CardTitle>
        <CardDescription>
          Próximos sorteios • Análise em tempo real • IA integrada
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {lotteryTypes.map((lottery) => (
            <div key={lottery.id} className="w-full">
              <SingleLotteryCard lottery={lottery} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}