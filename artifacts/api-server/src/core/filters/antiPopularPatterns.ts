// ============================================================
//  Anti-Popular Patterns — Fase 5
//  Penaliza jogos com padrões populares/previsíveis que
//  aumentam a chance de divisão do prêmio.
//  NÃO bloqueia — apenas penaliza o score.
// ============================================================

// ─── Tipos ────────────────────────────────────────────────────

export interface PopularPatternAnalysis {
  /** Score de penalização (0 = sem penalidade, negativo = penalizado) */
  penalty: number;
  /** Padrões detectados */
  detectedPatterns: string[];
  /** Score final (100 - penaltyAbs, capped at 0) */
  popularPatternScore: number;
}

// ─── Funções de Detecção ──────────────────────────────────────

/**
 * Detecta sequências longas de números consecutivos.
 * Ex: [1,2,3,4,5,6] → sequência de 6 → altamente popular
 */
function detectLongSequences(
  sorted: number[],
  maxAllowed: number = 3,
): { detected: boolean; penalty: number; pattern: string } {
  let maxSeq = 1;
  let cur = 1;
  let seqStart = sorted[0];
  let longestStart = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      cur++;
      if (cur > maxSeq) {
        maxSeq = cur;
        longestStart = seqStart;
      }
    } else {
      cur = 1;
      seqStart = sorted[i];
    }
  }

  if (maxSeq > maxAllowed) {
    const penalty = (maxSeq - maxAllowed) * 15;
    return {
      detected: true,
      penalty,
      pattern: `Sequência longa: ${longestStart}..${longestStart + maxSeq - 1} (${maxSeq} nums)`,
    };
  }
  return { detected: false, penalty: 0, pattern: "" };
}

/**
 * Detecta padrões de datas populares (dia + mês, ex: 25/12, 07/09).
 * Números <= 31 são usados como dias; <= 12 como meses.
 */
function detectDatePatterns(
  sorted: number[],
  totalNumbers: number,
): { detected: boolean; penalty: number; pattern: string } {
  const belowThirtyOne = sorted.filter(n => n <= 31).length;
  const belowTwelve = sorted.filter(n => n <= 12).length;
  const ratio = belowThirtyOne / sorted.length;

  // Penaliza se > 75% dos números estão abaixo de 31 (padrão de data)
  if (ratio > 0.75 && totalNumbers > 31) {
    const penalty = Math.round((ratio - 0.75) * 60);
    return {
      detected: true,
      penalty,
      pattern: `Excesso abaixo de 31: ${belowThirtyOne}/${sorted.length} nums (padrão data)`,
    };
  }
  return { detected: false, penalty: 0, pattern: "" };
}

/**
 * Detecta linhas/colunas completas em cartela 5x10 (estilo lotofácil).
 * Uma linha completa = 5 números consecutivos no mesmo bloco de 5.
 */
function detectCompleteRows(
  sorted: number[],
  totalNumbers: number,
): { detected: boolean; penalty: number; pattern: string } {
  if (totalNumbers < 25) return { detected: false, penalty: 0, pattern: "" };

  const cols = Math.ceil(totalNumbers / 5);
  let maxComplete = 0;

  for (let row = 0; row < 5; row++) {
    const rowNums = [1, 2, 3, 4, 5].map(c => row * cols + c).filter(n => n <= totalNumbers);
    const allPresent = rowNums.every(n => sorted.includes(n));
    if (allPresent) maxComplete++;
  }

  if (maxComplete >= 2) {
    return {
      detected: true,
      penalty: maxComplete * 10,
      pattern: `${maxComplete} linhas completas detectadas (padrão popular)`,
    };
  }
  return { detected: false, penalty: 0, pattern: "" };
}

/**
 * Detecta múltiplos de números populares (5, 10, 11, 22, 33...).
 */
function detectPopularMultiples(
  numbers: number[],
): { detected: boolean; penalty: number; pattern: string } {
  const popularMultiples = [5, 7, 10, 11, 22, 33, 44];
  const found = numbers.filter(n => popularMultiples.includes(n) || n % 10 === 0);

  if (found.length >= 4) {
    return {
      detected: true,
      penalty: (found.length - 3) * 8,
      pattern: `Excesso de múltiplos populares: ${found.join(", ")}`,
    };
  }
  return { detected: false, penalty: 0, pattern: "" };
}

