// ============================================================
//  Contest Resolver — Loto-Shark SharkCore v3
//  Resolve e valida qual concurso deve ser associado a um jogo.
//  Garante que a conferência use SEMPRE o concurso correto.
// ============================================================

import { logger } from "../../lib/logger";
import { createContestBinding, type ContestBinding } from "./contestBindingEngine";

export interface ResolvedContest {
  contestNumber: number;
  isDrawn: boolean;
  canVerify: boolean;
  status: "aguardando_sorteio" | "sorteado" | "conferido";
  message: string;
  binding: ContestBinding;
}

/**
 * Resolve o estado atual de um jogo salvo em relação ao seu concurso.
 *
 * @param savedContestNumber  - Número do concurso vinculado ao jogo
 * @param latestDrawnContest  - Número do último concurso sorteado disponível
 * @param lotteryId           - Modalidade
 */
export function resolveGameContestStatus(
  savedContestNumber: number,
  latestDrawnContest: number,
  lotteryId: string
): ResolvedContest {
  const binding = createContestBinding(lotteryId, latestDrawnContest);

  // O concurso ainda não aconteceu
  if (savedContestNumber > latestDrawnContest) {
    return {
      contestNumber: savedContestNumber,
      isDrawn: false,
      canVerify: false,
      status: "aguardando_sorteio",
      message: `Concurso ${savedContestNumber} ainda não foi sorteado. Aguardando resultado oficial.`,
      binding,
    };
  }

  // O concurso já foi sorteado e pode ser conferido
  if (savedContestNumber <= latestDrawnContest) {
    return {
      contestNumber: savedContestNumber,
      isDrawn: true,
      canVerify: true,
      status: "sorteado",
      message: `Concurso ${savedContestNumber} já foi sorteado. Conferência disponível.`,
      binding,
    };
  }

  // fallback
  return {
    contestNumber: savedContestNumber,
    isDrawn: false,
    canVerify: false,
    status: "aguardando_sorteio",
    message: "Status do concurso indeterminado.",
    binding,
  };
}

/**
 * Valida se um jogo pode ser conferido contra um dado resultado.
 * PROIBIDO conferir com concurso diferente do vinculado.
 *
 * @param gameContestNumber   - Concurso vinculado ao jogo
 * @param resultContestNumber - Concurso do resultado sendo usado para conferência
 */
export function validateContestMatch(
  gameContestNumber: number,
  resultContestNumber: number
): { valid: boolean; reason: string } {
  if (gameContestNumber === resultContestNumber) {
    return { valid: true, reason: "Concurso corresponde ao resultado." };
  }

  if (gameContestNumber > resultContestNumber) {
    const msg = `BLOQUEADO: Jogo vinculado ao concurso ${gameContestNumber}, mas o resultado disponível é do concurso ${resultContestNumber}. Aguardando sorteio.`;
    logger.warn({ gameContestNumber, resultContestNumber }, msg);
    return { valid: false, reason: msg };
  }

  const msg = `ATENÇÃO: Jogo vinculado ao concurso ${gameContestNumber}, conferindo com concurso ${resultContestNumber}. Concursos diferentes.`;
  logger.warn({ gameContestNumber, resultContestNumber }, msg);
  return { valid: false, reason: msg };
}
