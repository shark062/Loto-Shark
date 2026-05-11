// ============================================================
//  Ensemble Decision Engine — Decisão por Múltiplos Motores
//  Agrega os resultados de todos os engines de score e
//  toma uma decisão final usando votação ponderada.
//  Equivalente a um "comitê de especialistas estatísticos".
// ============================================================

import { logger } from "../../lib/logger";

// ─── Tipos ────────────────────────────────────────────────────

export interface EngineVote {
  /** Nome do engine */
  engineName:  string;
  /** Peso deste engine na decisão (0–1) */
  weight:      number;
  /** Números favorecidos por este engine */
  topNumbers:  number[];
  /** Score para o conjunto de números (0–100) */
  score:       number;
  /** Confiança (0–1) */
  confidence:  number;
}

export interface EnsembleDecision {
  /** Números selecionados pelo consenso */
  consensusNumbers: number[];
  /** Score de consenso (0–100) */
  consensusScore:   number;
  /** Nível de concordância entre engines (0–100) */
  agreement:        number;
  /** Detalhamento dos votos */
  votes:            EngineVote[];
  /** Número de engines que concordaram */
  engineCount:      number;
  /** Confiança final (0–1) */
  confidence:       number;
  /** Método de decisão usado */
  method:           string;
  /** Interpretação */
  interpretation:   string;
}

export interface EnsembleInput {
  /** Candidatos a avaliar */
  candidates: Array<{
    numbers: number[];
    scores:  Record<string, number>;  // engineName → score
  }>;
  /** Pesos por engine */
  engineWeights?: Record<string, number>;
  /** Quantos números por jogo */
  pickCount: number;
  /** Universo da modalidade */
  totalNumbers: number;
}

// ─── Pesos Padrão dos Engines ─────────────────────────────────

const DEFAULT_ENGINE_WEIGHTS: Record<string, number> = {
  hyperScore:     0.25,
  precision:      0.20,
  distribution:   0.15,
  risk:           0.15,
  cycle:          0.10,
  entropy:        0.08,
  correlation:    0.07,
};

// ─── Votação por Borda Count ──────────────────────────────────

/**
 * Borda Count: cada engine ranqueia os candidatos e dá pontos
 * inversamente proporcionais à posição. Candidato com mais
 * pontos totais vence.
 */
