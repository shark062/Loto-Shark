// ============================================================
//  Language Manager — Gerenciamento de Idiomas
//  Suporta PT-BR como idioma padrão obrigatório.
//  Estruturado para suporte futuro a outros idiomas.
//  Garante que todas as respostas ao usuário sejam em PT-BR.
// ============================================================

import { logger } from "../../lib/logger";
import { PT_BR, format } from "./portugueseDefaults";

// ─── Tipos ────────────────────────────────────────────────────

export type SupportedLanguage = "pt-BR" | "en-US";

export interface LanguageState {
  current:   SupportedLanguage;
  fallback:  SupportedLanguage;
  loadedAt:  string;
}

// ─── Estado ───────────────────────────────────────────────────

let state: LanguageState = {
  current:  "pt-BR",
  fallback: "pt-BR",
  loadedAt: new Date().toISOString(),
};

// ─── API ──────────────────────────────────────────────────────

/**
 * Define o idioma padrão da plataforma.
 * PT-BR é obrigatório — qualquer outra opção tem PT-BR como fallback.
 */
export function setDefaultLanguage(lang: string): void {
  const supported: SupportedLanguage[] = ["pt-BR", "en-US"];
  const resolved = supported.includes(lang as SupportedLanguage)
    ? (lang as SupportedLanguage)
    : "pt-BR";

  if (resolved !== "pt-BR") {
    logger.warn({ lang: resolved }, "[Language] PT-BR continua como fallback obrigatório");
  }

  state = { ...state, current: resolved, loadedAt: new Date().toISOString() };
  logger.info({ language: resolved }, "[Language] Idioma definido");
}

/**
 * Retorna o idioma atual.
 */
export function getCurrentLanguage(): SupportedLanguage {
  return state.current;
}

/**
 * Retorna um texto traduzido pelo caminho de chave.
 * Ex: t("errors.generic") → "Ocorreu um erro interno..."
 */
export function t(path: string, values?: Record<string, string | number>): string {
  const parts = path.split(".");
  let current: any = PT_BR;

  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      logger.debug({ path }, "[Language] Chave de tradução não encontrada");
      return path; // fallback: retorna a chave
    }
  }

  const text = typeof current === "string" ? current : path;
  return values ? format(text, values) : text;
}

/**
 * Retorna o prompt de sistema padrão para IA em PT-BR.
 * Garante que todas as respostas de IA sejam em português.
 */
export function getAISystemPrompt(): string {
  return PT_BR.aiPrompts.systemRole;
}

/**
 * Injeta a instrução de idioma em qualquer prompt de IA.
 * Use sempre antes de chamar providers de IA.
 */
export function injectLanguageInstruction(prompt: string): string {
  const instruction = "\n\n[INSTRUÇÃO OBRIGATÓRIA]: Responda EXCLUSIVAMENTE em Português Brasileiro (PT-BR). Não use inglês em nenhuma parte da resposta.";
  return prompt + instruction;
}

/**
 * Constrói um prompt de análise estatística em PT-BR.
 */
export function buildAnalysisPrompt(params: {
  lottery:  string;
  draws:    number;
  hot:      number[];
  cold:     number[];
  avgSum:   number;
  avgEvens: number;
}): string {
  return format(PT_BR.aiPrompts.analysisTemplate, {
    lottery:  params.lottery,
    draws:    params.draws,
    hot:      params.hot.slice(0, 10).join(", "),
    cold:     params.cold.slice(0, 10).join(", "),
    avgSum:   Math.round(params.avgSum),
    avgEvens: Math.round(params.avgEvens * 10) / 10,
  });
}

/**
 * Estado atual do language manager.
 */
export function getLanguageState(): LanguageState {
  return { ...state };
}
