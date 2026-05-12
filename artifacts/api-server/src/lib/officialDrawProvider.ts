// ============================================================
//  Official Draw Provider — Loto-Shark SharkCore v3
//  Busca resultados oficiais SOMENTE da Caixa Econômica Federal
//  NUNCA usa YouTube, canais externos ou fontes não oficiais
// ============================================================

import { logger } from "./logger";

const CAIXA_API = "https://servicebus2.caixa.gov.br/portaldeloterias/api";

export interface OfficialDraw {
  lotteryId: string;
  contestNumber: number;
  drawDate: string | null;
  drawnNumbers: number[];
  prizes: PrizeTier[];
  accumulado: boolean;
  estimatedNext: number | null;
  status: "available" | "pending" | "unavailable";
  fetchedAt: string;
}

export interface PrizeTier {
  description: string;
  winners: number;
  prize: string;
}

const CAIXA_ID_MAP: Record<string, string> = {
  megasena:      "megasena",
  lotofacil:     "lotofacil",
  quina:         "quina",
  lotomania:     "lotomania",
  duplasena:     "duplasena",
  timemania:     "timemania",
  diadesorte:    "diadesorte",
  supersete:     "supersete",
  maisMilionaria:"maismilionaria",
};

/**
 * Busca o último sorteio oficial de uma modalidade direto da Caixa.
 * Retorna null se indisponível — nunca usa fallback externo.
 */
export async function fetchLatestOfficialDraw(lotteryId: string): Promise<OfficialDraw | null> {
  const caixaId = CAIXA_ID_MAP[lotteryId] || lotteryId;
  const url = `${CAIXA_API}/${caixaId}`;

  try {
    const resp = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; LotoShark/3.0)",
        "Origin": "https://loterias.caixa.gov.br",
        "Referer": "https://loterias.caixa.gov.br/",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      logger.warn({ lotteryId, status: resp.status }, "[OfficialDrawProvider] Caixa retornou erro HTTP");
      return null;
    }

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      logger.warn({ lotteryId, contentType }, "[OfficialDrawProvider] Caixa retornou HTML (Cloudflare block)");
      return null;
    }

    const data = await resp.json() as any;
    const nums: number[] = (data.dezenas || data.listaDezenas || []).map(Number);

    // +Milionária: separa dezenas (1-50) dos trevos (1-6)
    const finalNums = (lotteryId === "maisMilionaria" && nums.length > 6)
      ? nums.slice(0, 6)
      : nums;

    const prizes: PrizeTier[] = (data.premiacoes || data.listaRateioPremio || []).map((p: any) => ({
      description: p.descricao || p.faixa || "",
      winners: Number(p.numeroDeGanhadores || p.ganhadores || 0),
      prize: p.valorPremio ? `R$ ${Number(p.valorPremio).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "0",
    }));

    return {
      lotteryId,
      contestNumber: Number(data.numero || data.numeroConcurso || 0),
      drawDate: data.dataApuracao || data.data || null,
      drawnNumbers: finalNums,
      prizes,
      accumulado: Boolean(data.acumulado),
      estimatedNext: data.valorEstimadoProximoConcurso
        ? Number(data.valorEstimadoProximoConcurso)
        : null,
      status: finalNums.length > 0 ? "available" : "pending",
      fetchedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    logger.error({ lotteryId, err: err.message }, "[OfficialDrawProvider] Falha ao buscar resultado oficial");
    return null;
  }
}

/**
 * Busca o resultado de um concurso específico da Caixa.
 */
export async function fetchOfficialDrawByContest(
  lotteryId: string,
  contestNumber: number
): Promise<OfficialDraw | null> {
  const caixaId = CAIXA_ID_MAP[lotteryId] || lotteryId;
  const url = `${CAIXA_API}/${caixaId}/${contestNumber}`;

  try {
    const resp = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; LotoShark/3.0)",
        "Origin": "https://loterias.caixa.gov.br",
        "Referer": "https://loterias.caixa.gov.br/",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) return null;

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return null;

    const data = await resp.json() as any;
    const nums: number[] = (data.dezenas || data.listaDezenas || []).map(Number);

    return {
      lotteryId,
      contestNumber: Number(data.numero || contestNumber),
      drawDate: data.dataApuracao || null,
      drawnNumbers: nums.length > 0 ? nums : [],
      prizes: [],
      accumulado: Boolean(data.acumulado),
      estimatedNext: null,
      status: nums.length > 0 ? "available" : "pending",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
