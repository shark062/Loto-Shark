import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLotteryTypes, useNextDrawInfo } from "@/hooks/useLotteryData";
import {
  Trophy,
  Calendar,
  Clock,
  Zap,
  Target,
  ShoppingCart,
} from "lucide-react";
import type { LotteryType } from "@/types/lottery";

function formatPrize(value: string | number | undefined): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string' && value.startsWith('R$')) return value;
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num === 0) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(num);
}

const LOTTERY_CONFIG: Record<string, {
  emoji: string;
  prizeColor: string;
  borderColor: string;
  accentGlow: string;
}> = {
  megasena:   { emoji: '💎', prizeColor: 'text-emerald-400', borderColor: 'border-emerald-500/30',  accentGlow: 'hover:shadow-emerald-500/10' },
  lotofacil:  { emoji: '⭐', prizeColor: 'text-purple-400',  borderColor: 'border-purple-500/30',   accentGlow: 'hover:shadow-purple-500/10'  },
  quina:      { emoji: '🪙', prizeColor: 'text-yellow-400',  borderColor: 'border-yellow-500/30',   accentGlow: 'hover:shadow-yellow-500/10'  },
  lotomania:  { emoji: '♾️', prizeColor: 'text-pink-400',   borderColor: 'border-pink-500/30',     accentGlow: 'hover:shadow-pink-500/10'    },
  duplasena:  { emoji: '👑', prizeColor: 'text-orange-400',  borderColor: 'border-orange-500/30',   accentGlow: 'hover:shadow-orange-500/10'  },
  timemania:  { emoji: '⚽', prizeColor: 'text-rose-400',    borderColor: 'border-rose-500/30',     accentGlow: 'hover:shadow-rose-500/10'    },
  diadesorte: { emoji: '🍀', prizeColor: 'text-green-400',   borderColor: 'border-green-500/30',    accentGlow: 'hover:shadow-green-500/10'   },
  supersete:  { emoji: '7️⃣', prizeColor: 'text-red-400',   borderColor: 'border-red-500/30',      accentGlow: 'hover:shadow-red-500/10'     },
};

function getConfig(id: string) {
  return LOTTERY_CONFIG[id] ?? {
    emoji: '🎰', prizeColor: 'text-primary', borderColor: 'border-primary/30', accentGlow: 'hover:shadow-primary/10'
  };
}

interface LotteryCardProps { lottery: LotteryType; }

