import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Brain,
  Zap,
  BarChart3,
  Activity,
  TrendingUp,
  Shield,
  CheckCircle2,
  Cpu,
  Clock,
} from "lucide-react";

interface GameInsightsProps {
  pipeline?: {
    version?: string;
    targetContest?: number;
    executionMs?: number;
    metrics?: {
      diversityScore?: number;
      coverageScore?: number;
      enginesActive?: number | string[];
    };
    qualityRanking?: Array<{ rank: number; medal: string; score: number }>;
    sorteiosAnalisados?: number;
    sharkCoreVersion?: string;
  };
  game?: {
    hyperScore?: number;
    hyperGrade?: string;
    qualityScore?: number;
    qualityMedal?: string;
    entropyScore?: number;
    correlationScore?: number;
    distributionScore?: number;
    trendScore?: number;
    roiEstimate?: number;
    precisionScore?: number;
    sharkScore?: number;
    confidence?: number;
    sharkContexto?: any;
  };
}

// Normalizes hyperScore (0–1000) or qualityScore (0–1000) to 0–100
function normalize(v?: number): number {
  if (v == null) return 0;
  return v > 100 ? Math.round(v / 10) : Math.round(v);
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

type MedalKey = "S" | "A" | "B" | "C" | "ouro" | "prata" | "bronze" | "sem_medalha" | "OURO" | "PRATA" | "BRONZE";

function MedalBadge({ raw }: { raw?: string }) {
  if (!raw) return null;
  const key = raw.toUpperCase();

  const config: Record<string, { label: string; className: string }> = {
    S:           { label: "S — ELITE",  className: "bg-yellow-400/20 text-yellow-200 border-yellow-400/60" },
    A:           { label: "A — ÓTIMO",  className: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50" },
    B:           { label: "B — BOM",    className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" },
    C:           { label: "C — MÉDIO",  className: "bg-slate-400/20 text-slate-300 border-slate-400/50" },
    OURO:        { label: "OURO",       className: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50" },
    PRATA:       { label: "PRATA",      className: "bg-slate-400/20 text-slate-300 border-slate-400/50" },
    BRONZE:      { label: "BRONZE",     className: "bg-amber-700/20 text-amber-400 border-amber-700/50" },
    SEM_MEDALHA: { label: "BÁSICO",     className: "bg-white/5 text-muted-foreground border-white/15" },
  };

  const c = config[key] ?? config["BRONZE"];
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${c.className}`}>
      {c.label}
    </span>
  );
}

export default function GameInsightsCard({ pipeline, game }: GameInsightsProps) {
  if (!pipeline && !game) return null;

  // Main score — hyperScore is 0-1000, normalize to 0-100 for display
  const rawHyper    = game?.hyperScore;
  const rawQuality  = game?.qualityScore;
  const mainScore   = normalize(rawHyper ?? rawQuality ?? game?.precisionScore ?? game?.sharkScore);
  const displayScore = rawHyper != null ? rawHyper : (rawQuality ?? game?.precisionScore ?? game?.sharkScore ?? 0);
  const gradeRaw    = game?.hyperGrade;
  const medalRaw    = game?.qualityMedal;

  const precision     = normalize(game?.precisionScore);
  const entropy       = normalize(game?.entropyScore);
  const correlation   = normalize(game?.correlationScore);
  const distribution  = normalize(game?.distributionScore);
  const trend         = normalize(game?.trendScore);
  const roi           = game?.roiEstimate != null ? Math.round(game.roiEstimate) : null;

  const enginesRaw = pipeline?.metrics?.enginesActive;
  const enginesCount = Array.isArray(enginesRaw) ? enginesRaw.length : (enginesRaw ?? 0);

  const diversity  = Math.round((pipeline?.metrics?.diversityScore ?? 0) * 100);
  const coverage   = Math.round((pipeline?.metrics?.coverageScore ?? 0) * 100);

  const scoreColor =
    mainScore >= 80 ? "text-yellow-300" :
    mainScore >= 65 ? "text-emerald-400" :
    mainScore >= 50 ? "text-sky-400" :
    "text-slate-400";

  const barColor =
    mainScore >= 80 ? "bg-yellow-400" :
    mainScore >= 65 ? "bg-emerald-400" :
    mainScore >= 50 ? "bg-sky-400" :
    "bg-slate-500";

  const metrics = [
    { label: "Precisão",     value: precision,   color: "bg-primary",     icon: Brain },
    { label: "Entropia",     value: entropy,     color: "bg-cyan-500",    icon: Activity },
    { label: "Correlação",   value: correlation, color: "bg-violet-500",  icon: BarChart3 },
    { label: "Distribuição", value: distribution,color: "bg-emerald-500", icon: TrendingUp },
    { label: "Tendência",    value: trend,       color: "bg-orange-500",  icon: Zap },
    { label: "Cobertura",    value: coverage,    color: "bg-sky-500",     icon: Shield },
  ];

  const checks: string[] = [];
  if (precision >= 70)    checks.push("Alta precisão estatística");
  if (entropy >= 65)      checks.push("Boa distribuição de entropia");
  if (distribution >= 60) checks.push("Distribuição equilibrada");
  if (diversity >= 50)    checks.push("Alta diversidade entre jogos");
  if (coverage >= 50)     checks.push("Boa cobertura do universo");
  if ((game?.confidence ?? 0) > 0.6) checks.push("Confiança elevada");

  return (
    <Card className="neon-border bg-black/20 border-primary/40 shadow-lg shadow-primary/10">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-primary flex items-center gap-2">
            <Brain className="h-4 w-4" />
            SharkCore — Análise de Qualidade
          </CardTitle>
          <div className="flex items-center gap-2">
            {gradeRaw && <MedalBadge raw={gradeRaw} />}
            {!gradeRaw && medalRaw && <MedalBadge raw={medalRaw} />}
            {pipeline?.sharkCoreVersion && (
              <span className="text-[10px] text-muted-foreground font-mono bg-white/5 px-1.5 py-0.5 rounded">
                v{pipeline.sharkCoreVersion}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* Main score */}
        <div className="flex items-center gap-4 bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="text-center shrink-0">
            <div className={`text-3xl font-black tabular-nums leading-none ${scoreColor}`}>
              {typeof displayScore === 'number' ? Math.round(displayScore) : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
              {rawHyper != null ? "HYPER" : "SCORE"}
            </div>
            {rawHyper != null && (
              <div className="text-[10px] text-muted-foreground">de 1000</div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <ScoreBar value={mainScore} color={barColor} />
              <span className="text-xs text-muted-foreground w-8 text-right">{mainScore}%</span>
            </div>
            {roi != null && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-emerald-400" />
                ROI estimado: <span className="text-emerald-400 font-semibold">{roi}%</span>
              </div>
            )}
            {enginesCount > 0 && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Cpu className="h-3 w-3 text-primary" />
                {enginesCount} engines ativos
              </div>
            )}
          </div>
        </div>

        {/* Metric bars */}
        <div className="space-y-2">
          {metrics.map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
              <ScoreBar value={value} color={color} />
              <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{value}</span>
            </div>
          ))}
        </div>

        {/* Checkmarks */}
        {checks.length > 0 && (
          <div className="border-t border-white/10 pt-3 space-y-1.5">
            {checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-emerald-300/80">
                <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                {c}
              </div>
            ))}
          </div>
        )}

        {/* Pipeline metadata */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground border-t border-white/10 pt-2">
          {pipeline?.sorteiosAnalisados && (
            <span>📊 {pipeline.sorteiosAnalisados} sorteios</span>
          )}
          {pipeline?.targetContest != null && pipeline.targetContest > 0 && (
            <span>🎯 Concurso #{pipeline.targetContest}</span>
          )}
          {pipeline?.executionMs && (
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {pipeline.executionMs}ms
            </span>
          )}
          {pipeline?.version && (
            <span className="font-mono">Pipeline {pipeline.version}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
