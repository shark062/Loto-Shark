// ============================================================
//  Master Pipeline — Fase 11
//  Orquestra todos os módulos em sequência determinista.
//  SharkEngine → Similarity → AntiPopular → Coverage →
//  Cycle → Risk → PrecisionScore → Backtest → Output
//
//  Regras:
//  - Backward compatible: não substitui /api/games/generate
//  - Disponível em /api/v2/generate
//  - Todos os filtros têm fallback silencioso
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
  /** FrequencyMap para uso nos engines */
  frequencyMap:  Record<number, number>;
  delayMap:      Record<number, number>;
  avgSum:        number;
  avgEvens:      number;
  hotNumbers:    number[];
  coldNumbers:   number[];
  warmNumbers:   number[];
  /** Contexto Shark (pre-computado) */
  sharkCtx:      SharkContext;
}

export interface PipelineGame {
  numbers:             number[];
  strategy:            string;
  sharkScore:          number;
  sharkOrigem:         string;
  confidence:          number;
  reasoning:           string;
  /** Score do motor de precisão (0–1000) */
  precisionScore:      number;
  /** Componentes detalhados do precision score */
  precisionComponents: {
    historical: number;
    recent:     number;
    coverage:   number;
    balance:    number;
    antiPopular: number;
    cycle:      number;
  };
  /** Métricas de risco */
  riskMetrics: {
    riskScore:       number;
    riskLevel:       string;
    stabilityScore:  number;
    prizeDivisionRisk: number;
    compositeScore:  number;
  };
  /** Padrões populares detectados */
  popularPatterns:    string[];
  /** Score de ciclo do jogo */
  cycleScore:         number;
  /** Score de cobertura no contexto do lote */
  coverageScore:      number;
}

export interface PipelineResult {
  games:         PipelineGame[];
  targetContest: number;
  snapshotId:    string;
  generationHash: string;
  metrics: {
    diversityScore:   number;
    coverageScore:    number;
    avgPrecisionScore: number;
    avgRiskScore:     number;
    drawsAnalyzed:    number;
    filterStats: {
      candidatesGenerated: number;
      afterSimilarity:     number;
      finalGames:          number;
    };
  };
  backtest?: {
    roi:            number;
    winRate:        number;
    avgHitsPerDraw: number;
    stabilityScore: number;
    drawsTested:    number;
  };
  executionMs: number;
}

// ─── Pipeline Principal ───────────────────────────────────────

/**
 * Executa o pipeline completo de geração de jogos.
 * Retorna jogos enriquecidos com scores de todos os módulos.
 */
