// ============================================================
//  Draw Validation Engine — Loto-Shark SharkCore v3
//  Valida integridade temporal das conferências de jogos.
//  Previne conferências com concursos errados / futuros.
// ============================================================

import { logger } from "../../lib/logger";
import { validateContestMatch } from "./contestResolver";

export interface DrawValidationResult {
  valid: boolean;
  gameId: number | string;
  lotteryId: string;
  gameContestNumber: number;
  resultContestNumber: number;
  drawnNumbers: number[];
  gameNumbers: number[];
  matches: number[];
  matchCount: number;
  status: "aguardando_sorteio" | "conferido" | "erro_concurso";
  message: string;
}

/**
 * Valida e executa a conferência de um jogo contra um resultado oficial.
 * Retorna os acertos somente se o concurso do resultado bater com o jogo.
 */
export function validateAndCheckGame(params: {
  gameId: number | string;
  lotteryId: string;
  gameContestNumber: number;
  gameNumbers: number[];
  resultContestNumber: number;
  drawnNumbers: number[];
}): DrawValidationResult {
  const {
    gameId,
    lotteryId,
    gameContestNumber,
    gameNumbers,
    resultContestNumber,
    drawnNumbers,
  } = params;

  const contestCheck = validateContestMatch(gameContestNumber, resultContestNumber);

  if (!contestCheck.valid) {
    // Jogo ainda aguarda o sorteio correto
    if (gameContestNumber > resultContestNumber) {
      return {
        valid: false,
        gameId,
        lotteryId,
        gameContestNumber,
        resultContestNumber,
        drawnNumbers,
        gameNumbers,
        matches: [],
        matchCount: 0,
        status: "aguardando_sorteio",
        message: `Concurso ${gameContestNumber} ainda não sorteado. Aguardando resultado oficial.`,
      };
    }

    // Concursos divergem — erro crítico de vinculação
    return {
      valid: false,
      gameId,
      lotteryId,
      gameContestNumber,
      resultContestNumber,
      drawnNumbers,
      gameNumbers,
      matches: [],
      matchCount: 0,
      status: "erro_concurso",
      message: contestCheck.reason,
    };
  }

  // Concurso correto — realiza conferência
  const matches = gameNumbers.filter(n => drawnNumbers.includes(n));

  logger.info({
    gameId,
    lotteryId,
    gameContestNumber,
    resultContestNumber,
    matchCount: matches.length,
  }, "[DrawValidation] Conferência realizada");

  return {
    valid: true,
    gameId,
    lotteryId,
    gameContestNumber,
    resultContestNumber,
    drawnNumbers,
    gameNumbers,
    matches,
    matchCount: matches.length,
    status: "conferido",
    message: `${matches.length} acerto(s) no concurso ${gameContestNumber}.`,
  };
}

/**
 * Confere múltiplos jogos contra um único resultado de sorteio.
 * Filtra automaticamente jogos que não pertencem ao mesmo concurso.
 */
export function validateAndCheckMultipleGames(params: {
  games: Array<{
    id: number | string;
    lotteryId: string;
    contestNumber: number;
    selectedNumbers: number[];
  }>;
  resultContestNumber: number;
  drawnNumbers: number[];
  lotteryId: string;
}): DrawValidationResult[] {
  const { games, resultContestNumber, drawnNumbers, lotteryId } = params;

  return games.map(game =>
    validateAndCheckGame({
      gameId: game.id,
      lotteryId: game.lotteryId || lotteryId,
      gameContestNumber: game.contestNumber,
      gameNumbers: game.selectedNumbers,
      resultContestNumber,
      drawnNumbers,
    })
  );
}
