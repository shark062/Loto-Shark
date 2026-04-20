import type { LotteryConfig } from '../types/LotteryConfig';

const MAX_COMBINATIONS = 5000;

function shuffleSample<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export function generateCombinations(arr: number[], k: number): number[][] {
  const result: number[][] = [];

  function helper(start: number, combo: number[]) {
    if (result.length >= MAX_COMBINATIONS) return;
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      if (result.length >= MAX_COMBINATIONS) break;
      combo.push(arr[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }

  helper(0, []);
  return result;
}

export function generateGamesFromBase(
  base: number[],
  config: LotteryConfig,
  totalGames: number,
): number[][] {
  const removeCount = base.length - config.pickCount;

  if (removeCount <= 0) {
    throw new Error('Base inválida: pool menor ou igual ao pickCount');
  }

  const indices = base.map((_, i) => i);

  const sourceIndices =
    indices.length > 20
      ? shuffleSample(indices, Math.min(indices.length, 18))
      : indices;

  const combinations = generateCombinations(sourceIndices, removeCount);

  const games: number[][] = [];
  const exclusionCount: Record<number, number> = {};
  base.forEach(n => (exclusionCount[n] = 0));

  const chosen: number[][] = [];

  function score(combo: number[]): number {
    const freqPenalty = combo.reduce(
      (acc, idx) => acc + exclusionCount[base[idx]],
      0,
    );
    const overlapPenalty = chosen.filter(c =>
      c.some(idx => combo.includes(idx)),
    ).length;
    return freqPenalty + overlapPenalty;
  }

  const maxGames = Math.min(totalGames, combinations.length);
  const working = [...combinations];

  for (let i = 0; i < maxGames; i++) {
    working.sort((a, b) => score(a) - score(b));
    const best = working.shift()!;
    chosen.push(best);
    best.forEach(idx => {
      exclusionCount[base[idx]]++;
    });
    const game = base
      .filter((_, idx) => !best.includes(idx))
      .sort((a, b) => a - b);
    games.push(game);
  }

  return games;
}

export function validateGames(
  games: number[][],
  config: LotteryConfig,
): boolean {
  return games.every(
    g =>
      g.length === config.pickCount &&
      new Set(g).size === g.length &&
      g.every(n => n >= 1 && n <= config.maxNumber),
  );
}
