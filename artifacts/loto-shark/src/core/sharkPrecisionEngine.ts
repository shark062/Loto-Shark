// ============================================================
//  Shark Precision Engine — Motor Central de Score Real
//  Avalia cada jogo com score 0–100 baseado em múltiplos
//  critérios estatísticos. Não chama API nem localStorage.
// ============================================================

import { isValidGame } from "./sharkFilters";

export type ScoreRank = "BAIXO" | "BOM" | "ÓTIMO" | "ELITE";

export interface PrecisionResult {
  game: number[];
  score: number;
  rank: ScoreRank;
  reasons: string[];
}

export interface FreqEntry {
  number: number;
  frequency: number;
  temperature: "hot" | "warm" | "cold";
}

// ─── Helpers internos ─────────────────────────────────────────

function maxConsec(sorted: number[]): number {
  let max = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    cur = sorted[i] === sorted[i - 1] + 1 ? cur + 1 : 1;
    max = Math.max(max, cur);
  }
  return max;
}

function faixas(sorted: number[], totalNumbers: number): number[] {
  const sz = Math.ceil(totalNumbers / 4);
  const f = [0, 0, 0, 0];
  for (const n of sorted) {
    const idx = Math.min(3, Math.floor((n - 1) / sz));
    f[idx]++;
  }
  return f;
}

// ─── Score Principal ──────────────────────────────────────────

export function calcularScorePrecisao(
  game: number[],
  frequencies: FreqEntry[],
  modalityId: string,
  totalNumbers: number,
  lastDraw?: number[],
): PrecisionResult {
  const sorted = [...game].sort((a, b) => a - b);
  const n = sorted.length;
  const freqMap = new Map(frequencies.map(f => [f.number, f]));
  const reasons: string[] = [];

  // Pontuação base neutra
  let score = 50;

  // ─── 1. Equilíbrio par/ímpar ──────────────────────────────
  const pares = sorted.filter(x => x % 2 === 0).length;
  const impares = n - pares;
  const balancePE = Math.abs(pares - impares) / n;
  if (balancePE <= 0.15) { score += 9; reasons.push("equilíbrio par/ímpar perfeito"); }
  else if (balancePE <= 0.35) { score += 5; reasons.push("bom equilíbrio par/ímpar"); }
  else { score -= 4; }

  // ─── 2. Números quentes moderados ─────────────────────────
  const quentes = sorted.filter(x => freqMap.get(x)?.temperature === "hot").length;
  const propQ = quentes / n;
  if (propQ >= 0.2 && propQ <= 0.45) { score += 8; reasons.push("quentes moderados"); }
  else if (propQ > 0.6) { score -= 6; }
  else if (propQ < 0.1) { score -= 3; }

  // ─── 3. Números atrasados (frios) saudáveis ───────────────
  const frios = sorted.filter(x => freqMap.get(x)?.temperature === "cold").length;
  const propF = frios / n;
  if (propF >= 0.15 && propF <= 0.45) { score += 7; reasons.push("atraso equilibrado"); }
  else if (propF > 0.55) { score -= 5; }

  // ─── 4. Distribuição por faixas numéricas ─────────────────
  const f = faixas(sorted, totalNumbers);
  const ocupadas = f.filter(x => x > 0).length;
  if (ocupadas >= 4) { score += 10; reasons.push("distribuição excelente (4 faixas)"); }
  else if (ocupadas >= 3) { score += 6; reasons.push("boa distribuição (3 faixas)"); }
  else if (ocupadas <= 1) { score -= 10; }

  // ─── 5. Soma ideal ────────────────────────────────────────
  const soma = sorted.reduce((a, b) => a + b, 0);
  const somaIdeal = (totalNumbers + 1) / 2 * n;
  const desvio = Math.abs(soma - somaIdeal) / somaIdeal;
  if (desvio <= 0.08) { score += 9; reasons.push("soma ideal"); }
  else if (desvio <= 0.18) { score += 5; }
  else if (desvio > 0.32) { score -= 7; }

  // ─── 6. Repetição do último concurso ──────────────────────
  if (lastDraw && lastDraw.length > 0) {
    const rep = sorted.filter(x => lastDraw.includes(x)).length;
    const propR = rep / n;
    if (propR >= 0.1 && propR <= 0.35) { score += 5; reasons.push("repetição ideal do último sorteio"); }
    else if (propR > 0.55) { score -= 6; }
  }

  // ─── 7. Consecutivos ──────────────────────────────────────
  const cs = maxConsec(sorted);
  if (cs <= 2) { score += 5; }
  else if (cs === 3) { /* neutro */ }
  else if (cs >= 4) { score -= 8; }

  // ─── 8. Variedade de terminações ──────────────────────────
  const termsUniq = new Set(sorted.map(x => x % 10)).size;
  const propTermVar = termsUniq / n;
  if (propTermVar >= 0.75) { score += 5; reasons.push("boa variedade de terminações"); }
  else if (propTermVar < 0.4) { score -= 4; }

  // ─── 9. Validação pelos filtros profissionais ─────────────
  const filterRes = isValidGame(game, modalityId);
  if (!filterRes.valid) {
    score -= filterRes.rejections.length * 7;
  } else {
    score += 6;
    reasons.push("passou todos os filtros");
  }

  // ─── 10. Bônus por números mornos (tendência positiva) ────
  const mornos = sorted.filter(x => freqMap.get(x)?.temperature === "warm").length;
  if (mornos >= Math.floor(n * 0.25)) { score += 4; reasons.push("dezenas estratégicas (mornos)"); }

  // Clamp
  score = Math.max(0, Math.min(100, Math.round(score)));

  const rank: ScoreRank =
    score >= 90 ? "ELITE" :
    score >= 80 ? "ÓTIMO" :
    score >= 70 ? "BOM"   : "BAIXO";

  return { game: sorted, score, rank, reasons };
}

// ─── Utilitários visuais ──────────────────────────────────────

export function getRankColor(rank: ScoreRank): string {
  switch (rank) {
    case "ELITE": return "text-yellow-400";
    case "ÓTIMO": return "text-green-400";
    case "BOM":   return "text-blue-400";
    default:      return "text-red-400";
  }
}

export function getRankBgColor(rank: ScoreRank): string {
  switch (rank) {
    case "ELITE": return "bg-yellow-500/20 border-yellow-500/50";
    case "ÓTIMO": return "bg-green-500/20 border-green-500/50";
    case "BOM":   return "bg-blue-500/20 border-blue-500/50";
    default:      return "bg-red-500/20 border-red-500/50";
  }
}

export function getRankEmoji(rank: ScoreRank): string {
  switch (rank) {
    case "ELITE": return "🏆";
    case "ÓTIMO": return "⭐";
    case "BOM":   return "✅";
    default:      return "⚠️";
  }
}
