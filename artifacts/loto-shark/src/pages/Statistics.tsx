import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import BottomNav from "@/components/BottomNav";
import { useLotteryTypes } from "@/hooks/useLotteryData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberBall } from "@/components/NumberBall";
import {
  BarChart3,
  Flame,
  Snowflake,
  Sun,
  TrendingUp,
  Target,
  Activity,
  ChevronRight,
  Zap,
} from "lucide-react";

const LOTTERY_CONFIG: Record<string, { emoji: string; color: string }> = {
  megasena:       { emoji: "💎", color: "text-emerald-400" },
  lotofacil:      { emoji: "⭐", color: "text-purple-400" },
  quina:          { emoji: "🪙", color: "text-yellow-400" },
  lotomania:      { emoji: "♾️", color: "text-pink-400" },
  duplasena:      { emoji: "👑", color: "text-orange-400" },
  timemania:      { emoji: "⚽", color: "text-rose-400" },
  diadesorte:     { emoji: "🍀", color: "text-green-400" },
  supersete:      { emoji: "7️⃣", color: "text-red-400" },
  maisMilionaria: { emoji: "➕", color: "text-amber-400" },
};

export default function Statistics() {
  const [, setLocation] = useLocation();
  const [selectedLotteryId, setSelectedLotteryId] = useState("megasena");
  const { data: lotteryTypes } = useLotteryTypes();

  const { data: freqData, isLoading } = useQuery({
    queryKey: ["/api/lotteries", selectedLotteryId, "frequency"],
    enabled: !!selectedLotteryId,
    select: (data: any) => {
      const arr = Array.isArray(data) ? data : (data?.frequencies ?? []);
      const meta = Array.isArray(data) ? {} : (data?.meta ?? {});
      return { frequencies: arr, meta };
    },
  });

  const frequencies = freqData?.frequencies ?? [];
  const hot  = frequencies.filter((f: any) => f.temperature === "hot").slice(0, 10);
  const warm = frequencies.filter((f: any) => f.temperature === "warm").slice(0, 8);
  const cold = frequencies.filter((f: any) => f.temperature === "cold").slice(0, 10);
  const cfg  = LOTTERY_CONFIG[selectedLotteryId] ?? { emoji: "🎰", color: "text-primary" };

  const quickLinks = [
    { label: "Mapa de Calor",  icon: Flame,    path: `/heat-map?lottery=${selectedLotteryId}` },
    { label: "Análise IA",     icon: Activity, path: "/ai-analysis" },
    { label: "Métricas IA",    icon: BarChart3, path: "/ai-metrics" },
    { label: "Verificar Jogos",icon: Target,   path: "/results" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <main className="container mx-auto px-4 pt-6 pb-4 max-w-lg">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-black text-foreground tracking-tight">Estatísticas</h1>
          <p className="text-sm text-muted-foreground mt-1">Frequências e análises por modalidade</p>
        </div>

        {/* Lottery selector */}
        <div className="mb-5">
          <Select value={selectedLotteryId} onValueChange={setSelectedLotteryId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a modalidade" />
            </SelectTrigger>
            <SelectContent>
              {lotteryTypes?.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {quickLinks.map(({ label, icon: Icon, path }) => (
            <button
              key={label}
              onClick={() => setLocation(path)}
              className="flex items-center gap-2.5 bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl px-3 py-2.5 transition-colors text-left"
            >
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-medium text-foreground/80">{label}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
            </button>
          ))}
        </div>

        {/* Frequency breakdown */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-black/30 animate-pulse p-4 h-28" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Hot */}
            {hot.length > 0 && (
              <Card className="border-red-500/30 bg-red-500/5">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs font-bold text-red-400 flex items-center gap-2">
                    <Flame className="h-3.5 w-3.5" />
                    Dezenas Quentes — alta frequência recente
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {hot.map((f: any) => (
                      <div key={f.number} className="flex flex-col items-center gap-0.5">
                        <NumberBall number={f.number} size="xs" temperature="hot" />
                        <span className="text-[9px] text-red-300/70 tabular-nums">{f.frequency}x</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Warm */}
            {warm.length > 0 && (
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs font-bold text-yellow-400 flex items-center gap-2">
                    <Sun className="h-3.5 w-3.5" />
                    Dezenas Mornos — frequência moderada
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {warm.map((f: any) => (
                      <div key={f.number} className="flex flex-col items-center gap-0.5">
                        <NumberBall number={f.number} size="xs" temperature="warm" />
                        <span className="text-[9px] text-yellow-300/70 tabular-nums">{f.frequency}x</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cold */}
            {cold.length > 0 && (
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs font-bold text-blue-400 flex items-center gap-2">
                    <Snowflake className="h-3.5 w-3.5" />
                    Dezenas Frias — maior atraso acumulado
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {cold.map((f: any) => (
                      <div key={f.number} className="flex flex-col items-center gap-0.5">
                        <NumberBall number={f.number} size="xs" temperature="cold" />
                        <span className="text-[9px] text-blue-300/70 tabular-nums">{f.frequency}x</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {!isLoading && frequencies.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum dado disponível</p>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="mt-6">
          <Button
            className="w-full bg-primary/20 border border-primary/50 hover:bg-primary/30 text-primary font-bold"
            onClick={() => setLocation(`/generator?lottery=${selectedLotteryId}`)}
          >
            <Zap className="h-4 w-4 mr-2" />
            Gerar com essa Modalidade
          </Button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
