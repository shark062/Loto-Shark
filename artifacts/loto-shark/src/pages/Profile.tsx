import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NumberBall } from "@/components/NumberBall";
import {
  User,
  Trophy,
  Dice6,
  TrendingUp,
  Calendar,
  ChevronRight,
  Settings,
  Brain,
  Cpu,
  Award,
  Activity,
} from "lucide-react";

export default function Profile() {
  const [, setLocation] = useLocation();

  const { data: userGames, isLoading } = useQuery<any[]>({
    queryKey: ["/api/user/games"],
    select: (data: any) => Array.isArray(data) ? data : (data?.games ?? []),
  });

  const { data: statusData } = useQuery({
    queryKey: ["/api/v3/status"],
    staleTime: 60_000,
  });

  const games = userGames ?? [];
  const totalGames   = games.length;
  const wonGames     = games.filter((g: any) => g.status === "won").length;
  const pendingGames = games.filter((g: any) => g.status === "pending").length;
  const recentGames  = [...games].sort((a: any, b: any) =>
    new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  ).slice(0, 5);

  const systemStatus = statusData as any;

  const quickLinks = [
    { label: "Provedores de IA", icon: Brain,    path: "/ai-providers" },
    { label: "Métricas IA",      icon: Activity, path: "/ai-metrics" },
    { label: "Dashboard",        icon: Cpu,      path: "/advanced-dashboard" },
    { label: "Informações",      icon: Settings, path: "/information" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <main className="container mx-auto px-4 pt-6 pb-4 max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground">Perfil</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Jogador Loto-Shark</p>
            {systemStatus && (
              <span className="text-[10px] font-mono text-primary/60 bg-primary/10 px-1.5 py-0.5 rounded mt-1 inline-block">
                SharkCore v{systemStatus.version ?? "3"}
              </span>
            )}
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: "Jogos",    value: totalGames,   icon: Dice6,    color: "text-primary" },
            { label: "Ganhos",   value: wonGames,     icon: Trophy,   color: "text-yellow-400" },
            { label: "Ativos",   value: pendingGames, icon: Calendar, color: "text-emerald-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border-white/10 bg-white/3">
              <CardContent className="p-3 text-center">
                <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
                <p className={`text-xl font-black tabular-nums ${color}`}>{isLoading ? "—" : value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* System status */}
        {systemStatus && (
          <Card className="border-primary/20 bg-primary/5 mb-5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-primary">Sistema SharkCore</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  ONLINE
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  Pipeline: <span className="text-foreground font-mono">{systemStatus.pipelineVersion ?? "v3"}</span>
                </div>
                <div>
                  Idioma: <span className="text-foreground">{systemStatus.language ?? "pt-BR"}</span>
                </div>
                {systemStatus.featureFlags && (
                  <div>
                    Flags: <span className="text-foreground">{systemStatus.featureFlags.enabled}/{systemStatus.featureFlags.total}</span>
                  </div>
                )}
                {systemStatus.aiProviders && (
                  <div>
                    IA: <span className="text-foreground">{systemStatus.aiProviders.active} ativo(s)</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent games */}
        {recentGames.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Dice6 className="h-4 w-4 text-primary" />
                Jogos Recentes
              </h2>
              <button
                onClick={() => setLocation("/results")}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Ver todos <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-2">
              {recentGames.map((game: any) => {
                const nums = (game.selectedNumbers || game.numbers || []) as number[];
                const statusColors: Record<string, string> = {
                  won:     "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
                  pending: "bg-blue-500/20 text-blue-300 border-blue-500/30",
                  lost:    "bg-white/5 text-muted-foreground border-white/10",
                };
                const statusLabels: Record<string, string> = {
                  won: "Ganhou", pending: "Pendente", lost: "Perdeu"
                };
                return (
                  <Card key={game.id} className="border-white/10 bg-white/3">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-muted-foreground capitalize">
                          {game.lotteryId}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusColors[game.status] ?? statusColors.pending}`}>
                          {statusLabels[game.status] ?? "Pendente"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {nums.slice(0, 10).map((n: number) => (
                          <NumberBall key={n} number={n} size="xs" />
                        ))}
                        {nums.length > 10 && (
                          <span className="text-[10px] text-muted-foreground self-center">+{nums.length - 10}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            Configurações
          </h2>
          {quickLinks.map(({ label, icon: Icon, path }) => (
            <button
              key={label}
              onClick={() => setLocation(path)}
              className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl px-4 py-3 transition-colors text-left"
            >
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm text-foreground/80 flex-1">{label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            powered by <span className="text-primary font-semibold">Shark062</span>
            <span className="mx-1.5">·</span>
            <span className="font-mono">SharkCore v3.0</span>
          </p>
        </div>
      </main>

    </div>
  );
}
