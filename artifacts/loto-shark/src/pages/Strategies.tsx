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
    emoji: "",
    name: "Predições com IA",
    description: "Motor autônomo com 26 engines — analisa padrões, entropia, correlação, ROI e aprendizado contínuo.",
    tags: ["Recomendado", "IA", "Pipeline v3"],
    color: "text-primary",
    border: "border-primary/40",
    bg: "bg-primary/10",
    tagColor: "bg-primary/20 text-primary border-primary/30",
  },
  {
    id: "hot",
    icon: Flame,
    emoji: "🔥",
    name: "Números Quentes",
    description: "Prioriza dezenas com alta frequência nos últimos sorteios. Ideal para quem acredita em sequências.",
    tags: ["Frequência", "Recente"],
    color: "text-red-400",
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    tagColor: "bg-red-500/20 text-red-300 border-red-500/30",
  },
  {
    id: "cold",
    icon: Snowflake,
    emoji: "❄️",
    name: "Números Frios",
    description: "Foca nos números com maior atraso acumulado. Baseado na teoria de compensação estatística.",
    tags: ["Atraso", "Compensação"],
    color: "text-blue-400",
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    tagColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  },
  {
    id: "mixed",
    icon: Sun,
    emoji: "♨️",
    name: "Estratégia Mista",
    description: "Combina 40% quentes, 30% mornos e 30% frios. Equilibra diferentes temperaturas estatísticas.",
    tags: ["Balanceado", "Geral"],
    color: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    tagColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  {
    id: "desdobramento",
    icon: Shuffle,
    emoji: "🔀",
    name: "Desdobramento",
    description: "Escolha mais dezenas e gere todas as combinações possíveis de uma vez. Maximize cobertura.",
    tags: ["Cobertura", "Combinações"],
    color: "text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    tagColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  {
    id: "manual",
    icon: Target,
    emoji: "🎯",
    name: "Escolha Manual",
    description: "Selecione suas dezenas favoritas diretamente na cartela. Controle total sobre os números.",
    tags: ["Manual", "Personalizado"],
    color: "text-violet-400",
    border: "border-violet-500/30",
    bg: "bg-violet-500/5",
    tagColor: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  },
];

const ENGINE_FEATURES = [
  { icon: Brain,      label: "HyperScore Engine",     desc: "Pontuação multidimensional de cada jogo" },
  { icon: Activity,   label: "Entropia & Distribuição", desc: "Análise de aleatoriedade e equilíbrio" },
  { icon: BarChart3,  label: "Correlação Estatística", desc: "Pares e grupos de números correlacionados" },
  { icon: TrendingUp, label: "Tendência Temporal",     desc: "Padrões de saída por período do mês" },
  { icon: Shield,     label: "Anti-Padrões Populares", desc: "Evita combinações ultra-jogadas" },
  { icon: Zap,        label: "ROI Optimizer",          desc: "Estima retorno esperado por jogo" },
];

export default function Strategies() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <main className="container mx-auto px-4 pt-6 pb-4 max-w-lg">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-foreground tracking-tight">Estratégias</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Escolha o método de geração ideal para o seu perfil
          </p>
        </div>

        {/* Strategy Cards */}
        <div className="space-y-3 mb-8">
          {STRATEGIES.map((s) => {
            const Icon = s.icon;
            const isShark = s.id === "shark";
            return (
              <Card
                key={s.id}
                className={`border ${s.border} ${s.bg} cursor-pointer hover:brightness-110 transition-all`}
                onClick={() => setLocation(`/generator?strategy=${s.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl bg-white/5 border ${s.border} shrink-0`}>
                      <Icon className={`h-5 w-5 ${s.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-bold text-sm ${s.color}`}>
                          {s.emoji ? `${s.emoji} ` : ""}{s.name}
                        </h3>
                        {isShark && (
                          <span className="text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.5 rounded-full">
                            ELITE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{s.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {s.tags.map(t => (
                          <span key={t} className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${s.tagColor}`}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* SharkCore Engine Features */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Pipeline SharkCore v3</h2>
            <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded font-mono">26 engines</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {ENGINE_FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3 bg-white/3 rounded-xl px-3 py-2.5 border border-white/8">
                <Icon className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground/90">{label}</p>
                  <p className="text-[11px] text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <Button
          className="w-full bg-primary/20 border border-primary/50 hover:bg-primary/30 text-primary font-bold"
          onClick={() => setLocation("/generator")}
        >
          <Zap className="h-4 w-4 mr-2" />
          Gerar Jogos Agora
        </Button>
      </main>

    </div>
  );
}
