import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Flame,
  Snowflake,
  Sun,
  Shuffle,
  Target,
  Zap,
  BarChart3,
  TrendingUp,
  Activity,
  Shield,
  BookOpen,
  ChevronRight,
} from "lucide-react";

const STRATEGIES = [
  {
    id: "shark",
    icon: Brain,
    name: "Predições com IA",
    description: "Motor autônomo com 26 engines — analisa padrões, entropia, correlação, ROI e aprendizado contínuo.",
    tags: ["Recomendado", "IA", "Pipeline v3"],
    color: "text-primary",
    border: "border-primary/30",
    bg: "bg-primary/8",
    tagColor: "bg-primary/15 text-primary border-primary/25",
    badge: "MELHOR",
  },
  {
    id: "hot",
    icon: Flame,
    name: "Números Quentes",
    description: "Prioriza dezenas com alta frequência nos últimos sorteios. Ideal para quem acredita em sequências.",
    tags: ["Frequência", "Recente"],
    color: "text-red-400",
    border: "border-red-500/25",
    bg: "bg-red-500/5",
    tagColor: "bg-red-500/15 text-red-300 border-red-500/25",
    badge: null,
  },
  {
    id: "cold",
    icon: Snowflake,
    name: "Números Frios",
    description: "Foca nos números com maior atraso acumulado. Baseado na teoria de compensação estatística.",
    tags: ["Atraso", "Compensação"],
    color: "text-blue-400",
    border: "border-blue-500/25",
    bg: "bg-blue-500/5",
    tagColor: "bg-blue-500/15 text-blue-300 border-blue-500/25",
    badge: null,
  },
  {
    id: "mixed",
    icon: Sun,
    name: "Estratégia Mista",
    description: "Combina 40% quentes, 30% mornos e 30% frios. Equilibra diferentes temperaturas estatísticas.",
    tags: ["Balanceado", "Geral"],
    color: "text-amber-400",
    border: "border-amber-500/25",
    bg: "bg-amber-500/5",
    tagColor: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    badge: null,
  },
  {
    id: "desdobramento",
    icon: Shuffle,
    name: "Desdobramento",
    description: "Escolha mais dezenas e gere todas as combinações possíveis de uma vez. Maximize cobertura.",
    tags: ["Cobertura", "Combinações"],
    color: "text-emerald-400",
    border: "border-emerald-500/25",
    bg: "bg-emerald-500/5",
    tagColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    badge: null,
  },
  {
    id: "manual",
    icon: Target,
    name: "Escolha Manual",
    description: "Você escolhe os números. O sistema calcula o potencial e métricas da sua seleção.",
    tags: ["Livre", "Controle total"],
    color: "text-purple-400",
    border: "border-purple-500/25",
    bg: "bg-purple-500/5",
    tagColor: "bg-purple-500/15 text-purple-300 border-purple-500/25",
    badge: null,
  },
];

const MATH_ENGINES = [
  { icon: Activity,   name: "Adaptive Entropy Rebalance",       desc: "Mede a entropia de Shannon da combinação e penaliza padrões extremos." },
  { icon: TrendingUp, name: "Dynamic Pair Pressure",            desc: "Avalia coocorrência de pares históricos para medir coesão estrutural." },
  { icon: Shuffle,    name: "Smart Mutation Engine",            desc: "Gera mutações controladas e seleciona o melhor mutante iterativamente." },
  { icon: BarChart3,  name: "Weighted Trend Resonance",         desc: "Compara tendências recentes vs históricas para detectar padrões emergentes." },
  { icon: Brain,      name: "Bayesian Reinforcement",           desc: "Atualiza probabilidades via Bayes usando histórico completo de sorteios." },
  { icon: Shield,     name: "Structural Dispersion Optimizer",  desc: "Avalia dispersão por décimos, paridade, soma relativa e gaps entre números." },
  { icon: Zap,        name: "Collective Coverage Optimizer",    desc: "Garante que o conjunto de jogos cobre o máximo de números possível." },
];

export default function Strategies() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen pb-24" style={{ background: "#0B0F19" }}>
      <main className="max-w-lg mx-auto px-4 pt-6 pb-4">

        {/* Header */}
        <div className="mb-5">
          <h1 className="text-[22px] font-bold text-white">Estratégias</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Métodos de geração de jogos disponíveis
          </p>
        </div>

        {/* Strategies list */}
        <div className="space-y-2.5 mb-6">
          {STRATEGIES.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.id}
                className={`rounded-2xl border p-4 ${s.border} ${s.bg} relative`}
              >
                {s.badge && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full">
                    {s.badge}
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.bg} border ${s.border}`}>
                    <Icon className={`h-4.5 w-4.5 ${s.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] font-bold mb-0.5 ${s.color}`}>{s.name}</p>
                    <p className="text-[12px] text-muted-foreground leading-relaxed">{s.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.tags.map(tag => (
                        <span key={tag} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.tagColor}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Math Engines section */}
        <div className="rounded-2xl border border-white/8 p-4 mb-4" style={{ background: "#121826" }}>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-primary" />
            <h2 className="text-[14px] font-bold text-white">Engines Matemáticos v2</h2>
          </div>
          <p className="text-[12px] text-muted-foreground mb-3 leading-relaxed">
            Além dos 26 engines do pipeline v3, o SharkCore aplica 7 algoritmos matemáticos avançados em cada geração.
          </p>
          <div className="space-y-2.5">
            {MATH_ENGINES.map((e) => {
              const Icon = e.icon;
              return (
                <div key={e.name} className="flex items-start gap-2.5">
                  <Icon className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-foreground/90">{e.name}</p>
                    <p className="text-[11px] text-muted-foreground">{e.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <Button
          className="w-full h-[48px] bg-primary/15 border border-primary/40 hover:bg-primary/25 text-primary font-bold text-[14px] rounded-xl"
          onClick={() => setLocation("/generator")}
        >
          <Zap className="h-4 w-4 mr-2" />
          Gerar Jogos Agora
        </Button>

      </main>
    </div>
  );
}
