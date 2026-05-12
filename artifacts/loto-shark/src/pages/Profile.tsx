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
  ShieldCheck,
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
    { label: "Provedores de IA", icon: Brain,        path: "/ai-providers" },
    { label: "Métricas IA",      icon: Activity,     path: "/ai-metrics" },
    { label: "Status da API",    icon: ShieldCheck,  path: "/api-status" },
    { label: "Dashboard",        icon: Cpu,          path: "/advanced-dashboard" },
    { label: "Informações",      icon: Settings,     path: "/information" },
  ];

  return (
    <div className="min-h-screen pb-24" style={{ background: "#0B0F19" }}>
      <main className="max-w-lg mx-auto px-4 pt-6 pb-4">

        {/* Avatar + Name */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-primary/30" style={{ background: "rgba(0,210,255,0.10)" }}>
            <User className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="text-[17px] font-bold text-white">Jogador Shark</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[12px] text-emerald-400">Sistema Online</span>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {[
            { label: "Jogos",    value: totalGames,   icon: Dice6,     color: "text-primary" },
            { label: "Ganhos",   value: wonGames,     icon: Trophy,    color: "text-amber-400" },
            { label: "Pendentes",value: pendingGames, icon: Calendar,  color: "text-white/60" },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-2xl border border-white/8 p-3 text-center" style={{ background: "#121826" }}>
                <Icon className={`h-4 w-4 mx-auto mb-1.5 ${stat.color}`} />
                <p className={`text-[20px] font-black ${stat.color}`}>{stat.value}</p>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Recent games */}
        {recentGames.length > 0 && (
          <div className="rounded-2xl border border-white/8 p-4 mb-4" style={{ background: "#121826" }}>
            <h2 className="text-[13px] font-bold text-white mb-3">Jogos Recentes</h2>
            <div className="space-y-2.5">
              {recentGames.map((game: any, i: number) => (
                <div key={game.id ?? i} className="rounded-xl border border-white/6 p-2.5" style={{ background: "#0B0F19" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-white/70 uppercase">{game.lotteryId}</span>
                    {game.status === "won" && (
                      <Badge className="text-[10px] bg-amber-400/15 text-amber-300 border-amber-400/25 py-0 px-2">
                        <Trophy className="h-2.5 w-2.5 mr-1" /> Ganhou
                      </Badge>
                    )}
                    {game.status === "pending" && (
                      <Badge variant="outline" className="text-[10px] text-white/50 border-white/10 py-0 px-2">
                        Pendente
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(game.selectedNumbers ?? game.numbers ?? []).map((n: number) => (
                      <NumberBall key={n} number={n} size="xs" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="rounded-2xl border border-white/8 p-4 mb-4" style={{ background: "#121826" }}>
          <h2 className="text-[13px] font-bold text-white mb-3">Ferramentas</h2>
          <div className="space-y-1.5">
            {quickLinks.map(({ label, icon: Icon, path }) => (
              <button
                key={path}
                onClick={() => setLocation(path)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left border border-white/6 hover:border-primary/25 hover:bg-primary/5 transition-all"
                style={{ background: "#0B0F19" }}
              >
                <Icon className="h-4 w-4 text-primary shrink-0" />
                <span className="text-[13px] font-medium text-foreground/80 flex-1">{label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>

        {/* System status */}
        {systemStatus && (
          <div className="rounded-2xl border border-white/8 p-4" style={{ background: "#121826" }}>
            <h2 className="text-[13px] font-bold text-white mb-3">Status do Sistema</h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl p-2.5 border border-white/6" style={{ background: "#0B0F19" }}>
                <p className="text-[10px] text-muted-foreground mb-0.5">Pipeline</p>
                <p className="text-[12px] font-bold text-emerald-400">{systemStatus.pipelineVersion ?? "v3"}</p>
              </div>
              <div className="rounded-xl p-2.5 border border-white/6" style={{ background: "#0B0F19" }}>
                <p className="text-[10px] text-muted-foreground mb-0.5">Engines</p>
                <p className="text-[12px] font-bold text-primary">{systemStatus.enginesActive ?? "26"}</p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
