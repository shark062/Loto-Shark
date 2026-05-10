// ============================================================
//  Similarity Engine — Fase 2: Anti-Redundância
//  Calcula distância entre jogos e rejeita jogos
//  extremamente parecidos para garantir diversidade real.
// ============================================================

// ─── Configuração por modalidade ──────────────────────────────

const MINIMUM_DISTANCE_CONFIG: Record<string, number> = {
  megasena:   3,   // mínimo 3 dezenas diferentes entre jogos
  lotofacil:  6,   // mínimo 6 dezenas diferentes entre jogos
  quina:      2,
  lotomania:  12,  // 50 números — distância maior faz sentido
  duplasena:  3,
  timemania:  4,
  diadesorte: 3,
  supersete:  2,
};

const DEFAULT_MIN_DISTANCE = 3;

// ─── Funções de Similaridade ──────────────────────────────────

/**
 * Calcula o número de dezenas diferentes entre dois jogos.
 * Distância = tamanho da diferença simétrica entre os conjuntos.
 *
 * Ex: [1,2,3,4,5,6] vs [1,2,3,4,5,7] → distância = 2 (6 e 7 são diferentes)
 */
export function calculateGameDistance(gameA: number[], gameB: number[]): number {
  const setA = new Set(gameA);
  const setB = new Set(gameB);

  let diff = 0;
  for (const n of setA) if (!setB.has(n)) diff++;
  for (const n of setB) if (!setA.has(n)) diff++;

  return diff;
}

/**
 * Calcula similaridade normalizada entre dois jogos (0 = idênticos, 1 = completamente diferentes).
 */
export function calculateGameSimilarity(gameA: number[], gameB: number[]): number {
  const maxLen = Math.max(gameA.length, gameB.length);
  if (maxLen === 0) return 0;
  const distance = calculateGameDistance(gameA, gameB);
  return Math.min(1, distance / maxLen);
}

/**
 * Retorna o mínimo de dezenas diferentes exigido entre dois jogos
 * para a modalidade informada.
 */
export function getMinimumDistance(lotteryId: string): number {
  return MINIMUM_DISTANCE_CONFIG[lotteryId] ?? DEFAULT_MIN_DISTANCE;
}

/**
 * Verifica se um jogo candidato é suficientemente diferente de todos
 * os jogos já aprovados.
 *
 * @param candidate  Jogo candidato
 * @param approved   Lista de jogos já aprovados
 * @param minDist    Distância mínima exigida (dezenas diferentes)
 */
export function isSufficientlyDifferent(
  candidate: number[],
  approved: number[][],
  minDist: number,
): boolean {
  for (const game of approved) {
    if (calculateGameDistance(candidate, game) < minDist) {
      return false;
    }
  }
  return true;
}

// ─── Filtro de Redundância ────────────────────────────────────

export interface SimilarityFilterResult {
  filtered: number[][];
  removedCount: number;
  reasons: string[];
}

/**
 * Filtra uma lista de jogos candidatos, removendo os excessivamente
 * similares. Mantém sempre os de maior score.
 *
 * @param games      Lista de { numbers, score } ordenada por score desc
 * @param lotteryId  ID da modalidade para obter o minDist correto
 * @param maxGames   Número máximo de jogos a retornar
 */
export function filterRedundantGames(
  games: Array<{ numbers: number[]; score: number; origem?: string }>,
  lotteryId: string,
  maxGames: number,
): SimilarityFilterResult {
  const minDist = getMinimumDistance(lotteryId);
  const approved: number[][] = [];
  const reasons: string[] = [];
  let removedCount = 0;

  for (const game of games) {
    if (approved.length >= maxGames) break;

    if (isSufficientlyDifferent(game.numbers, approved, minDist)) {
      approved.push(game.numbers);
    } else {
      removedCount++;
      reasons.push(
        `Jogo [${game.numbers.join(",")}] removido: muito similar a jogos existentes (minDist=${minDist})`,
      );
    }
  }

  // Se não tiver jogos suficientes após filtro, relaxa a restrição
  if (approved.length < maxGames && removedCount > 0) {
    const relaxedDist = Math.max(1, minDist - 1);
    for (const game of games) {
      if (approved.length >= maxGames) break;
      if (!approved.some(a => a.join(",") === game.numbers.join(","))) {
        if (isSufficientlyDifferent(game.numbers, approved, relaxedDist)) {
          approved.push(game.numbers);
          reasons.push(`Jogo adicionado com distância relaxada (${relaxedDist})`);
        }
      }
    }
  }

  return { filtered: approved, removedCount, reasons };
}

/**
 * Calcula a matriz de distâncias entre todos os jogos.
 * Útil para debug e análise de diversidade.
 */
export function computeDistanceMatrix(games: number[][]): number[][] {
  return games.map(a => games.map(b => calculateGameDistance(a, b)));
}

/**
 * Score de diversidade global de um conjunto de jogos (0–100).
 * 100 = todos os jogos são completamente diferentes.
 */
export function computeDiversityScore(games: number[][], lotteryId: string): number {
  if (games.length < 2) return 100;
  const minDist = getMinimumDistance(lotteryId);
  const matrix = computeDistanceMatrix(games);
  let totalPairs = 0;
  let satisfiedPairs = 0;

  for (let i = 0; i < games.length; i++) {
    for (let j = i + 1; j < games.length; j++) {
      totalPairs++;
      if (matrix[i][j] >= minDist) satisfiedPairs++;
    }
  }

  return totalPairs > 0 ? Math.round((satisfiedPairs / totalPairs) * 100) : 100;
}
