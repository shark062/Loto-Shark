// ============================================================
//  Quality Ranking Engine — Ranqueamento Profissional
//  Consolida todos os scores parciais em uma classificação
//  final de qualidade para cada jogo gerado.
//  Produce rankings com medalhas e justificativas.
// ============================================================

// ─── Tipos ────────────────────────────────────────────────────

export interface GameQualityInput {
  numbers:          number[];
  hyperScore?:      number;   // 0–1000
  precisionScore?:  number;   // 0–1000
  entropyScore?:    number;   // 0–100
  correlationScore?: number;  // 0–100
  distributionScore?: number; // 0–100
  riskComposite?:   number;   // 0–100
  cycleScore?:      number;   // -100 a 100
  trendScore?:      number;   // 0–100
  roiEstimate?:     number;   // -100 a ∞
  popularPenalty?:  number;   // ≤ 0
  coverageBonus?:   number;   // 0–100
  diversityScore?:  number;   // 0–100
}

export interface GameQualityResult {
  numbers:          number[];
  /** Score de qualidade final (0–1000) */
  qualityScore:     number;
  /** Medalha: "ouro" | "prata" | "bronze" | "sem_medalha" */
  medal:            "ouro" | "prata" | "bronze" | "sem_medalha";
  /** Percentil no conjunto de jogos (0–100) */
  percentile:       number;
  /** Pontos fortes do jogo */
  strengths:        string[];
  /** Pontos fracos do jogo */
  weaknesses:       string[];
  /** Recomendação */
  recommendation:   string;
  /** Componentes detalhados */
  components:       Record<string, number>;
  /** Versão do engine */
  version:          string;
}

export interface QualityRankingResult {
  /** Jogos ranqueados por qualidade */
  ranked:    GameQualityResult[];
  /** Estatísticas do conjunto */
  stats: {
    avgQuality:   number;
    maxQuality:   number;
    minQuality:   number;
    goldCount:    number;
    silverCount:  number;
    bronzeCount:  number;
  };
  /** Melhor jogo */
  bestGame: number[];
  /** Hash do ranking para cache */
  rankingVersion: string;
}

// ─── Normalização ─────────────────────────────────────────────

function norm1000(v: number | undefined, defaultV: number = 500): number {
  return Math.min(1000, Math.max(0, v ?? defaultV));
}

function norm100(v: number | undefined, defaultV: number = 50): number {
  return Math.min(100, Math.max(0, v ?? defaultV));
}

function normCycle(v: number | undefined): number {
  return Math.min(100, Math.max(0, ((v ?? 0) + 100) / 2));
}

function normPopular(v: number | undefined): number {
  const p = v ?? 0;
  return Math.min(100, Math.max(0, 100 + p));
}

// ─── Cálculo de Qualidade ─────────────────────────────────────

const QUALITY_WEIGHTS = {
  hyperScore:       0.25,
  precisionScore:   0.15,
  entropyScore:     0.08,
  correlationScore: 0.07,
  distributionScore: 0.10,
  riskComposite:    0.10,
  cycleScore:       0.08,
  trendScore:       0.05,
  roiEstimate:      0.04,
  popularPenalty:   0.05,
  coverageBonus:    0.03,
};

/**
 * Calcula o score de qualidade final de um jogo.
 */