/**
 * Detecta números concentrados em apenas uma faixa do universo.
 * Distribuição ideal = ao menos 1 número por quadrante.
 */
function detectPoorDistribution(
  sorted: number[],
  totalNumbers: number,
): { detected: boolean; penalty: number; pattern: string } {
  const quadrantSize = Math.ceil(totalNumbers / 4);
  const counts = [0, 0, 0, 0];

  for (const n of sorted) {
    const q = Math.min(3, Math.floor((n - 1) / quadrantSize));
    counts[q]++;
  }

  const emptyQuadrants = counts.filter(c => c === 0).length;
  const maxConcentration = Math.max(...counts);

  if (emptyQuadrants >= 2 || maxConcentration / sorted.length > 0.70) {
    const penalty = emptyQuadrants * 12 + (maxConcentration / sorted.length > 0.70 ? 15 : 0);
    return {
      detected: true,
      penalty,
      pattern: `Distribuição pobre: quadrantes ${counts.join("/")} (${emptyQuadrants} vazios)`,
    };
  }
  return { detected: false, penalty: 0, pattern: "" };
}

/**
 * Detecta padrões de diagonal em cartela 5x10.
 * Diagonais completas são muito escolhidas por apostadores.
 */
function detectDiagonalPatterns(
  sorted: number[],
  totalNumbers: number,
): { detected: boolean; penalty: number; pattern: string } {
  if (totalNumbers < 25) return { detected: false, penalty: 0, pattern: "" };

  // Diagonal principal: 1,7,13,19,25 (na lotofácil 5x5)
  const cols = 5;
  const diagonal1 = Array.from({ length: Math.min(5, sorted.length) }, (_, i) => i * cols + i + 1);
  const diagonal2 = Array.from({ length: Math.min(5, sorted.length) }, (_, i) => (i + 1) * cols - i);

  const diag1Matches = diagonal1.filter(n => n <= totalNumbers && sorted.includes(n)).length;
  const diag2Matches = diagonal2.filter(n => n <= totalNumbers && sorted.includes(n)).length;

  const maxMatch = Math.max(diag1Matches, diag2Matches);

  if (maxMatch >= 4) {
    return {
      detected: true,
      penalty: (maxMatch - 3) * 10,
      pattern: `Diagonal detectada: ${maxMatch} números alinhados`,
    };
  }
  return { detected: false, penalty: 0, pattern: "" };
}

// ─── Função Principal ─────────────────────────────────────────

/**
 * Analisa um jogo e retorna um score de penalização por padrões populares.
 *
 * @param numbers       Números do jogo
 * @param totalNumbers  Universo da modalidade
 * @param maxSequence   Sequência máxima permitida sem penalidade
 */
export function popularPatternScore(
  numbers: number[],
  totalNumbers: number,
  maxSequence: number = 3,
): PopularPatternAnalysis {
  const sorted = [...numbers].sort((a, b) => a - b);
  const detectedPatterns: string[] = [];
  let totalPenalty = 0;

  const checks = [
    detectLongSequences(sorted, maxSequence),
    detectDatePatterns(sorted, totalNumbers),
    detectCompleteRows(sorted, totalNumbers),
    detectPopularMultiples(numbers),
    detectPoorDistribution(sorted, totalNumbers),
    detectDiagonalPatterns(sorted, totalNumbers),
  ];

  for (const check of checks) {
    if (check.detected) {
      totalPenalty += check.penalty;
      detectedPatterns.push(check.pattern);
    }
  }

  const popularPatternScore = Math.max(0, 100 - totalPenalty);

  return {
    penalty: -totalPenalty,
    detectedPatterns,
    popularPatternScore,
  };
}

/**
 * Aplica penalização de padrões populares ao score de um jogo.
 *
 * @param originalScore     Score original do jogo
 * @param numbers           Números do jogo
 * @param totalNumbers      Universo da modalidade
 * @param penaltyWeight     Peso da penalização no score final (0–1)
 */
export function applyPopularPatternPenalty(
  originalScore: number,
  numbers: number[],
  totalNumbers: number,
  penaltyWeight: number = 0.15,
): number {
  const analysis = popularPatternScore(numbers, totalNumbers);
  const penaltyComponent = analysis.penalty * penaltyWeight;
  return Math.round(originalScore + penaltyComponent);
}
