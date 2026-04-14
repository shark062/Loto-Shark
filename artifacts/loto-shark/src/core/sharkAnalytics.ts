// ============================================================
//  Shark Analytics — Painel de Desempenho por Estratégia
//  Usa a memória existente do sharkMemory para gerar relatório
// ============================================================

import { carregarMemoria, analisarPerformance } from "./sharkMemory";

export interface RelatorioEstrategia {
  media: number;
  melhor: number;
  jogos: number;
}

export type Relatorio = Record<string, RelatorioEstrategia>;

const EMOJIS: Record<string, string> = {
  quente:     "🔥",
  frio:       "❄️",
  misto:      "🌡️",
  mista:      "🌡️",
  peso:       "⚖️",
  rep_alta:   "🔄",
  rep_baixa:  "🔁",
  shark:      "🦈",
  ia:         "🤖",
  aleatório:  "🎲",
  master:     "🦈",
  default:    "📊",
};

export function gerarRelatorio(): Relatorio {
  const performance = analisarPerformance();
  const relatorio: Relatorio = {};

  for (const [estrategia, dados] of Object.entries(performance)) {
    relatorio[estrategia] = {
      media:  dados.media,
      melhor: dados.melhor,
      jogos:  dados.total,
    };
  }

  return relatorio;
}

export function formatarRelatorio(relatorio: Relatorio): string[] {
  return Object.entries(relatorio)
    .sort((a, b) => b[1].media - a[1].media)
    .map(([estrategia, dados]) => {
      const emoji = EMOJIS[estrategia] || EMOJIS.default;
      return `${emoji} ${capitalize(estrategia)}: média ${dados.media.toFixed(1)} | melhor ${dados.melhor} | ${dados.jogos} jogos`;
    });
}

export function getMelhorEstrategia(relatorio: Relatorio): string | null {
  const entries = Object.entries(relatorio);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1].media - a[1].media)[0][0];
}

export function getEmojiEstrategia(estrategia: string): string {
  return EMOJIS[estrategia] || EMOJIS.default;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export function temDadosSuficientes(): boolean {
  const memoria = carregarMemoria();
  return memoria.filter(m => m.acertos !== undefined).length >= 3;
}
