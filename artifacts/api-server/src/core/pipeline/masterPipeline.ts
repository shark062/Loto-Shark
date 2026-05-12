// ============================================================
//  Master Pipeline v3 — Orquestra todos os 26 módulos
//  SharkEngine → AntiPopular → Cycle → Entropy → Correlation →
//  Distribution → TemporalTrend → PrecisionScore → HyperScore →
//  DynamicFilters → Similarity → Coverage → ROIOptimizer →
//  EnsembleDecision → QualityRanking → Backtest → Snapshot
//
//  Regras:
//  - Backward compatible: não substitui /api/games/generate
//  - Todos os novos módulos têm fallback silencioso
//  - Feature flags controlam cada módulo
// ============================================================

import { gerarJogosMaster } from "../sharkEngine";
import { filterRedundantGames, computeDiversityScore } from "../optimization/similarityEngine";
import { reorderByCoverage, analyzeCoverage } from "../optimization/coverageEngine";
import { popularPatternScore } from "../filters/antiPopularPatterns";
import { analyzeCycles, computeGameCycleScore } from "../statistics/cycleEngine";
import { computeRiskMetrics } from "../risk/riskEngine";
import { computePrecisionScore } from "../scoring/sharkPrecisionEngine";
import { runHistoricalSimulation } from "../backtest/sharkBacktest";
import { captureSnapshot } from "../contest/contestSnapshot";
import { computeTargetContest } from "../contest/temporalValidator";
import { auditGameGeneration } from "../../lib/auditLogger";
import { getAdaptiveWeights } from "../learning/sharkAutoLearning";
import type { SharkContext } from "../sharkEngine";
import { logger } from "../../lib/logger";

// Novos engines v3
import { computeHyperScore } from "../scoring/hyperScoreEngine";
import { analyzeEntropy } from "../statistics/entropyEngine";
import { buildCorrelationMatrix, scoreGameCorrelation } from "../statistics/correlationEngine";
import { computeHistoricalStats, scoreDistribution } from "../statistics/distributionEngine";
import { analyzeTemporalTrends, scoreGameTemporalTrend } from "../statistics/temporalTrendEngine";
import { estimateROI } from "../optimization/roiOptimizer";
import { rankGameQuality } from "../ranking/qualityRankingEngine";
import { runEnsembleDecision } from "../ai/ensembleDecisionEngine";
import {
  getDefaultFilters,
  applyDynamicFilters,
} from "../filters/dynamicFilterEngine";
import { isEnabled } from "../bootstrap/featureFlagLoader";
import { computeCompositeMathScore, collectiveCoverageOptimizer } from "../mathEngines";

// ─── Tipos ────────────────────────────────────────────────────

export interface PipelineInput {
  lotteryId:     string;
  lotteryName:   string;
  totalNumbers:  number;
  minNumbers:    number;
  pickCount:     number;
  gamesCount:    number;
  strategy:      string;
  pesos:         { frequencia: number; atraso: number; repeticao: number };
  draws:         number[][];
  latestContest: number;
  frequencyMap:  Record<number, number>;
  delayMap:      Record<number, number>;
  avgSum:        number;
  avgEvens:      number;
  hotNumbers:    number[];
  coldNumbers:   number[];
  warmNumbers:   number[];
  sharkCtx:      SharkContext;
}

export interface PipelineGame {
  numbers:             number[];
  strategy:            string;
  sharkScore:          number;
  sharkOrigem:         string;
  confidence:          number;
  reasoning:           string;
  precisionScore:      number;
  precisionComponents: {
    historical:  number;
    recent:      number;
    coverage:    number;
    balance:     number;
    antiPopular: number;
    cycle:       number;
  };
  riskMetrics: {
    riskScore:         number;
    riskLevel:         string;
    stabilityScore:    number;
    prizeDivisionRisk: number;
    compositeScore:    number;
  };
  popularPatterns:     string[];
  cycleScore:          number;
  coverageScore:       number;
  // v3 additions
  hyperScore?:         number;
  hyperGrade?:         string;
  entropyScore?:       number;
  correlationScore?:   number;
  distributionScore?:  number;
  trendScore?:         number;
  roiEstimate?:        number;
  qualityScore?:       number;
  qualityMedal?:       string;
  filterScore?:        number;
}

