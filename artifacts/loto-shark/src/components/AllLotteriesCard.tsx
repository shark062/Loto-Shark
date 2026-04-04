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

function formatPrize(value: string | number | undefined): string {
  if (value === undefined || value === null) return 'R$ 0,00';
  if (typeof value === 'string' && value.startsWith('R$')) return value;
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num === 0) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(num);
}

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
      <Card className="border border-white/10 animate-pulse">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-muted/20 rounded-full shrink-0"></div>
            <div className="flex-1">
              <div className="h-4 bg-muted/20 rounded mb-2 w-1/3"></div>
              <div className="h-3 bg-muted/20 rounded mb-2 w-1/4"></div>
              <div className="h-5 bg-muted/20 rounded w-1/2"></div>
            </div>
            <div className="flex gap-2 shrink-0">
              <div className="h-8 w-8 bg-muted/20 rounded"></div>
              <div className="h-8 w-8 bg-muted/20 rounded"></div>
              <div className="h-8 w-8 bg-muted/20 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-white/10 hover:border-white/20 transition-all duration-300 relative overflow-hidden group">
      <CardContent className="p-4 relative z-10">
        <div className="flex items-center gap-4">
          {/* Emoji + Nome */}
          <div className="flex items-center gap-3 w-36 shrink-0">
            <span className="text-2xl">{getEmojiForLottery(lottery.id)}</span>
            <div>
              <h3 className="font-bold text-sm text-foreground leading-tight" data-testid={`lottery-name-${lottery.id}`}>
                {lottery.displayName}
              </h3>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {lottery.minNumbers}–{lottery.maxNumbers} de {lottery.totalNumbers}
              </p>
            </div>
          </div>

          {/* Prêmio + Countdown */}
          <div className="flex-1 min-w-0">
            {nextDraw ? (
              <>
                <div className={`text-base font-bold ${getPrizeColor(lottery.id)} neon-text leading-tight`} data-testid={`lottery-prize-${lottery.id}`}>
                  {formatPrize(nextDraw.estimatedPrize)}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">#{nextDraw.contestNumber}</span>
                  </div>
                  {nextDraw.timeRemaining && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-yellow-400 animate-pulse" />
                      <span className="text-[10px] font-mono text-yellow-400 font-semibold">
                        {String(nextDraw.timeRemaining.days).padStart(2, '0')}d {String(nextDraw.timeRemaining.hours).padStart(2, '0')}h {String(nextDraw.timeRemaining.minutes).padStart(2, '0')}m
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-1 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setLocation(`/generator?lottery=${lottery.id}`)}
              data-testid={`quick-generate-${lottery.id}`}
              title="Gerar jogos"
            >
              <Zap className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setLocation(`/heat-map?lottery=${lottery.id}`)}
              data-testid={`quick-heatmap-${lottery.id}`}
              title="Mapa de calor"
            >
              <Target className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setLocation(`/cart?lottery=${lottery.id}`)}
              data-testid={`quick-cart-${lottery.id}`}
              title="Carrinho"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AllLotteriesCard() {
  const { data: lotteryTypes, isLoading: lotteriesLoading } = useLotteryTypes();

  if (lotteriesLoading) {
    return (
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-primary flex items-center justify-between text-base">
            <div className="flex items-center">
              <Trophy className="h-4 w-4 mr-2 text-accent animate-pulse" />
              Carregando Modalidades...
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-1 gap-3">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-muted/20 rounded-full shrink-0"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted/20 rounded mb-2 w-1/3"></div>
                      <div className="h-3 bg-muted/20 rounded w-1/4"></div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <div className="h-8 w-8 bg-muted/20 rounded"></div>
                      <div className="h-8 w-8 bg-muted/20 rounded"></div>
                      <div className="h-8 w-8 bg-muted/20 rounded"></div>
                    </div>
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
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-primary flex items-center text-base">
            <Trophy className="h-4 w-4 mr-2 text-destructive" />
            Erro ao Carregar Modalidades
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6 p-4">
          <div className="text-muted-foreground mb-3 text-sm">
            Não foi possível carregar as modalidades de loteria
          </div>
          <Button size="sm" onClick={() => window.location.reload()}>
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-primary flex items-center justify-between text-base">
          <div className="flex items-center">
            <Trophy className="h-4 w-4 mr-2 text-accent" />
            Todas as Modalidades
          </div>
          <Badge variant="secondary" className="text-xs">
            {lotteryTypes.length} modalidades
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Próximos sorteios • Análise em tempo real • IA integrada
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-1 gap-3">
          {lotteryTypes.map((lottery) => (
            <SingleLotteryCard key={lottery.id} lottery={lottery} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}