function SingleLotteryCard({ lottery }: LotteryCardProps) {
  const [, setLocation] = useLocation();
  const { data: nextDraw, isLoading } = useNextDrawInfo(lottery.id);
  const cfg = getConfig(lottery.id);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 animate-pulse p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-muted/20 rounded-full" />
          <div className="h-5 bg-muted/20 rounded w-32" />
          <div className="h-3 bg-muted/20 rounded w-44" />
          <div className="h-3 bg-muted/20 rounded w-36" />
          <div className="h-8 bg-muted/20 rounded w-48 mt-1" />
          <div className="h-4 bg-muted/20 rounded w-40" />
          <div className="flex gap-2 mt-2 w-full">
            <div className="h-10 bg-muted/20 rounded-lg flex-1" />
            <div className="h-10 bg-muted/20 rounded-lg flex-1" />
            <div className="h-10 bg-muted/20 rounded-lg flex-1" />
          </div>
        </div>
      </div>
    );
  }

  const prize = formatPrize(nextDraw?.estimatedPrize);
  const hasPrize = prize !== '—';
  const tr = nextDraw?.timeRemaining;
  const hasCountdown = tr && (tr.days > 0 || tr.hours > 0 || tr.minutes > 0);

  return (
    <div
      className={`rounded-2xl border ${cfg.borderColor} bg-black/30 hover:bg-black/40 transition-all duration-200 hover:shadow-xl ${cfg.accentGlow}`}
      data-testid={`lottery-card-${lottery.id}`}
    >
      {/* Corpo centralizado */}
      <div className="px-5 pt-6 pb-4 flex flex-col items-center text-center gap-1.5">
        {/* Emoji */}
        <div className="text-3xl mb-1 leading-none" role="img" aria-label={lottery.displayName}>
          {cfg.emoji}
        </div>

        {/* Nome */}
        <h3
          className="text-xl font-bold text-white tracking-tight"
          data-testid={`lottery-name-${lottery.id}`}
        >
          {lottery.displayName}
        </h3>

        {/* Dezenas disponíveis */}
        <p className="text-sm text-muted-foreground">
          {lottery.minNumbers}–{lottery.maxNumbers} números&nbsp;•&nbsp;{lottery.totalNumbers} disponíveis
        </p>

        {/* Número do concurso */}
        {nextDraw?.contestNumber && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>Concurso #{nextDraw.contestNumber}</span>
          </div>
        )}

        {/* Prêmio estimado */}
        <div
          className={`text-2xl font-black mt-2 tracking-tight ${hasPrize ? cfg.prizeColor : 'text-muted-foreground'}`}
          data-testid={`lottery-prize-${lottery.id}`}
        >
          {hasPrize ? prize : 'Consulte a Caixa'}
        </div>

        {/* Conta regressiva */}
        {hasCountdown && (
          <div className="flex items-center gap-2 mt-1 text-sm">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-mono font-semibold text-yellow-400 tracking-widest">
              {String(tr.days).padStart(2, '0')}d&nbsp;
              {String(tr.hours).padStart(2, '0')}h&nbsp;
              {String(tr.minutes).padStart(2, '0')}m&nbsp;
              {String(tr.seconds ?? 0).padStart(2, '0')}s
            </span>
          </div>
        )}
      </div>

      {/* Botões */}
      <div className="border-t border-white/5 px-4 py-3 flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 h-10 flex-col gap-0.5 text-xs font-semibold rounded-xl bg-white/5 border border-white/10 hover:bg-yellow-500/15 hover:border-yellow-500/30 hover:text-yellow-400 text-foreground/80 transition-all"
          onClick={() => setLocation(`/generator?lottery=${lottery.id}`)}
          data-testid={`quick-generate-${lottery.id}`}
        >
          <Zap className="h-4 w-4" />
          Gerar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 h-10 flex-col gap-0.5 text-xs font-semibold rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 text-foreground/80 transition-all"
          onClick={() => setLocation(`/heat-map?lottery=${lottery.id}`)}
          data-testid={`quick-heatmap-${lottery.id}`}
        >
          <Target className="h-4 w-4" />
          Mapa
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 h-10 flex-col gap-0.5 text-xs font-semibold rounded-xl bg-white/5 border border-white/10 hover:bg-blue-500/15 hover:border-blue-500/30 hover:text-blue-400 text-foreground/80 transition-all"
          onClick={() => setLocation(`/manual-picker?lottery=${lottery.id}`)}
          data-testid={`quick-cart-${lottery.id}`}
        >
          <ShoppingCart className="h-4 w-4" />
          Carrinho
        </Button>
      </div>
    </div>
  );
}

export default function AllLotteriesCard() {
  const { data: lotteryTypes, isLoading: lotteriesLoading } = useLotteryTypes();

  if (lotteriesLoading) {
    return (
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-primary flex items-center gap-2 text-base">
            <div className="w-6 h-6 bg-accent/20 rounded-md flex items-center justify-center">
              <Trophy className="h-3.5 w-3.5 text-accent animate-pulse" />
            </div>
            Carregando Modalidades...
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-black/30 animate-pulse p-6">
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-muted/20 rounded-full" />
                <div className="h-5 bg-muted/20 rounded w-32" />
                <div className="h-3 bg-muted/20 rounded w-44" />
                <div className="h-7 bg-muted/20 rounded w-40 mt-1" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!lotteryTypes || lotteryTypes.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-10">
          <Trophy className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground mb-4">Não foi possível carregar as modalidades</p>
          <Button size="sm" onClick={() => window.location.reload()}>Tentar Novamente</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2.5">
            <div className="w-7 h-7 bg-accent/15 rounded-lg flex items-center justify-center border border-accent/30">
              <Trophy className="h-4 w-4 text-accent" />
            </div>
            <span className="text-foreground">Todas as Modalidades</span>
          </CardTitle>
          <Badge variant="outline" className="text-xs border-white/15 text-muted-foreground font-normal">
            {lotteryTypes.length} modalidades
          </Badge>
        </div>
        <CardDescription className="text-xs mt-1 ml-9.5">
          Próximos sorteios · Análise em tempo real · IA integrada
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex flex-col gap-4">
        {lotteryTypes.map((lottery) => (
          <SingleLotteryCard key={lottery.id} lottery={lottery} />
        ))}
      </CardContent>
    </Card>
  );
}
