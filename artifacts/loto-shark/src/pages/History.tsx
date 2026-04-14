import { NeonCard } from "@/components/NeonCard";
import { NumberBall } from "@/components/NumberBall";
import { useUserGames, useCheckGames } from "@/hooks/use-lottery";
import { RefreshCw, Trophy, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { useEffect } from "react";

export default function History() {
  const { data: games } = useUserGames();
  const checkGames = useCheckGames();

  // Effect to trigger confetti if any recent win detected
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-4xl font-display font-black text-white uppercase">My History</h1>
        <button
          onClick={() => checkGames.mutate()}
          disabled={checkGames.isPending}
          className="flex items-center gap-2 px-6 py-3 bg-secondary/10 hover:bg-secondary/20 border border-secondary/50 text-secondary rounded-xl transition-all font-bold uppercase tracking-wider"
        >
          <RefreshCw className={cn("w-5 h-5", checkGames.isPending && "animate-spin")} />
          {checkGames.isPending ? "Syncing..." : "Check Results"}
        </button>
      </div>

      {games && games.length > 0 ? (
        <div className="grid gap-4">
          {games.map((game) => (
            <NeonCard 
              key={game.id} 
              glowColor={game.status === 'won' ? 'accent' : 'none'}
              className="flex flex-col md:flex-row items-center justify-between gap-6 p-6"
            >
              <div className="flex flex-col gap-1 w-full md:w-auto">
                <span className="text-xs font-mono text-muted-foreground uppercase">{game.gameType}</span>
                <span className="text-xs text-white/40">{new Date(game.createdAt!).toLocaleDateString()}</span>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {game.numbers.map((num) => (
                  <NumberBall 
                    key={num} 
                    number={num} 
                    size="sm"
                    className={cn(
                      // If game is checked, we might want to highlight matches if we had that data in 'hits' detail
                      // For now simple display
                      "border-white/10"
                    )}
                  />
                ))}
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                {game.status === 'pending' && (
                  <span className="flex items-center gap-2 text-muted-foreground text-sm font-bold uppercase bg-white/5 px-3 py-1 rounded-full">
                    <Clock className="w-4 h-4" /> Pending
                  </span>
                )}
                {game.status === 'won' && (
                  <span className="flex items-center gap-2 text-accent text-sm font-bold uppercase bg-accent/10 px-3 py-1 rounded-full shadow-[0_0_10px_rgba(255,0,255,0.3)]">
                    <Trophy className="w-4 h-4" /> Winner ({game.hits} hits)
                  </span>
                )}
                {game.status === 'lost' && (
                  <span className="flex items-center gap-2 text-white/40 text-sm font-bold uppercase bg-white/5 px-3 py-1 rounded-full">
                    <AlertCircle className="w-4 h-4" /> {game.hits} hits
                  </span>
                )}
              </div>
            </NeonCard>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[400px] border border-dashed border-white/10 rounded-3xl bg-black/20">
          <Clock className="w-16 h-16 text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground font-ui text-lg">No generated games found.</p>
        </div>
      )}
    </div>
  );
}