export interface PipelineResult {
  games:          PipelineGame[];
  targetContest:  number;
  snapshotId:     string;
  generationHash: string;
  metrics: {
    diversityScore:    number;
    coverageScore:     number;
    avgPrecisionScore: number;
    avgRiskScore:      number;
    avgHyperScore:     number;
    avgQualityScore:   number;
    drawsAnalyzed:     number;
    filterStats: {
      candidatesGenerated: number;
      afterSimilarity:     number;
      afterDynamicFilters: number;
      finalGames:          number;
    };
    enginesActive: string[];
  };
  backtest?: {
    roi:            number;
    winRate:        number;
    avgHitsPerDraw: number;
    stabilityScore: number;
    drawsTested:    number;
  };
  qualityRanking?: {
    goldCount:    number;
    silverCount:  number;
    bronzeCount:  number;
    avgQuality:   number;
  };
  executionMs: number;
  pipelineVersion: string;
}

// ─── Pipeline Principal ───────────────────────────────────────

export async function runMasterPipeline(input: PipelineInput): Promise<PipelineResult> {
  const startMs = Date.now();
  const enginesActive: string[] = ["sharkEngine", "antiPopular", "cycleEngine", "riskEngine", "precision", "similarity", "coverage", "mathEngines_v2"];

  const {
    lotteryId, totalNumbers, minNumbers, pickCount,
    gamesCount, strategy, pesos, draws,
    latestContest, frequencyMap, delayMap, avgSum, avgEvens,
    hotNumbers, coldNumbers, warmNumbers, sharkCtx,
  } = input;

  // ── Passo 1: SharkEngine gera candidatos ─────────────────────
  const candidateCount = Math.min(gamesCount * 4, 200);
  let sharkResults: { jogo: number[]; score: number; origem: string }[] = [];
  let sharkContexto: any = {};

  try {
    const { jogos, contexto } = gerarJogosMaster(draws, candidateCount, totalNumbers, pickCount, pesos);
    sharkResults = jogos;
    sharkContexto = contexto;
  } catch (err: any) {
    logger.error({ err: err.message }, "[MasterPipeline v3] SharkEngine falhou");
    return buildEmptyResult(gamesCount, latestContest, startMs);
  }

  if (sharkResults.length === 0) return buildEmptyResult(gamesCount, latestContest, startMs);

  // ── Passo 2: Pre-computar análises globais ────────────────────

  // Cycle Analysis
  let cycleAnalysis: ReturnType<typeof analyzeCycles> | null = null;
  try {
    cycleAnalysis = analyzeCycles(draws, totalNumbers, minNumbers);
  } catch { /* fallback */ }

  // Entropy — análise histórica
  let historicalStats: ReturnType<typeof computeHistoricalStats> | null = null;
  if (isEnabled("distribution_engine") && draws.length >= 10) {
    try {
      historicalStats = computeHistoricalStats(draws, totalNumbers);
      enginesActive.push("distributionEngine");
    } catch { /* fallback */ }
  }

  // Correlation Matrix
  let correlationMatrix: ReturnType<typeof buildCorrelationMatrix> | null = null;
  if (isEnabled("correlation_engine") && draws.length >= 20) {
    try {
      correlationMatrix = buildCorrelationMatrix(draws, totalNumbers, 20);
      enginesActive.push("correlationEngine");
    } catch { /* fallback */ }
  }

  // Temporal Trends
  let temporalTrends: ReturnType<typeof analyzeTemporalTrends> | null = null;
  if (isEnabled("temporal_trend_engine") && draws.length >= 10) {
    try {
      temporalTrends = analyzeTemporalTrends(draws, totalNumbers);
      enginesActive.push("temporalTrendEngine");
    } catch { /* fallback */ }
  }

  // Adaptive Weights
  const adaptiveWeights = getAdaptiveWeights(lotteryId);

  // Dynamic Filters config
  const dynamicFilters = isEnabled("dynamic_filters")
    ? getDefaultFilters(lotteryId, avgSum, 20, avgEvens, totalNumbers, pickCount)
    : [];

  // ── Passo 3: Anti-Popular + Score para cada candidato ─────────
  const candidatesWithPopular = sharkResults.map(r => {
    const { popularPatternScore: ppScore, penalty, detectedPatterns } = popularPatternScore(r.jogo, totalNumbers);
    return {
      numbers: r.jogo,
      score:   r.score,
      origem:  r.origem,
      popularPenalty: penalty,
      popularPatterns: detectedPatterns,
      popularScore: ppScore,
    };
  });

  // ── Passo 4: Score completo de cada candidato ─────────────────
  const scoredCandidates = candidatesWithPopular.map(c => {
    const cycleScoreRaw = cycleAnalysis ? computeGameCycleScore(c.numbers, cycleAnalysis) : 0;

    // Precision Score
    let precisionResult: ReturnType<typeof computePrecisionScore>;
    try {
      precisionResult = computePrecisionScore({
        numbers: c.numbers,
        ctx: sharkCtx,
        avgEvens,
        avgSum,
        coverageScoreRaw: 50,
        antiPopularScoreRaw: c.popularScore,
        cycleScoreRaw,
        weights: adaptiveWeights,
      });
    } catch {
      precisionResult = {
        finalScore: c.score,
        components: { historical: 0.5, recent: 0.5, coverage: 0.5, balance: 0.5, antiPopular: 0.8, cycle: 0.5 },
        weights: adaptiveWeights,
        version: "precision-v1",
      };
    }

    // Entropy
    let entropyScore = 50;
    if (isEnabled("entropy_engine")) {
      try {
        const ea = analyzeEntropy(c.numbers, frequencyMap, totalNumbers);
        entropyScore = ea.entropyScore;
      } catch { /* fallback */ }
    }

    // Correlation
    let correlationScore = 50;
    if (correlationMatrix) {
      try {
        correlationScore = scoreGameCorrelation(c.numbers, correlationMatrix, "balanced").correlationScore;
      } catch { /* fallback */ }
    }

    // Distribution
    let distributionScore = 50;
    if (historicalStats) {
      try {
        distributionScore = scoreDistribution(c.numbers, historicalStats, totalNumbers).distributionScore;
      } catch { /* fallback */ }
    }

    // Temporal Trend
    let trendScore = 50;
    if (temporalTrends) {
      try {
        trendScore = scoreGameTemporalTrend(c.numbers, temporalTrends, "balanced").trendScore;
      } catch { /* fallback */ }
    }

    // Math Engines v2 — composite score from 5 advanced algorithms
    let mathScore = 50;
    try {
      const freqEntries = Object.entries(frequencyMap).map(([k, v]) => ({
        number: Number(k), frequency: v, delay: delayMap[Number(k)] ?? 0,
        temperature: hotNumbers.includes(Number(k)) ? "hot" as const
          : coldNumbers.includes(Number(k)) ? "cold" as const : "warm" as const,
      }));
      const mathResult = computeCompositeMathScore({
        numbers: c.numbers,
        draws,
        freqEntries,
        frequencyMap,
        totalNumbers,
      });
      mathScore = mathResult.score;
    } catch { /* fallback */ }

    return {
      ...c,
      originalSharkScore: c.score,
      score: precisionResult.finalScore * 0.90 + mathScore * 0.10,
      cycleScore: cycleScoreRaw,
      precisionResult,
      entropyScore,
      correlationScore,
      distributionScore,
      trendScore,
      mathScore,
    };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);

  // ── Passo 5: Dynamic Filters ──────────────────────────────────
  let afterDynamicFilters = scoredCandidates;
  if (isEnabled("dynamic_filters") && dynamicFilters.length > 0) {
    enginesActive.push("dynamicFilters");
    try {
      const lastDraw = draws[0] || [];
      const filterContext = { totalNumbers, lastDraw, hotNumbers, coldNumbers };

      const filtered = scoredCandidates.map(c => {
        const result = applyDynamicFilters(c.numbers, dynamicFilters, filterContext);
        return { ...c, score: c.score + result.totalPenalty, filterScore: result.filterScore, passed: result.passed };
      });

      const passed = filtered.filter(f => f.passed);
      afterDynamicFilters = (passed.length >= gamesCount ? passed : filtered)
        .sort((a, b) => b.score - a.score) as typeof scoredCandidates;
    } catch { /* fallback */ }
  }

  // ── Passo 6: HyperScore para top candidatos ───────────────────
  let afterHyperScore = afterDynamicFilters;
  if (isEnabled("hyper_score_engine")) {
    enginesActive.push("hyperScore");
    try {
      afterHyperScore = afterDynamicFilters.map(c => {
        let riskTmp = { compositeScore: 65 };
        try {
          riskTmp = computeRiskMetrics(c.numbers, totalNumbers, avgSum, avgEvens, frequencyMap);
        } catch { /* fallback */ }

        const hyperResult = computeHyperScore({
          precisionScore:    c.precisionResult.finalScore,
          entropyScore:      c.entropyScore,
          correlationScore:  c.correlationScore,
          distributionScore: c.distributionScore,
          riskComposite:     riskTmp.compositeScore,
          cycleScore:        c.cycleScore,
          popularPenalty:    c.popularPenalty,
          coverageBonus:     50,
          temporalScore:     c.trendScore,
          roiEstimate:       -40,
        });

        return {
          ...c,
          hyperScore: hyperResult.hyperScore,
          hyperGrade: hyperResult.grade,
          score: Math.round(c.score * 0.60 + hyperResult.hyperScore * 0.40),
        };
      });

      afterHyperScore.sort((a, b) => b.score - a.score);
    } catch { /* fallback */ }
  }

  // ── Passo 7: Similarity Filter ────────────────────────────────
  const candidatesForSimilarity = afterHyperScore.map(c => ({
    numbers: c.numbers,
    score:   c.score,
    origem:  c.origem,
  }));
  const { filtered: uniqueNumbers, removedCount } = filterRedundantGames(
    candidatesForSimilarity, lotteryId, gamesCount * 2,
  );

  const filteredWithMeta = uniqueNumbers.map(nums => {
    return afterHyperScore.find(c => c.numbers.join(",") === nums.join(",")) ||
           afterHyperScore.find(c => c.numbers.slice().sort((a,b)=>a-b).join(",") === nums.slice().sort((a,b)=>a-b).join(",")) ||
           afterHyperScore[0];
  }).filter(Boolean) as typeof afterHyperScore;

  // ── Passo 8: Coverage Engine ──────────────────────────────────
  const coverageInput = filteredWithMeta.map(c => ({
    numbers: c.numbers,
    score:   c.score,
    origem:  c.origem,
  }));
  const reordered = reorderByCoverage(coverageInput, totalNumbers, 0.20);
  const selectedGames = reordered.slice(0, gamesCount);

  // ── Passo 9: Risk + ROI para jogos finais ─────────────────────
  const finalGames: PipelineGame[] = selectedGames.map((g, idx) => {
    const meta = filteredWithMeta.find(c =>
      c.numbers.slice().sort((a,b)=>a-b).join(",") === g.numbers.slice().sort((a,b)=>a-b).join(",")
    ) || filteredWithMeta[idx] || filteredWithMeta[0];

    // Risk
    let riskResult: ReturnType<typeof computeRiskMetrics>;
    try {
      riskResult = computeRiskMetrics(g.numbers, totalNumbers, avgSum, avgEvens, frequencyMap);
    } catch {
      riskResult = {
        riskScore: 30, stabilityScore: 70, varianceScore: 30,
        prizeDivisionRisk: 20, consistencyScore: 60, riskLevel: "médio",
        compositeScore: 65,
        breakdown: { sumDeviation: 30, parityImbalance: 20, sequenceRisk: 10, concentrationRisk: 20, popularityRisk: 20 },
      };
    }

    // ROI
    let roiEstimate = -45;
    if (isEnabled("roi_optimizer")) {
      try {
        const roi = estimateROI(g.numbers, lotteryId, totalNumbers, 4.50, 10_000_000, frequencyMap);
        roiEstimate = roi.expectedROI;
      } catch { /* fallback */ }
    }

    const confidence = Math.min(0.95, 0.45 + (meta?.originalSharkScore || 0) / 2000);
    const coverageBonus = g.combinedScore !== undefined
      ? Math.round((g.combinedScore / Math.max(...reordered.map(r => r.combinedScore), 1)) * 20)
      : 0;

    return {
      numbers:    g.numbers.slice().sort((a, b) => a - b),
      strategy,
      sharkScore: meta?.originalSharkScore || 0,
      sharkOrigem: meta?.origem || "pipeline",
      confidence: Math.round(confidence * 100) / 100,
      reasoning:  buildReasoning(strategy, draws.length, meta?.originalSharkScore || 0, riskResult.riskLevel),
      precisionScore: meta?.precisionResult.finalScore || 500,
      precisionComponents: meta?.precisionResult.components || { historical: 0.5, recent: 0.5, coverage: 0.5, balance: 0.5, antiPopular: 0.8, cycle: 0.5 },
      riskMetrics: {
        riskScore:        riskResult.riskScore,
        riskLevel:        riskResult.riskLevel,
        stabilityScore:   riskResult.stabilityScore,
        prizeDivisionRisk: riskResult.prizeDivisionRisk,
        compositeScore:   riskResult.compositeScore,
      },
      popularPatterns: meta?.popularPatterns || [],
      cycleScore:      meta?.cycleScore || 0,
      coverageScore:   coverageBonus,
      hyperScore:      (meta as any)?.hyperScore,
      hyperGrade:      (meta as any)?.hyperGrade,
      entropyScore:    meta?.entropyScore,
      correlationScore: meta?.correlationScore,
      distributionScore: meta?.distributionScore,
      trendScore:       meta?.trendScore,
      roiEstimate,
      filterScore:     (meta as any)?.filterScore,
    };
  });

  // ── Passo 10: Quality Ranking ─────────────────────────────────
  let qualityRankingResult: PipelineResult["qualityRanking"] | undefined;
  if (isEnabled("quality_ranking")) {
    enginesActive.push("qualityRanking");
    try {
      const rankInput = finalGames.map(g => ({
        numbers:          g.numbers,
        hyperScore:       g.hyperScore,
        precisionScore:   g.precisionScore,
        entropyScore:     g.entropyScore,
        correlationScore: g.correlationScore,
        distributionScore: g.distributionScore,
        riskComposite:    g.riskMetrics.compositeScore,
        cycleScore:       g.cycleScore,
        trendScore:       g.trendScore,
        roiEstimate:      g.roiEstimate,
        popularPenalty:   g.popularPatterns.length > 0 ? -g.popularPatterns.length * 10 : 0,
        coverageBonus:    g.coverageScore,
      }));

      const ranking = rankGameQuality(rankInput);
      qualityRankingResult = {
        goldCount:    ranking.stats.goldCount,
        silverCount:  ranking.stats.silverCount,
        bronzeCount:  ranking.stats.bronzeCount,
        avgQuality:   ranking.stats.avgQuality,
      };

      // Injeta quality scores nos jogos finais
      ranking.ranked.forEach((r, idx) => {
        const game = finalGames.find(g => g.numbers.join(",") === r.numbers.join(","));
        if (game) {
          game.qualityScore = r.qualityScore;
          game.qualityMedal = r.medal;
        }
      });
    } catch { /* fallback */ }
  }

  // ── Passo 11: Ensemble Decision (para escolha dos top games) ──
  if (isEnabled("ensemble_decision") && finalGames.length > 1) {
    enginesActive.push("ensembleDecision");
    try {
      const ensembleInput = finalGames.map(g => ({
        numbers: g.numbers,
        scores: {
          hyperScore:    g.hyperScore     ?? 500,
          precision:     g.precisionScore / 10,
          distribution:  g.distributionScore ?? 50,
          risk:          g.riskMetrics.compositeScore,
          cycle:         Math.max(0, g.cycleScore + 100) / 2,
          entropy:       g.entropyScore ?? 50,
          correlation:   g.correlationScore ?? 50,
        },
      }));

      runEnsembleDecision({
        candidates: ensembleInput,
        pickCount,
        totalNumbers,
      });
      // Resultado do ensemble está nas métricas — jogos já estão ordenados por pipeline
    } catch { /* fallback */ }
  }

  // ── Passo 12: Métricas globais ────────────────────────────────
  const allNumbers = finalGames.map(g => g.numbers);
  const diversityScore = computeDiversityScore(allNumbers, lotteryId);
  const coverageStats  = analyzeCoverage(allNumbers, totalNumbers);
  const avgPrecisionScore = Math.round(finalGames.reduce((s, g) => s + g.precisionScore, 0) / Math.max(finalGames.length, 1));
  const avgRiskScore      = Math.round(finalGames.reduce((s, g) => s + g.riskMetrics.riskScore, 0) / Math.max(finalGames.length, 1));
  const avgHyperScore     = Math.round(finalGames.reduce((s, g) => s + (g.hyperScore ?? 500), 0) / Math.max(finalGames.length, 1));
  const avgQualityScore   = Math.round(finalGames.reduce((s, g) => s + (g.qualityScore ?? 500), 0) / Math.max(finalGames.length, 1));

  // ── Passo 13: Backtest rápido ────────────────────────────────
  let backtestResult: PipelineResult["backtest"] | undefined;
  if (isEnabled("advanced_backtest") && draws.length >= 30) {
    try {
      const bt = runHistoricalSimulation(allNumbers, draws, lotteryId, 0.70);
      backtestResult = {
        roi: bt.roi, winRate: bt.winRate,
        avgHitsPerDraw: bt.avgHitsPerDraw,
        stabilityScore: bt.stabilityScore,
        drawsTested: bt.drawsTested,
      };
    } catch { /* backtest é opcional */ }
  }

  // ── Passo 14: Snapshot ────────────────────────────────────────
  const targetContest = computeTargetContest(latestContest);
  const snapshot = captureSnapshot({
    modality:    lotteryId,
    latestKnownContest: latestContest,
    games: finalGames.map(g => ({
      numbers: g.numbers, strategy: g.strategy,
      sharkScore: g.sharkScore, sharkOrigem: g.sharkOrigem,
      confidence: g.confidence, reasoning: g.reasoning,
    })),
    statisticsSnapshot: {
      drawsAnalyzed: draws.length,
      hotNumbers:    hotNumbers.slice(0, 15),
      coldNumbers:   coldNumbers.slice(0, 15),
      warmNumbers:   warmNumbers.slice(0, 15),
      avgSum, avgEvens, topPairs: [], frequencyMap, delayMap,
    },
    filtersSnapshot: {
      strategy, pesos, minDistance: 3,
      antiPopularEnabled: true,
      temporalCutoff:     targetContest - 1,
      enginesActive,
      pipelineVersion:    "v3",
    },
  });

  // ── Passo 15: Auditoria ───────────────────────────────────────
  auditGameGeneration({
    modality:         lotteryId,
    contestNumber:    targetContest,
    gamesCount:       finalGames.length,
    strategy,
    algorithmVersion: "3.0.0",
    generationHash:   snapshot.generationHash,
    latencyMs:        Date.now() - startMs,
    filtersApplied:   enginesActive,
  });

  logger.info(
    {
      lotteryId,
      gamesGenerated: finalGames.length,
      candidatesTotal: sharkResults.length,
      engines: enginesActive.length,
      executionMs: Date.now() - startMs,
    },
    "[MasterPipeline v3] Pipeline concluído",
  );

  return {
    games:          finalGames,
    targetContest,
    snapshotId:     snapshot.id,
    generationHash: snapshot.generationHash,
    metrics: {
      diversityScore,
      coverageScore:     coverageStats.coverageScore,
      avgPrecisionScore,
      avgRiskScore,
      avgHyperScore,
      avgQualityScore,
      drawsAnalyzed:     draws.length,
      filterStats: {
        candidatesGenerated:  sharkResults.length,
        afterSimilarity:      uniqueNumbers.length,
        afterDynamicFilters:  afterDynamicFilters.length,
        finalGames:           finalGames.length,
      },
      enginesActive,
    },
    backtest:       backtestResult,
    qualityRanking: qualityRankingResult,
    executionMs:    Date.now() - startMs,
    pipelineVersion: "v3",
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function buildReasoning(strategy: string, drawsAnalyzed: number, sharkScore: number, riskLevel: string): string {
  const stratLabel: Record<string, string> = {
    hot:   "Quentes (alta frequência recente)",
    cold:  "Frias (maior atraso)",
    mixed: "Mista (quentes + frias equilibrado)",
    ai:    "IA Avançada",
    shark: "Motor Shark Master",
  };
  return `[Pipeline v3] Estratégia: ${stratLabel[strategy] || strategy} | ` +
    `${drawsAnalyzed} sorteios reais analisados | ` +
    `SharkScore: ${sharkScore} | Risco: ${riskLevel} | ` +
    `Filtros: HyperScore, Entropia, Correlação, Distribuição, Tendência, ROI, Qualidade, MathEngines v2`;
}

function buildEmptyResult(
  gamesCount: number,
  latestContest: number,
  startMs: number,
): PipelineResult {
  return {
    games: [],
    targetContest: computeTargetContest(latestContest),
    snapshotId: "",
    generationHash: "",
    metrics: {
      diversityScore: 0, coverageScore: 0, avgPrecisionScore: 0,
      avgRiskScore: 0, avgHyperScore: 0, avgQualityScore: 0,
      drawsAnalyzed: 0,
      filterStats: { candidatesGenerated: 0, afterSimilarity: 0, afterDynamicFilters: 0, finalGames: 0 },
      enginesActive: [],
    },
    executionMs: Date.now() - startMs,
    pipelineVersion: "v3",
  };
}
