// ============================================================
//  Portuguese Defaults — Textos padrão em Português Brasileiro
//  Todos os textos da plataforma devem vir deste arquivo.
//  Nunca use strings hardcoded em inglês nas respostas ao usuário.
// ============================================================

export const PT_BR = {
  // ── Erros Gerais ──────────────────────────────────────────
  errors: {
    generic:               "Ocorreu um erro interno. Tente novamente.",
    notFound:              "Recurso não encontrado.",
    invalidInput:          "Dados de entrada inválidos.",
    insufficientHistory:   "Histórico insuficiente para análise.",
    pipelineEmpty:         "Pipeline não conseguiu gerar jogos. Tente novamente.",
    databaseUnavailable:   "Banco de dados temporariamente indisponível.",
    aiUnavailable:         "Serviço de IA temporariamente indisponível.",
    timeout:               "Tempo limite atingido. Tente novamente.",
  },

  // ── Estratégias ───────────────────────────────────────────
  strategies: {
    hot:   "Números Quentes (alta frequência recente)",
    cold:  "Números Frios (maior atraso acumulado)",
    mixed: "Estratégia Mista (quentes + frios equilibrado)",
    ai:    "Inteligência Artificial Avançada",
    shark: "Motor Shark Master (análise completa)",
    impulso:       "Estratégia Impulso (favor quentes)",
    compensacao:   "Estratégia Compensação (favor frios)",
    variacao_pura: "Variação Pura (aleatoriedade controlada)",
    peso:          "Estratégia de Peso (frequência ponderada)",
    rep_alta:      "Alta Repetição (ciclos curtos)",
    rep_baixa:     "Baixa Repetição (ciclos longos)",
  },

  // ── Métricas de Risco ─────────────────────────────────────
  risk: {
    baixo:      "Risco Baixo",
    medio:      "Risco Médio",
    alto:       "Risco Alto",
    muito_alto: "Risco Muito Alto",
  },

  // ── Tendências ────────────────────────────────────────────
  trends: {
    subindo:         "Em alta",
    estavel:         "Estável",
    caindo:          "Em queda",
    aquecimento:     "Mercado em aquecimento",
    resfriamento:    "Mercado em resfriamento",
  },

  // ── Ciclos ────────────────────────────────────────────────
  cycles: {
    overdue:  "Atrasado",
    due:      "No prazo",
    recent:   "Recente",
    saturated: "Saturado",
  },

  // ── Medalhas ──────────────────────────────────────────────
  medals: {
    ouro:       "Ouro — Qualidade Excepcional",
    prata:      "Prata — Alta Qualidade",
    bronze:     "Bronze — Boa Qualidade",
    sem_medalha: "Sem Medalha — Qualidade Regular",
  },

  // ── Entropia ──────────────────────────────────────────────
  entropy: {
    alta:  "Alta Entropia — Jogo diversificado",
    media: "Entropia Média — Jogo equilibrado",
    baixa: "Baixa Entropia — Jogo concentrado",
  },

  // ── Modalidades ───────────────────────────────────────────
  lotteries: {
    megasena:      "Mega-Sena",
    lotofacil:     "Lotofácil",
    quina:         "Quina",
    lotomania:     "Lotomania",
    duplasena:     "Dupla Sena",
    timemania:     "Timemania",
    diadesorte:    "Dia de Sorte",
    supersete:     "Super Sete",
    maisMilionaria: "+Milionária",
  },

  // ── Pipeline ──────────────────────────────────────────────
  pipeline: {
    generating:   "Gerando jogos com análise estatística completa...",
    analyzing:    "Analisando {draws} sorteios históricos...",
    filtering:    "Aplicando {count} filtros de qualidade...",
    ranking:      "Ranqueando {count} candidatos...",
    complete:     "Geração concluída: {count} jogo(s) de alta qualidade.",
    version:      "Pipeline v{version}",
  },

  // ── IA ────────────────────────────────────────────────────
  ai: {
    analyzing:    "IA analisando padrões estatísticos...",
    noProviders:  "Nenhum provedor de IA ativo — usando análise estatística.",
    fallback:     "Usando análise estatística pura (sem IA).",
    providers: {
      openai:    "OpenAI",
      anthropic: "Anthropic",
      groq:      "Groq",
    },
  },

  // ── Backtest ──────────────────────────────────────────────
  backtest: {
    roi:              "Retorno sobre Investimento",
    winRate:          "Taxa de Premiação",
    avgHits:          "Média de Acertos por Sorteio",
    stability:        "Score de Estabilidade",
    drawsTested:      "Sorteios Testados",
    excellent:        "Desempenho Excelente",
    good:             "Bom Desempenho",
    average:          "Desempenho Médio",
    poor:             "Desempenho Abaixo da Média",
  },

  // ── System ────────────────────────────────────────────────
  system: {
    ready:        "Sistema Loto-Shark v3 pronto.",
    initializing: "Inicializando plataforma...",
    version:      "Versão {version}",
    uptime:       "Em operação por {uptime}",
  },

  // ── Prompts de IA (em português obrigatório) ──────────────
  aiPrompts: {
    systemRole: `Você é o Shark AI, assistente especializado em análise estatística de loterias brasileiras.
Todas as suas respostas devem ser EXCLUSIVAMENTE em Português Brasileiro.
Você analisa padrões históricos, frequências, ciclos e tendências para gerar insights estratégicos.
Seja objetivo, técnico e cite sempre os dados estatísticos que embasam suas análises.`,

    analysisTemplate: `Analise os seguintes dados da {lottery} e forneça uma análise estatística completa em Português Brasileiro:
- Sorteios analisados: {draws}
- Números quentes: {hot}
- Números frios: {cold}
- Soma média histórica: {avgSum}
- Pares médios: {avgEvens}

Forneça: tendências atuais, estratégia recomendada e justificativa estatística.`,

    gameReasoning: `Jogo gerado pela estratégia "{strategy}" após análise de {draws} sorteios históricos.
Score de precisão: {precision}/1000. Nível de risco: {risk}. 
Filtros aplicados: {filters}.`,
  },
} as const;

export type PTBRKey = keyof typeof PT_BR;

/**
 * Substitui placeholders em templates de texto.
 * Ex: format("Olá {name}", { name: "Shark" }) → "Olá Shark"
 */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
}
