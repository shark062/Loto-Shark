export interface OptimizationOptions {
  weights?: Record<number, number>;
  parityTarget?: number;
}

export function enhancedScore(
  combo: number[],
  base: number[],
  exclusionCount: Record<number, number>,
  chosen: number[][],
  options?: OptimizationOptions,
): number {
  const numbers = combo.map(i => base[i]);

  let score = 0;

  score += numbers.reduce((acc, n) => acc + (exclusionCount[n] || 0), 0);

  score += chosen.filter(c => c.some(idx => combo.includes(idx))).length;

  if (options?.weights) {
    score += numbers.reduce(
      (acc, n) => acc + (options.weights![n] || 0),
      0,
    );
  }

  if (options?.parityTarget !== undefined) {
    const game = base.filter((_, idx) => !combo.includes(idx));
    const evenCount = game.filter(n => n % 2 === 0).length;
    score += Math.abs(evenCount - options.parityTarget);
  }

  return score;
}