export async function runMasterPipeline(input: PipelineInput): Promise<PipelineResult> {
  const startMs = Date.now();

  const {
    lotteryId, totalNumbers, minNumbers, pickCount,
    gamesCount, strategy, pesos, draws,
    latestContest, frequencyMap, delayMap, avgSum, avgEvens,
    hotNumbers, coldNumbers, warmNumbers, sharkCtx,
  } = input;

  // ── Passo 1: SharkEngine gera candidatos (3x o pedido para ter margem de filtragem) ──
  const candidateCount = Math.min(gamesCount * 3, 150);
  let sharkResults: { jogo: number[]; score: number; origem: string }[] = [];
  let sharkContexto: any = {};

  try {
    const { jogos, contexto } = gerarJogosMaster(draws, candidateCount, totalNumbers, pickCount, pesos);
    sharkResults = jogos;
    sharkContexto = contexto;
  } catch (err: any) {
    logger.error({ err: err.message }, "[MasterPipeline] SharkEngine falhou");
    return buildEmptyResult(gamesCount, latestContest, startMs);
  }

  if (sharkResults.length === 0) {
    return buildEmptyResult(gamesCount, latestContest, startMs);
  }

  // ── Passo 2: Anti-Popular Patterns — calcula penalidade para cada candidato ──
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

  // ── Passo 3: Cycle Engine ──
  let cycleAnalysis: ReturnType<typeof analyzeCycles> | null = null;
  try {
    cycleAnalysis = analyzeCycles(draws, totalNumbers, minNumbers);
  } catch { /* fallback silencioso */ }

  // ── Passo 4: Precision Score para cada candidato ──
  const adaptiveWeights = getAdaptiveWeights(lotteryId);

  const scoredCandidates = candidatesWithPopular.map(c => {
    const cycleScoreRaw = cycleAnalysis ? computeGameCycleScore(c.numbers, cycleAnalysis) : 0;

    let precisionResult: ReturnType<typeof computePrecisionScore>;
    try {
      precisionResult = computePrecisionScore({
        numbers:           c.numbers,
        ctx:               sharkCtx,
        avgEvens,
        avgSum,
        coverageScoreRaw:  50, // atualizado após reorderByCoverage
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

    return {
      ...c,
      score: precisionResult.finalScore,  // usa precision score como score principal
      originalSharkScore: c.score,
      cycleScore: cycleScoreRaw,
      precisionResult,
    };
  });

  // Ordena por precision score desc
  scoredCandidates.sort((a, b) => b.score - a.score);

  // ── Passo 5: Similarity Filter — remove redundantes ──
  const candidatesForSimilarity = scoredCandidates.map(c => ({
    numbers: c.numbers,
    score:   c.score,
    origem:  c.origem,
  }));
  const { filtered: uniqueNumbers, removedCount } = filterRedundantGames(
    candidatesForSimilarity, lotteryId, gamesCount * 2,
  );

  // Reconstrói com metadados após filtro de similaridade
  const filteredWithMeta = uniqueNumbers.map(nums => {
    return scoredCandidates.find(c => c.numbers.join(",") === nums.join(",")) ||
           scoredCandidates.find(c => c.numbers.slice().sort((a,b)=>a-b).join(",") === nums.slice().sort((a,b)=>a-b).join(",")) ||
           scoredCandidates[0];
  }).filter(Boolean) as typeof scoredCandidates;

  // ── Passo 6: Coverage Engine — reordena priorizando cobertura global ──
  const coverageInput = filteredWithMeta.map(c => ({
    numbers: c.numbers,
    score:   c.score,
    origem:  c.origem,
  }));
  const reordered = reorderByCoverage(coverageInput, totalNumbers, 0.20);

  // ── Passo 7: Seleciona os top N após todos os filtros ──
  const selectedGames = reordered.slice(0, gamesCount);

  // ── Passo 8: Risk Metrics para os jogos finais ──
  const finalGames: PipelineGame[] = selectedGames.map((g, idx) => {
    const meta = filteredWithMeta.find(c =>
      c.numbers.slice().sort((a,b)=>a-b).join(",") === g.numbers.slice().sort((a,b)=>a-b).join(",")
    ) || filteredWithMeta[idx] || filteredWithMeta[0];

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

    const confidence = Math.min(0.95, 0.45 + (meta?.originalSharkScore || meta?.score || 0) / 2000);

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
    };
  });

  // ── Passo 9: Métricas globais ──
  const allNumbers = finalGames.map(g => g.numbers);
  const diversityScore = computeDiversityScore(allNumbers, lotteryId);
  const coverageStats = analyzeCoverage(allNumbers, totalNumbers);
  const avgPrecisionScore = Math.round(finalGames.reduce((s, g) => s + g.precisionScore, 0) / Math.max(finalGames.length, 1));
  const avgRiskScore = Math.round(finalGames.reduce((s, g) => s + g.riskMetrics.riskScore, 0) / Math.max(finalGames.length, 1));

  // ── Passo 10: Backtest rápido (apenas se tiver histórico suficiente) ──
  let backtestResult: PipelineResult["backtest"] | undefined;
  if (draws.length >= 30) {
    try {
      const bt = runHistoricalSimulation(allNumbers, draws, lotteryId, 0.70);
      backtestResult = {
        roi:            bt.roi,
        winRate:        bt.winRate,
        avgHitsPerDraw: bt.avgHitsPerDraw,
        stabilityScore: bt.stabilityScore,
        drawsTested:    bt.drawsTested,
      };
    } catch { /* backtest é opcional */ }
  }

  // ── Passo 11: Snapshot ──
  const targetContest = computeTargetContest(latestContest);
  const snapshot = captureSnapshot({
    modality:    lotteryId,
    latestKnownContest: latestContest,
    games: finalGames.map(g => ({
      numbers:    g.numbers,
      strategy:   g.strategy,
      sharkScore: g.sharkScore,
      sharkOrigem: g.sharkOrigem,
      confidence: g.confidence,
      reasoning:  g.reasoning,
    })),
    statisticsSnapshot: {
      drawsAnalyzed: draws.length,
      hotNumbers:    hotNumbers.slice(0, 15),
      coldNumbers:   coldNumbers.slice(0, 15),
      warmNumbers:   warmNumbers.slice(0, 15),
      avgSum,
      avgEvens,
      topPairs:      [],
      frequencyMap,
      delayMap,
    },
    filtersSnapshot: {
      strategy,
      pesos,
      minDistance:         3,
      antiPopularEnabled:  true,
      temporalCutoff:      targetContest - 1,
    },
  });

  // ── Passo 12: Auditoria ──
  auditGameGeneration({
    modality:         lotteryId,
    contestNumber:    targetContest,
    gamesCount:       finalGames.length,
    strategy,
    algorithmVersion: "2.1.0",
    generationHash:   snapshot.generationHash,
    latencyMs:        Date.now() - startMs,
    filtersApplied:   ["similarity", "antiPopular", "coverage", "cycleEngine", "riskEngine", "precisionScore"],
  });

  return {
    games:          finalGames,
    targetContest,
    snapshotId:     snapshot.id,
    generationHash: snapshot.generationHash,
    metrics: {
      diversityScore,
      coverageScore:    coverageStats.coverageScore,
      avgPrecisionScore,
      avgRiskScore,
      drawsAnalyzed:    draws.length,
      filterStats: {
        candidatesGenerated: sharkResults.length,
        afterSimilarity:     uniqueNumbers.length,
        finalGames:          finalGames.length,
      },
    },
    backtest: backtestResult,
    executionMs: Date.now() - startMs,
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
  return `[Pipeline v2] Estratégia: ${stratLabel[strategy] || strategy} | ` +
    `${drawsAnalyzed} sorteios reais analisados | ` +
    `SharkScore: ${sharkScore} | Risco: ${riskLevel} | ` +
    `Filtros: similaridade, anti-popular, cobertura, ciclos, risco`;
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
      diversityScore: 0,
      coverageScore: 0,
      avgPrecisionScore: 0,
      avgRiskScore: 0,
      drawsAnalyzed: 0,
      filterStats: { candidatesGenerated: 0, afterSimilarity: 0, finalGames: 0 },
    },
    executionMs: Date.now() - startMs,
  };
}
