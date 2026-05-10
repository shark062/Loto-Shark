// ============================================================
//  Contest Snapshot — Captura e persistência do estado
//  completo de uma geração de jogos.
// ============================================================

import { logger } from "../../lib/logger";
import {
  buildContestGeneration,
  type ContestGeneration,
  type GeneratedGame,
  type StatisticsSnapshot,
  type FiltersSnapshot,
} from "./contestGeneration";
import { computeTargetContest } from "./temporalValidator";

// ─── Cache em memória dos últimos snapshots ───────────────────
// (sobrevive ao processo, perdido ao reiniciar — ok para rastreabilidade em sessão)

const snapshotCache = new Map<string, ContestGeneration>();
const MAX_CACHE_SIZE = 500;

// ─── Funções Principais ───────────────────────────────────────

/**
 * Captura um snapshot completo de uma geração de jogos.
 * Chame APÓS a geração dos jogos, ANTES de persistir no banco.
 */
export function captureSnapshot(params: {
  modality: string;
  latestKnownContest: number;
  games: GeneratedGame[];
  statisticsSnapshot: StatisticsSnapshot;
  filtersSnapshot: FiltersSnapshot;
  aiVersion?: string;
}): ContestGeneration {
  const targetContest = computeTargetContest(params.latestKnownContest);

  const snapshot = buildContestGeneration({
    modality: params.modality,
    contestNumber: targetContest,
    games: params.games,
    statisticsSnapshot: params.statisticsSnapshot,
    filtersSnapshot: params.filtersSnapshot,
    aiVersion: params.aiVersion,
  });

  // Armazena em cache
  if (snapshotCache.size >= MAX_CACHE_SIZE) {
    const firstKey = snapshotCache.keys().next().value;
    if (firstKey) snapshotCache.delete(firstKey);
  }
  snapshotCache.set(snapshot.id, snapshot);

  logger.info(
    {
      snapshotId: snapshot.id,
      modality: snapshot.modality,
      targetContest: snapshot.contestNumber,
      gamesCount: snapshot.games.length,
      hash: snapshot.generationHash,
    },
    "[ContestSnapshot] Snapshot capturado",
  );

  return snapshot;
}

/**
 * Recupera um snapshot pelo ID.
 */
export function getSnapshot(id: string): ContestGeneration | null {
  return snapshotCache.get(id) || null;
}

/**
 * Lista os últimos N snapshots em memória.
 */
export function listRecentSnapshots(limit: number = 20): ContestGeneration[] {
  const all = Array.from(snapshotCache.values());
  return all.slice(-limit).reverse();
}

/**
 * Extrai metadados do snapshot para incluir em PDFs ou responses.
 */
export function snapshotToPDFMeta(snap: ContestGeneration): {
  modalidade: string;
  concursoAlvo: number;
  dataConcurso: string;
  dataGeracao: string;
  versaoAlgoritmo: string;
  hashGeracao: string;
} {
  return {
    modalidade: snap.modality,
    concursoAlvo: snap.contestNumber,
    dataConcurso: new Date(snap.contestDate).toLocaleDateString("pt-BR"),
    dataGeracao: new Date(snap.generatedAt).toLocaleString("pt-BR"),
    versaoAlgoritmo: snap.algorithmVersion,
    hashGeracao: snap.generationHash,
  };
}

/**
 * Serializa o snapshot para armazenar como JSON no banco.
 */
export function serializeSnapshot(snap: ContestGeneration): string {
  return JSON.stringify(snap);
}

/**
 * Deserializa snapshot armazenado no banco.
 */
export function deserializeSnapshot(raw: string): ContestGeneration | null {
  try {
    return JSON.parse(raw) as ContestGeneration;
  } catch (err) {
    logger.error({ err }, "[ContestSnapshot] Falha ao deserializar snapshot");
    return null;
  }
}
