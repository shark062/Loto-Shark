// ============================================================
//  Shark Saved Games — Persistência local de todos os jogos gerados
//  Salva no localStorage com o mesmo formato do backend,
//  garantindo que os jogos sobrevivam reinicializações do servidor.
// ============================================================

const KEY       = "shark_saved_games_v1";
const MAX_JOGOS = 500;

export interface SavedGame {
  id: string | number;
  lotteryId: string;
  selectedNumbers: number[];
  strategy: string;
  confidence?: number;
  reasoning?: string;
  dataSource?: string;
  matches: number;
  prizeWon: string;
  contestNumber: number | null;
  createdAt: string;
  sharkScore?: number;
  sharkOrigem?: string;
  sharkContexto?: {
    hot: number[];
    warm: number[];
    cold: number[];
    totalCandidatos: number;
    totalValidados: number;
  };
}

// Lê todos os jogos salvos (do mais recente ao mais antigo)
export function carregarJogosSalvos(): SavedGame[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Salva um lote de jogos novos (prepend — mais recentes primeiro)
export function salvarJogosGerados(jogos: SavedGame[]): void {
  try {
    const existentes = carregarJogosSalvos();
    const ids = new Set(existentes.map(j => String(j.id)));

    // Adiciona apenas jogos novos (sem duplicatas por ID)
    const novos = jogos.filter(j => !ids.has(String(j.id)));
    const merged = [...novos, ...existentes].slice(0, MAX_JOGOS);
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // localStorage cheio ou indisponível — ignora silenciosamente
  }
}

// Remove um jogo pelo ID
export function removerJogoSalvo(id: string | number): void {
  try {
    const lista = carregarJogosSalvos().filter(j => String(j.id) !== String(id));
    localStorage.setItem(KEY, JSON.stringify(lista));
  } catch {}
}

// Limpa todos os jogos salvos
export function limparJogosSalvos(): void {
  localStorage.removeItem(KEY);
}

// Converte um jogo gerado pelo Generator para o formato SavedGame
export function toSavedGame(game: {
  numbers: number[];
  strategy: string;
  confidence?: number;
  reasoning?: string;
  sharkScore?: number;
  sharkOrigem?: string;
  sharkContexto?: any;
  rawGame?: any;
}, lotteryId: string): SavedGame {
  const raw = game.rawGame || {};
  return {
    id:              raw.id ?? `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    lotteryId,
    selectedNumbers: game.numbers,
    strategy:        game.strategy,
    confidence:      game.confidence,
    reasoning:       game.reasoning ?? raw.reasoning,
    dataSource:      raw.dataSource,
    matches:         raw.matches ?? 0,
    prizeWon:        raw.prizeWon ?? "0",
    contestNumber:   raw.contestNumber ?? null,
    createdAt:       raw.createdAt ?? new Date().toISOString(),
    sharkScore:      game.sharkScore,
    sharkOrigem:     game.sharkOrigem,
    sharkContexto:   game.sharkContexto,
  };
}

// Estatísticas rápidas
export function estatisticasSalvos(): { total: number; porModalidade: Record<string, number> } {
  const jogos = carregarJogosSalvos();
  const porModalidade: Record<string, number> = {};
  for (const j of jogos) {
    porModalidade[j.lotteryId] = (porModalidade[j.lotteryId] || 0) + 1;
  }
  return { total: jogos.length, porModalidade };
}
