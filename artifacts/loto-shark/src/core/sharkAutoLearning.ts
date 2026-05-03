// ============================================================
//  Shark Auto Learning — Aprendizado Interno por Estratégia
//  Registra o desempenho de cada estratégia e ajusta pesos.
//  Persiste no localStorage, compatível com sharkMemory.ts.
// ============================================================

const KEY = "shark_autolearning_v1";

export type StrategyName = string;

export interface StrategyLearning {
  weight: number;
  totalGames: number;
  totalScore: number;
  avgScore: number;
  wins: number;       // jogos com score >= 80
  lastUpdated: number;
}

export type LearningData = Record<StrategyName, StrategyLearning>;

// Estratégias conhecidas no sistema
const KNOWN_STRATEGIES: StrategyName[] = [
  "atrasados", "quentes", "balanceado", "fibonacci",
  "oposto", "linhas", "quadrantes",
  "shark", "master", "misto", "quente", "frio",
  "peso", "rep_alta", "rep_baixa", "ia",
];

// ─── Persistência ─────────────────────────────────────────────

function load(): LearningData {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persist(data: LearningData): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function getOrCreate(data: LearningData, strategy: StrategyName): StrategyLearning {
  if (!data[strategy]) {
    data[strategy] = {
      weight: 1.0,
      totalGames: 0,
      totalScore: 0,
      avgScore: 0,
      wins: 0,
      lastUpdated: Date.now(),
    };
  }
  return data[strategy];
}

// ─── API pública ──────────────────────────────────────────────

export function registrarDesempenho(strategy: StrategyName, score: number): void {
  const data = load();
  const s = getOrCreate(data, strategy);

  s.totalGames++;
  s.totalScore += score;
  s.avgScore = parseFloat((s.totalScore / s.totalGames).toFixed(2));
  s.lastUpdated = Date.now();
  if (score >= 80) s.wins++;

  // Ajuste dinâmico de peso
  if (score >= 88) {
    s.weight = Math.min(2.5, s.weight + 0.10);
  } else if (score >= 75) {
    s.weight = Math.min(2.0, s.weight + 0.04);
  } else if (score < 60) {
    s.weight = Math.max(0.2, s.weight - 0.06);
  } else if (score < 50) {
    s.weight = Math.max(0.2, s.weight - 0.10);
  }

  persist(data);
}

export function getWeights(): LearningData {
  const data = load();
  for (const s of KNOWN_STRATEGIES) getOrCreate(data, s);
  return data;
}

export function getMelhorEstrategia(): StrategyName | null {
  const data = load();
  const entries = Object.entries(data).filter(([, v]) => v.totalGames >= 3);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1].avgScore - a[1].avgScore)[0][0];
}

export function getWeightForStrategy(strategy: StrategyName): number {
  const data = load();
  return data[strategy]?.weight ?? 1.0;
}

export function resetarAprendizado(): void {
  localStorage.removeItem(KEY);
}

export function resumoAprendizado(): Array<{
  nome: string;
  peso: number;
  avgScore: number;
  jogos: number;
  wins: number;
}> {
  const data = getWeights();
  return Object.entries(data)
    .filter(([, v]) => v.totalGames > 0)
    .map(([nome, v]) => ({
      nome,
      peso: v.weight,
      avgScore: v.avgScore,
      jogos: v.totalGames,
      wins: v.wins,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}