export function computeGameQuality(
  input: GameQualityInput,
): Omit<GameQualityResult, "percentile"> {
  const components: Record<string, number> = {
    hyperScore:       norm1000(input.hyperScore) / 10,
    precisionScore:   norm1000(input.precisionScore) / 10,
    entropyScore:     norm100(input.entropyScore),
    correlationScore: norm100(input.correlationScore),
    distributionScore: norm100(input.distributionScore),
    riskComposite:    norm100(input.riskComposite),
    cycleScore:       normCycle(input.cycleScore),
    trendScore:       norm100(input.trendScore),
    roiEstimate:      Math.min(100, Math.max(0, (input.roiEstimate ?? -50) + 50)),
    popularPenalty:   normPopular(input.popularPenalty),
    coverageBonus:    norm100(input.coverageBonus),
  };

  const totalW = Object.values(QUALITY_WEIGHTS).reduce((a, b) => a + b, 0);
  const weightedSum = Object.entries(components).reduce((s, [k, v]) => {
    return s + v * (QUALITY_WEIGHTS[k as keyof typeof QUALITY_WEIGHTS] || 0);
  }, 0);

  const qualityScore = Math.round((weightedSum / totalW) * 10);

  // Medalha
  let medal: GameQualityResult["medal"];
  if (qualityScore >= 750) medal = "ouro";
  else if (qualityScore >= 600) medal = "prata";
  else if (qualityScore >= 450) medal = "bronze";
  else medal = "sem_medalha";

  // Análise de pontos fortes e fracos
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (components.hyperScore >= 70) strengths.push("HyperScore elevado — combinação multiplicativa excelente");
  if (components.precisionScore >= 70) strengths.push("Score de precisão adaptativo alto");
  if (components.distributionScore >= 70) strengths.push("Distribuição alinhada com histórico vencedor");
  if (components.riskComposite >= 70) strengths.push("Perfil de risco favorável");
  if (components.cycleScore >= 65) strengths.push("Números no timing certo de ciclos");
  if (components.entropyScore >= 65) strengths.push("Alta entropia — menos divisão de prêmio");
  if (components.trendScore >= 65) strengths.push("Alinhado com tendência recente de alta");

  if (components.hyperScore < 35) weaknesses.push("HyperScore baixo — algum fator crítico fraco");
  if (components.distributionScore < 35) weaknesses.push("Distribuição atípica em relação ao histórico");
  if (components.riskComposite < 35) weaknesses.push("Risco elevado de divisão de prêmio");
  if (components.popularPenalty < 35) weaknesses.push("Padrão popular detectado — pode dividir prêmio");
  if (components.cycleScore < 35) weaknesses.push("Números em fase desfavorável de ciclo");

  const recommendation = medal === "ouro"
    ? "Jogo de alta qualidade estatística. Priorize este."
    : medal === "prata"
    ? "Jogo sólido. Bom candidato para incluir na seleção."
    : medal === "bronze"
    ? "Qualidade aceitável. Inclua se precisar de diversidade."
    : "Qualidade abaixo do ideal. Considere substituir.";

  return {
    numbers: input.numbers,
    qualityScore,
    medal,
    percentile: 0, // calculado em batch
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 2),
    recommendation,
    components,
    version: "quality-v1",
  };
}

/**
 * Ranqueia um conjunto de jogos por qualidade.
 */
export function rankGameQuality(
  games: GameQualityInput[],
): QualityRankingResult {
  if (games.length === 0) {
    return {
      ranked: [],
      stats: { avgQuality: 0, maxQuality: 0, minQuality: 0, goldCount: 0, silverCount: 0, bronzeCount: 0 },
      bestGame: [],
      rankingVersion: "quality-v1",
    };
  }

  const results = games.map(g => computeGameQuality(g));
  results.sort((a, b) => b.qualityScore - a.qualityScore);

  // Adiciona percentil
  const ranked: GameQualityResult[] = results.map((r, idx) => ({
    ...r,
    percentile: Math.round(((results.length - idx - 1) / Math.max(results.length - 1, 1)) * 100),
  }));

  const scores = ranked.map(r => r.qualityScore);
  const avgQuality = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  return {
    ranked,
    stats: {
      avgQuality,
      maxQuality: Math.max(...scores),
      minQuality: Math.min(...scores),
      goldCount:   ranked.filter(r => r.medal === "ouro").length,
      silverCount: ranked.filter(r => r.medal === "prata").length,
      bronzeCount: ranked.filter(r => r.medal === "bronze").length,
    },
    bestGame: ranked[0]?.numbers || [],
    rankingVersion: "quality-v1",
  };
}
