import { NeonCard } from "@/components/NeonCard";
import { NumberBall } from "@/components/NumberBall";
import { useUserGames, useCheckGames } from "@/hooks/use-lottery";
import { RefreshCw, Trophy, AlertCircle, Clock, History as HistoryIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { useEffect } from "react";

export default function History() {
  const { data: games } = useUserGames();
  const checkGames = useCheckGames();

  useEffect(() => {
    const hasJackpot = games?.some(g => g.status === 'won' && g.hits && g.hits > 5);
    if (hasJackpot) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00ffff', '#ff00ff', '#9d00ff']
      });
    }
  }, [games]);

  return (
    <div className="min-h-screen pb-24" style={{ background: "#0B0F19" }}>
      <main className="max-w-lg mx-auto px-4 pt-6 pb-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-white">Histórico</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">Seus jogos gerados</p>
          </div>
          <button
            onClick={() => checkGames.mutate()}
            disabled={checkGames.isPending}
            className="flex items-center gap-2 px-4 h-[42px] rounded-xl text-[13px] font-semibold border border-white/12 text-foreground/80 hover:border-primary/40 hover:text-primary transition-all"
            style={{ background: "#121826" }}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", checkGames.isPending && "animate-spin")} />
            {checkGames.isPending ? "Verificando..." : "Verificar"}
          </button>
        </div>

        {games && games.length > 0 ? (
          <div className="space-y-3">
            {games.map((game) => (
              <div
                key={game.id}
                className="rounded-2xl border p-4 space-y-3"
                style={{
                  background: "#121826",
                  borderColor: game.status === 'won' ? 'rgba(255,215,0,0.35)' : 'rgba(255,255,255,0.08)',
                }}
              >
                {/* Game header */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-bold text-white uppercase tracking-wide">
                      {game.gameType}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(game.createdAt!).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  {game.status === 'pending' && (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                      <Clock className="h-3 w-3" /> Pendente
                    </span>
                  )}
                  {game.status === 'won' && (
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/30">
                      <Trophy className="h-3 w-3" /> Ganhou · {game.hits} acertos
                    </span>
                  )}
                  {game.status === 'lost' && (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/40 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                      <AlertCircle className="h-3 w-3" /> {game.hits ?? 0} acertos
                    </span>
                  )}
                </div>

                {/* Balls */}
                <div className="flex flex-wrap gap-1.5">
                  {game.numbers.map((num) => (
                    <NumberBall
                      key={num}
                      number={num}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[360px] rounded-2xl border border-dashed border-white/10" style={{ background: "rgba(18,24,38,0.4)" }}>
            <HistoryIcon className="h-10 w-10 text-white/15 mb-3" />
            <p className="text-[14px] text-muted-foreground">Nenhum jogo encontrado.</p>
            <p className="text-[12px] text-muted-foreground/50 mt-1">Gere jogos no Gerador primeiro.</p>
          </div>
        )}
      </main>
    </div>
  );
}
