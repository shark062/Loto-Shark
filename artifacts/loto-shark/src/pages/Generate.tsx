import { useState } from "react";
import { NeonCard } from "@/components/NeonCard";
import { NumberBall } from "@/components/NumberBall";
import { useGenerateNumbers, useSaveGame } from "@/hooks/use-lottery";
import { Flame, Snowflake, Sparkles, Shuffle, Save, CheckCircle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Strategy = "hot" | "cold" | "mixed" | "random";

const strategies = [
  { id: "hot", icon: Flame, label: "HOT", color: "text-red-500", desc: "Frequent numbers" },
  { id: "cold", icon: Snowflake, label: "COLD", color: "text-blue-400", desc: "Rare numbers" },
  { id: "mixed", icon: Sparkles, label: "MIXED", color: "text-purple-400", desc: "Balanced probability" },
  { id: "random", icon: Shuffle, label: "RANDOM", color: "text-green-400", desc: "Pure chaos" },
] as const;

export default function Generate() {
  const [gameType, setGameType] = useState("mega-sena");
  const [quantity, setQuantity] = useState(6);
  const [amountOfGames, setAmountOfGames] = useState(1);
  const [strategy, setStrategy] = useState<Strategy>("mixed");
  
  const generate = useGenerateNumbers();
  const save = useSaveGame();
  
  // Local state for results to display
  const [generatedGames, setGeneratedGames] = useState<Array<{ numbers: number[]; strategy: string; saved?: boolean }>>([]);

  const handleGenerate = async () => {
    const result = await generate.mutateAsync({
      gameType,
      quantity,
      amountOfGames,
      strategy
    });
    setGeneratedGames(result.map(g => ({ ...g, saved: false })));
  };

  const handleSave = async (index: number) => {
    const game = generatedGames[index];
    await save.mutateAsync({
      gameType,
      numbers: game.numbers,
    });
    // Mark as saved locally
    const newGames = [...generatedGames];
    newGames[index].saved = true;
    setGeneratedGames(newGames);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-4xl font-display font-black text-white uppercase">Generator</h1>
          <p className="text-muted-foreground font-ui mt-2">Create optimized combinations using our predictive engine.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls Panel */}
        <div className="lg:col-span-1 space-y-6">
          <NeonCard glowColor="primary" className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Game Type</label>
              <select 
                value={gameType}
                onChange={(e) => setGameType(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              >
                <option value="mega-sena">Mega-Sena</option>
                <option value="lotofacil">Lotofácil</option>
                <option value="quina">Quina</option>
                <option value="lotomania">Lotomania</option>
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Quantity Numbers</label>
                <span className="text-primary font-mono font-bold">{quantity}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="60" // User requested 0-60
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full accent-primary h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground text-right">0 to 60</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Simultaneous Games</label>
                <span className="text-primary font-mono font-bold">{amountOfGames}</span>
              </div>
              <input 
                type="number" 
                min="1" 
                max="50"
                value={amountOfGames}
                onChange={(e) => setAmountOfGames(Number(e.target.value))}
                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-3">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Strategy Engine</label>
              <div className="grid grid-cols-2 gap-2">
                {strategies.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStrategy(s.id as Strategy)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200",
                      strategy === s.id 
                        ? "bg-white/10 border-primary text-white shadow-[0_0_10px_rgba(0,0,0,0.5)]" 
                        : "bg-transparent border-white/5 text-muted-foreground hover:bg-white/5 hover:border-white/20"
                    )}
                  >
                    <s.icon className={cn("w-6 h-6 mb-1", strategy === s.id ? s.color : "text-muted-foreground")} />
                    <span className="text-xs font-bold">{s.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center italic">{strategies.find(s => s.id === strategy)?.desc}</p>
            </div>

            <button 
              onClick={handleGenerate}
              disabled={generate.isPending}
              className="w-full py-4 mt-4 cyber-button bg-primary text-black font-display font-black text-lg rounded-xl uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generate.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <RotateCw className="w-5 h-5 animate-spin" /> Computing...
                </span>
              ) : "Generate Protocol"}
            </button>
          </NeonCard>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          {generatedGames.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence>
                {generatedGames.map((game, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <NeonCard className="p-4" glowColor={game.saved ? "secondary" : "none"}>
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-mono text-muted-foreground bg-white/5 px-2 py-1 rounded uppercase">
                          Game #{idx + 1} • {game.strategy}
                        </span>
                        <button
                          onClick={() => handleSave(idx)}
                          disabled={game.saved || save.isPending}
                          className={cn(
                            "p-2 rounded-lg transition-colors",
                            game.saved 
                              ? "text-green-400 bg-green-400/10 cursor-default" 
                              : "text-muted-foreground hover:text-white hover:bg-white/10"
                          )}
                        >
                          {game.saved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {game.numbers.map((num) => (
                          <NumberBall key={num} number={num} size="sm" />
                        ))}
                      </div>
                    </NeonCard>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-muted-foreground/30 border-2 border-dashed border-white/5 rounded-3xl">
              <Sparkles className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-display text-xl uppercase tracking-widest opacity-50">Waiting for Input</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
