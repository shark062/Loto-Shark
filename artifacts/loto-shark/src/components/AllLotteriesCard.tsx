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
  Flame,
  Bookmark,
  TrendingUp,
  DollarSign,
  Timer,
  ChevronRight,
  Star
} from "lucide-react";
import type { LotteryType } from "@/types/lottery";

function formatPrize(value: string | number | undefined): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string' && value.startsWith('R$')) return value;
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num === 0) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(num);
}

function formatDrawDate(isoDate: string, drawTime?: string): string {
  const d = new Date(isoDate);
  const now = new Date();
  // Usa o drawTime fixo da loteria (já em horário de Brasília) em vez de
  // converter o ISO UTC para local, evitando o deslocamento UTC-3
  const timeStr = drawTime ?? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return `Hoje às ${timeStr}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `Amanhã às ${timeStr}`;
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) +
    ' às ' + timeStr;
}

const LOTTERY_CONFIG: Record<string, {
  emoji: string;
  prizeColor: string;
  borderColor: string;
  bgAccent: string;
  iconBg: string;
}> = {
  megasena:   { emoji: '💎', prizeColor: 'text-emerald-400', borderColor: 'border-l-emerald-500',  bgAccent: 'from-emerald-500/10', iconBg: 'bg-emerald-500/20' },
  lotofacil:  { emoji: '⭐', prizeColor: 'text-purple-400',  borderColor: 'border-l-purple-500',   bgAccent: 'from-purple-500/10',  iconBg: 'bg-purple-500/20'  },
  quina:      { emoji: '🪙', prizeColor: 'text-yellow-400',  borderColor: 'border-l-yellow-500',   bgAccent: 'from-yellow-500/10',  iconBg: 'bg-yellow-500/20'  },
  lotomania:  { emoji: '♾️', prizeColor: 'text-pink-400',   borderColor: 'border-l-pink-500',     bgAccent: 'from-pink-500/10',    iconBg: 'bg-pink-500/20'    },
  duplasena:  { emoji: '👑', prizeColor: 'text-orange-400',  borderColor: 'border-l-orange-500',   bgAccent: 'from-orange-500/10',  iconBg: 'bg-orange-500/20'  },
  timemania:  { emoji: '⚽', prizeColor: 'text-rose-400',    borderColor: 'border-l-rose-500',     bgAccent: 'from-rose-500/10',    iconBg: 'bg-rose-500/20'    },
  diadesorte: { emoji: '🍀', prizeColor: 'text-green-400',   borderColor: 'border-l-green-500',    bgAccent: 'from-green-500/10',   iconBg: 'bg-green-500/20'   },
  supersete:  { emoji: '7️⃣', prizeColor: 'text-red-400',   borderColor: 'border-l-red-500',      bgAccent: 'from-red-500/10',     iconBg: 'bg-red-500/20'     },
};

function getConfig(id: string) {
  return LOTTERY_CONFIG[id] ?? {
    emoji: '🎰', prizeColor: 'text-primary', borderColor: 'border-l-primary',
    bgAccent: 'from-primary/10', iconBg: 'bg-primary/20'
  };
}

interface LotteryCardProps { lottery: LotteryType; }

function SingleLotteryCard({ lottery }: LotteryCardProps) {
  const [, setLocation] = useLocation();
  const { data: nextDraw, isLoading } = useNextDrawInfo(lottery.id);
  const cfg = getConfig(lottery.id);

  if (isLoading) {
    return (
      <div className={`border border-white/10 border-l-4 ${cfg.borderColor} rounded-lg animate-pulse bg-card`}>
        <div className="p-4 flex items-center gap-4">
          <div className="w-11 h-11 bg-muted/20 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted/20 rounded w-1/3" />
            <div className="h-3 bg-muted/20 rounded w-1/2" />
          </div>
          <div className="h-5 bg-muted/20 rounded w-20 shrink-0" />
        </div>
        <div className="px-4 pb-3 flex gap-2">
          <div className="h-8 bg-muted/20 rounded flex-1" />
          <div className="h-8 bg-muted/20 rounded flex-1" />
          <div className="h-8 bg-muted/20 rounded flex-1" />
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
      className={`border border-white/10 border-l-4 ${cfg.borderColor} rounded-lg bg-card hover:bg-card/80 transition-all duration-200 hover:shadow-lg hover:shadow-black/20 group overflow-hidden`}
    >
      {/* Top: ícone + nome + prize */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Ícone estilizado */}
          <div className={`w-11 h-11 ${cfg.iconBg} rounded-xl flex items-center justify-center text-xl shrink-0 border border-white/10 shadow-sm`}>
            {cfg.emoji}
          </div>

          {/* Nome + meta-info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-bold text-sm text-foreground leading-tight" data-testid={`lottery-name-${lottery.id}`}>
                {lottery.displayName}
              </h3>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal border-white/15 text-muted-foreground">
                {lottery.minNumbers}–{lottery.maxNumbers} dezenas
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {lottery.totalNumbers} números
              </span>
              {nextDraw?.drawDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDrawDate(nextDraw.drawDate, nextDraw.drawTime)}
                </span>
              )}
            </div>
          </div>

          {/* Concurso badge */}
          {nextDraw?.contestNumber && (
            <Badge variant="secondary" className="text-[10px] px-2 shrink-0 font-mono bg-white/5 border border-white/10">
              #{nextDraw.contestNumber}
            </Badge>
          )}
        </div>

        {/* Prêmio + Countdown */}
        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5 flex items-center gap-1">
              <DollarSign className="h-2.5 w-2.5" />
              Prêmio estimado
            </div>
            <div className={`text-lg font-black ${hasPrize ? cfg.prizeColor : 'text-muted-foreground'} leading-tight`} data-testid={`lottery-prize-${lottery.id}`}>
              {hasPrize ? prize : 'Consulte a Caixa'}
            </div>
          </div>

          {hasCountdown && (
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5 flex items-center justify-end gap-1">
                <Timer className="h-2.5 w-2.5" />
                Conta regressiva
              </div>
              <div className="flex items-center gap-1">
                {tr.days > 0 && (
                  <span className="bg-white/10 border border-white/10 rounded px-1.5 py-0.5 font-mono text-xs font-bold text-yellow-400">
                    {String(tr.days).padStart(2, '0')}d
                  </span>
                )}
                <span className="bg-white/10 border border-white/10 rounded px-1.5 py-0.5 font-mono text-xs font-bold text-yellow-400">
                  {String(tr.hours).padStart(2, '0')}h
                </span>
                <span className="bg-white/10 border border-white/10 rounded px-1.5 py-0.5 font-mono text-xs font-bold text-yellow-400">
                  {String(tr.minutes).padStart(2, '0')}m
                </span>
                <span className="bg-white/10 border border-white/10 rounded px-1.5 py-0.5 font-mono text-xs font-bold text-yellow-300 animate-pulse">
                  {String(tr.seconds ?? 0).padStart(2, '0')}s
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="px-4 pb-3 flex gap-2 border-t border-white/5 pt-3">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 gap-1.5 text-xs font-medium border-white/10 hover:border-yellow-500/50 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all"
          onClick={() => setLocation(`/generator?lottery=${lottery.id}`)}
          data-testid={`quick-generate-${lottery.id}`}
        >
          <Zap className="h-3.5 w-3.5" />
          Gerar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 gap-1.5 text-xs font-medium border-white/10 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
          onClick={() => setLocation(`/heat-map?lottery=${lottery.id}`)}
          data-testid={`quick-heatmap-${lottery.id}`}
        >
          <Flame className="h-3.5 w-3.5" />
          Calor
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 gap-1.5 text-xs font-medium border-white/10 hover:border-blue-500/50 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
          onClick={() => setLocation(`/results`)}
          data-testid={`quick-results-${lottery.id}`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Resultados
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
        <CardContent className="p-4 pt-0 space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="border border-white/10 border-l-4 border-l-white/20 rounded-lg animate-pulse bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-muted/20 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted/20 rounded w-1/3" />
                  <div className="h-3 bg-muted/20 rounded w-1/2" />
                </div>
                <div className="h-5 bg-muted/20 rounded w-16 shrink-0" />
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
      <CardContent className="p-4 pt-0 space-y-2.5">
        {lotteryTypes.map((lottery) => (
          <SingleLotteryCard key={lottery.id} lottery={lottery} />
        ))}
      </CardContent>
    </Card>
  );
}
