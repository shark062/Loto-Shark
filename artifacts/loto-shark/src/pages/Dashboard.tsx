import { NeonCard } from "@/components/NeonCard";
import { NumberBall } from "@/components/NumberBall";
import { useLatestResult, useUserGames } from "@/hooks/use-lottery";
import { ArrowRight, Trophy, Zap, Activity } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: latestMega } = useLatestResult("mega-sena");
  const { data: userGames } = useUserGames();

  // Simple stats
  const totalGames = userGames?.length || 0;
  const pendingGames = userGames?.filter(g => g.status === 'pending').length || 0;
  
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/50 via-purple-900/20 to-black border border-white/10 p-8 md:p-12">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="max-w-2xl">
            <h2 className="text-4xl md:text-6xl font-display font-black text-white mb-4 leading-tight">
              PREDICT THE <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-white to-secondary animate-pulse">
                FUTURE
              </span>
            </h2>
            <p className="text-lg text-muted-foreground font-ui max-w-md">
              Welcome to the advanced lottery analysis system. 
              AI-driven insights for maximum probability.
            </p>
          </div>
          
          <Link href="/generate" className="cyber-button px-8 py-4 bg-primary text-black font-bold rounded-xl font-display uppercase tracking-widest hover:shadow-[0_0_30px_rgba(0,255,255,0.4)]">
            Start Engine
          </Link>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <NeonCard glowColor="secondary">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-ui uppercase tracking-wider">Next Jackpot</p>
              <h3 className="text-3xl font-display font-bold text-white mt-1">
                R$ {latestMega?.nextPrizeEstimate ? (latestMega.nextPrizeEstimate / 1000000).toFixed(1) + "M" : "Loading..."}
              </h3>
            </div>
            <div className="p-3 bg-secondary/10 rounded-xl text-secondary">
              <Trophy className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-secondary/80 font-mono">MEGA-SENA • CONTEST {latestMega?.contestNumber}</p>
          </div>
        </NeonCard>

        <NeonCard glowColor="primary">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-ui uppercase tracking-wider">AI Learning Status</p>
              <h3 className="text-3xl font-display font-bold text-white mt-1">98.4%</h3>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <Activity className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden">
              <div className="h-full bg-primary w-[98.4%] shadow-[0_0_10px_cyan]" />
            </div>
          </div>
        </NeonCard>

        <NeonCard glowColor="accent">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-ui uppercase tracking-wider">Active Games</p>
              <h3 className="text-3xl font-display font-bold text-white mt-1">{pendingGames}</h3>
            </div>
            <div className="p-3 bg-accent/10 rounded-xl text-accent">
              <Zap className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-accent/80 font-mono">TOTAL HISTORY: {totalGames} GAMES</p>
          </div>
        </NeonCard>
      </div>

      {/* Latest Draw */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <NeonCard className="min-h-[300px]" glowColor="none">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-display font-bold text-white">LATEST DRAW</h3>
            <span className="text-xs font-mono text-muted-foreground bg-white/5 px-2 py-1 rounded">
              {latestMega?.date ? new Date(latestMega.date).toLocaleDateString() : '--/--/----'}
            </span>
          </div>
          
          {latestMega ? (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-3 justify-center py-8">
                {latestMega.numbers.map((num) => (
                  <NumberBall key={num} number={num} size="lg" variant="cold" />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 bg-black/20 rounded-xl">
                  <p className="text-xs text-muted-foreground uppercase">Winners</p>
                  <p className="text-xl font-mono text-white">{latestMega.winnersCount}</p>
                </div>
                <div className="p-4 bg-black/20 rounded-xl">
                  <p className="text-xs text-muted-foreground uppercase">Prize</p>
                  <p className="text-xl font-mono text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(latestMega.prizeEstimate || 0)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Activity className="w-8 h-8 mb-2 animate-spin" />
              Loading results data stream...
            </div>
          )}
        </NeonCard>

        <NeonCard glowColor="none" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
          {/* Cyberpunk city image overlay */}
          <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1515630278258-407f66498911?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay" />
          
          <div className="relative z-20 h-full flex flex-col justify-end">
            <h3 className="text-2xl font-display font-bold text-white mb-2">SYSTEM READY</h3>
            <p className="text-muted-foreground mb-6">
              Neural networks calibrated. Probability engine online. 
              Start generating your next winning combination.
            </p>
            <Link href="/generate" className="flex items-center gap-2 text-primary hover:text-white transition-colors group">
              <span className="font-ui font-bold tracking-wider">EXECUTE PROTOCOL</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </NeonCard>
      </div>
    </div>
  );
}