function bordaCount(
  candidates: EnsembleInput["candidates"],
  weights: Record<string, number>,
): Array<{ numbers: number[]; bordaPoints: number; normalizedScore: number }> {
  const n = candidates.length;
  const pointsMap = new Map<string, { numbers: number[]; points: number }>();

  const engines = Object.keys(weights);

  for (const engine of engines) {
    const w = weights[engine] || 0;
    if (w === 0) continue;

    // Ranqueia candidatos por este engine
    const ranked = [...candidates]
      .map(c => ({ numbers: c.numbers, score: c.scores[engine] ?? 0 }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < ranked.length; i++) {
      const key = ranked[i].numbers.join(",");
      const bordaPoints = (n - i - 1) * w;
      const existing = pointsMap.get(key);
      if (existing) {
        existing.points += bordaPoints;
      } else {
        pointsMap.set(key, { numbers: ranked[i].numbers, points: bordaPoints });
      }
    }
  }

  const results = Array.from(pointsMap.values());
  const maxPoints = Math.max(...results.map(r => r.points), 1);

  return results
    .map(r => ({
      numbers: r.numbers,
      bordaPoints: r.points,
      normalizedScore: Math.round((r.points / maxPoints) * 100),
    }))
    .sort((a, b) => b.bordaPoints - a.bordaPoints);
}

// ─── Cálculo de Concordância ──────────────────────────────────

/**
 * Mede quão frequentemente os engines concordam na seleção
 * do mesmo candidato no topo.
 */
function computeAgreement(
  candidates: EnsembleInput["candidates"],
  weights: Record<string, number>,
  winner: number[],
): number {
  const winnerKey = winner.join(",");
  const engines = Object.keys(weights);
  let agreementPoints = 0;
  let totalPoints = 0;

  for (const engine of engines) {
    const w = weights[engine] || 0;
    if (w === 0) continue;
    totalPoints += w;

    const topForEngine = [...candidates]
      .map(c => ({ numbers: c.numbers, score: c.scores[engine] ?? 0 }))
      .sort((a, b) => b.score - a.score)[0];

    if (topForEngine?.numbers.join(",") === winnerKey) {
      agreementPoints += w;
    }
  }

  return totalPoints > 0 ? Math.round((agreementPoints / totalPoints) * 100) : 0;
}

// ─── Função Principal ─────────────────────────────────────────

/**
 * Executa a decisão por ensemble de múltiplos engines.
 */
export function runEnsembleDecision(input: EnsembleInput): EnsembleDecision {
  const { candidates, engineWeights, pickCount, totalNumbers } = input;

  if (candidates.length === 0) {
    return {
      consensusNumbers: [],
      consensusScore: 0,
      agreement: 0,
      votes: [],
      engineCount: 0,
      confidence: 0,
      method: "empty",
      interpretation: "Sem candidatos para avaliação.",
    };
  }

  const weights = engineWeights
    ? { ...DEFAULT_ENGINE_WEIGHTS, ...engineWeights }
    : DEFAULT_ENGINE_WEIGHTS;

  // Borda Count
  const ranked = bordaCount(candidates, weights);
  const winner = ranked[0];

  // Monta votos por engine
  const engines = Object.keys(weights);
  const votes: EngineVote[] = engines.map(engine => {
    const topForEngine = [...candidates]
      .map(c => ({ numbers: c.numbers, score: c.scores[engine] ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(c => c.numbers)
      .flat();

    const topScore = candidates
      .map(c => c.scores[engine] ?? 0)
      .sort((a, b) => b - a)[0] || 0;

    return {
      engineName:  engine,
      weight:      weights[engine] || 0,
      topNumbers:  [...new Set(topForEngine)].slice(0, pickCount),
      score:       Math.round(topScore),
      confidence:  Math.min(1, (weights[engine] || 0) + topScore / 100),
    };
  }).filter(v => v.weight > 0);

  const agreement = computeAgreement(candidates, weights, winner?.numbers || []);

  const avgScore = candidates.reduce((s, c) => {
    const scores = Object.values(c.scores);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return s + avg;
  }, 0) / Math.max(candidates.length, 1);

  const confidence = Math.min(0.99, 0.50 + (agreement / 100) * 0.30 + (winner?.normalizedScore || 0) / 100 * 0.19);

  let interpretation: string;
  if (agreement >= 70) {
    interpretation = "Alto consenso entre os engines — decisão confiável.";
  } else if (agreement >= 40) {
    interpretation = "Consenso moderado — engines parcialmente alinhados.";
  } else {
    interpretation = "Baixo consenso — engines divergem; score médio usado.";
  }

  logger.debug(
    { consensusScore: winner?.normalizedScore, agreement, engineCount: votes.length },
    "[EnsembleDecision] Decisão calculada",
  );

  return {
    consensusNumbers: winner?.numbers || candidates[0]?.numbers || [],
    consensusScore:   winner?.normalizedScore || 0,
    agreement,
    votes,
    engineCount:      votes.length,
    confidence:       Math.round(confidence * 100) / 100,
    method:           "borda-count-weighted",
    interpretation,
  };
}

/**
 * Seleciona os melhores N jogos por ensemble.
 */
export function selectTopGamesByEnsemble(
  candidates: EnsembleInput["candidates"],
  count: number,
  weights?: Record<string, number>,
  pickCount: number = 6,
  totalNumbers: number = 60,
): { games: number[][]; decisions: EnsembleDecision[] } {
  if (candidates.length === 0) return { games: [], decisions: [] };

  const w = weights || DEFAULT_ENGINE_WEIGHTS;
  const ranked = bordaCount(candidates, w);
  const top = ranked.slice(0, count);

  const decisions = top.map(t => {
    const candidate = candidates.find(c => c.numbers.join(",") === t.numbers.join(","));
    if (!candidate) return null;
    return runEnsembleDecision({
      candidates: [candidate],
      engineWeights: w,
      pickCount,
      totalNumbers,
    });
  }).filter(Boolean) as EnsembleDecision[];

  return {
    games: top.map(t => t.numbers),
    decisions,
  };
}
