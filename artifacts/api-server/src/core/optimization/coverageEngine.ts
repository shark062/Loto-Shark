// ============================================================
//  Coverage Engine — Fase 3: Cobertura Global
//  Garante que as dezenas sejam distribuídas de forma
//  equilibrada entre TODOS os jogos gerados.
//  Evita que o número 01 apareça em quase todos os jogos.
// ============================================================

// ─── Tipos ────────────────────────────────────────────────────

export interface CoverageStats {
  /** Frequência de cada número no conjunto de jogos */
  frequency: Record<number, number>;
  /** Números que aparecem em mais de 60% dos jogos */
  overRepresented: number[];
  /** Números que não aparecem em nenhum jogo */
  uncovered: number[];
  /** Score de cobertura 0-100 (100 = cobertura perfeita) */
  coverageScore: number;
  /** Total de dezenas distintas cobertas */
  distinctNumbers: number;
  /** Cobertura percentual do universo total */
  universePercent: number;
}

export interface CoverageEngineConfig {
  /** Penalização para números super-representados */
  overRepresentationPenalty: number;
  /** Bônus para números sub-representados */
  underRepresentationBonus: number;
  /** Threshold de super-representação (0–1) */
  overRepresentationThreshold: number;
}

const DEFAULT_CONFIG: CoverageEngineConfig = {
  overRepresentationPenalty: 30,
  underRepresentationBonus: 20,
  overRepresentationThreshold: 0.60,
};

// ─── Análise de Cobertura ─────────────────────────────────────

/**
 * Analisa a cobertura de um conjunto de jogos.
 */
export function analyzeCoverage(
  games: number[][],
  totalNumbers: number,
): CoverageStats {
  const frequency: Record<number, number> = {};
  for (let n = 1; n <= totalNumbers; n++) frequency[n] = 0;

  for (const game of games) {
    for (const n of game) {
      if (frequency[n] !== undefined) frequency[n]++;
    }
  }

  const gameCount = Math.max(games.length, 1);
  const threshold = DEFAULT_CONFIG.overRepresentationThreshold;

  const overRepresented = Object.entries(frequency)
    .filter(([, count]) => count / gameCount > threshold)
    .map(([n]) => Number(n));

  const uncovered = Object.entries(frequency)
    .filter(([, count]) => count === 0)
    .map(([n]) => Number(n));

  const distinctNumbers = Object.values(frequency).filter(v => v > 0).length;
  const universePercent = Math.round((distinctNumbers / totalNumbers) * 100);

  // Score de cobertura: penaliza over-represented e uncovered
  const overPenalty = (overRepresented.length / totalNumbers) * 40;
  const uncoveredPenalty = (uncovered.length / totalNumbers) * 30;
  const coverageScore = Math.max(0, Math.round(100 - overPenalty - uncoveredPenalty));

  return {
    frequency,
    overRepresented,
    uncovered,
    coverageScore,
    distinctNumbers,
    universePercent,
  };
}

/**
 * Calcula o score de cobertura de um jogo candidato
 * em relação ao conjunto de jogos já aprovados.
 *
 * Penaliza números super-representados.
 * Bonifica números que ainda não apareceram.
 */
export function coverageScore(
  candidate: number[],
  approvedGames: number[][],
  totalNumbers: number,
  config: CoverageEngineConfig = DEFAULT_CONFIG,
): number {
  if (approvedGames.length === 0) return 50; // neutro se não há jogos

  const stats = analyzeCoverage(approvedGames, totalNumbers);
  const gameCount = Math.max(approvedGames.length, 1);
  const threshold = config.overRepresentationThreshold;

  let score = 0;

  for (const n of candidate) {
    const freq = stats.frequency[n] || 0;
    const ratio = freq / gameCount;

    if (ratio > threshold) {
      // Número super-representado — penaliza
      score -= config.overRepresentationPenalty * (ratio - threshold);
    } else if (freq === 0) {
      // Número nunca usado — bonifica
      score += config.underRepresentationBonus;
    } else {
      // Frequência moderada — neutro a levemente positivo
      score += (threshold - ratio) * 10;
    }
  }

  return Math.round(score);
}

/**
 * Re-ordena a lista de jogos candidatos priorizando cobertura global.
 * Combina o score original com o score de cobertura.
 *
 * @param games       Lista de { numbers, score } (score original, maior = melhor)
 * @param totalNumbers  Universo da modalidade
 * @param coverageWeight  Peso da cobertura no score combinado (0–1)
 */
export function reorderByCoverage(
  games: Array<{ numbers: number[]; score: number; origem?: string }>,
  totalNumbers: number,
  coverageWeight: number = 0.30,
): Array<{ numbers: number[]; score: number; combinedScore: number; origem?: string }> {
  if (games.length === 0) return [];

  const approved: number[][] = [];
  const result: Array<{ numbers: number[]; score: number; combinedScore: number; origem?: string }> = [];

  // Normaliza scores originais
  const maxScore = Math.max(...games.map(g => g.score), 1);

  for (const game of games) {
    const normalizedOriginal = (game.score / maxScore) * (1 - coverageWeight) * 100;
    const covScore = coverageScore(game.numbers, approved, totalNumbers) * coverageWeight;
    const combinedScore = Math.round(normalizedOriginal + covScore);

    result.push({ ...game, combinedScore });
    approved.push(game.numbers);
  }

  result.sort((a, b) => b.combinedScore - a.combinedScore);
  return result;
}

/**
 * Versão simplificada do score de cobertura (0–100).
 * Útil para exibição no frontend.
 */
export function computeGlobalCoverageScore(
  games: number[][],
  totalNumbers: number,
): number {
  return analyzeCoverage(games, totalNumbers).coverageScore;
}
