import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import CelebrationAnimation from "@/components/CelebrationAnimation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLotteryTypes } from "@/hooks/useLotteryData";
import { NumberBall } from "@/components/NumberBall";
import { jsPDF } from "jspdf";
import { 
  Trophy, 
  Medal,
  Award,
  BarChart3,
  Download,
  CheckCircle,
  XCircle,
  DollarSign,
  Search,
  Target,
  ShieldCheck,
} from "lucide-react";
import type { UserGame } from "@/types/lottery";

const DRAWS_CACHE_KEY = 'shark_official_draws_cache';

const PT_WORD_MAP: Record<string, number> = {
  'um':1,'uma':1,'dois':2,'duas':2,'três':3,'quatro':4,'cinco':5,'seis':6,'sete':7,
  'oito':8,'nove':9,'dez':10,'onze':11,'doze':12,'treze':13,'quatorze':14,'catorze':14,
  'quinze':15,'dezesseis':16,'dezasseis':16,'dezessete':17,'dezassete':17,'dezoito':18,
  'dezenove':19,'dezanove':19,'vinte':20,'trinta':30,'quarenta':40,'cinquenta':50,
  'sessenta':60,'setenta':70,'oitenta':80,
};
const TENS_VAL: Record<string,number> = {'vinte':20,'trinta':30,'quarenta':40,'cinquenta':50,'sessenta':60,'setenta':70,'oitenta':80};
const ONES_VAL: Record<string,number> = {'um':1,'uma':1,'dois':2,'duas':2,'três':3,'quatro':4,'cinco':5,'seis':6,'sete':7,'oito':8,'nove':9};

function extractNumbersFromSpeech(text: string): number[] {
  const found = new Set<number>();
  const lower = text.toLowerCase();

  // Compound: "vinte e dois" = 22
  Object.keys(TENS_VAL).forEach(ten => {
    Object.keys(ONES_VAL).forEach(one => {
      if (lower.includes(`${ten} e ${one}`)) {
        const n = TENS_VAL[ten] + ONES_VAL[one];
        if (n >= 1 && n <= 80) found.add(n);
      }
    });
  });

  // Simple word numbers
  Object.entries(PT_WORD_MAP).forEach(([word, val]) => {
    const re = new RegExp(`(?:^|\\s)${word}(?:\\s|$|[,;.])`, 'i');
    if (re.test(lower) && val >= 1 && val <= 80) found.add(val);
  });

  // Digit patterns (e.g. "05", "12", "3")
  const digitRe = /\b(0?[1-9]|[1-7]\d|80)\b/g;
  let m;
  while ((m = digitRe.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 80) found.add(n);
  }

  return Array.from(found).sort((a, b) => a - b);
}

function LiveSorteioCard({ userGames }: { userGames: any[] }) {
  const { data: lotteryTypes } = useLotteryTypes();

  const [selectedLotteryCheck, setSelectedLotteryCheck] = useState<string>("");
  const [lotteryDraws, setLotteryDraws] = useState<{
    lotteryId: string;
    displayName: string;
    contestNumber: number;
    drawDate: string | null;
    drawnNumbers: number[];
    gameMatches: { game: any; matches: number[] }[];
  }[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fromCache, setFromCache] = useState(false);

  // Carrega cache do localStorage ao montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAWS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLotteryDraws(parsed);
          setFromCache(true);
        }
      }
    } catch {
      // ignora erros de parse
    }
  }, []);

  const fetchOfficialResults = useCallback(async () => {
    setFetching(true);
    setFetchError('');
    try {
      const targetIds: string[] = selectedLotteryCheck && selectedLotteryCheck !== "all"
        ? [selectedLotteryCheck]
        : Array.from(new Set(userGames.map(g => g.lotteryId)));

      if (targetIds.length === 0) {
        setFetchError('Nenhum jogo salvo para conferir.');
        setLotteryDraws([]);
        return;
      }

      const results = await Promise.all(
        targetIds.map(async (id) => {
          try {
            const r = await fetch(`/api/lotteries/${id}/latest`);
            if (!r.ok) return null;
            const data = await r.json();
            const drawn: number[] = data.drawnNumbers || [];
            const games = userGames.filter(g => g.lotteryId === id);
            const gameMatches = games
              .map((game: any) => ({
                game,
                matches: (game.selectedNumbers as number[]).filter(n => drawn.includes(n)),
              }))
              .sort((a, b) => b.matches.length - a.matches.length);
            return {
              lotteryId: data.lotteryId,
              displayName: data.displayName,
              contestNumber: data.contestNumber,
              drawDate: data.drawDate,
              drawnNumbers: drawn,
              gameMatches,
            };
          } catch {
            return null;
          }
        })
      );

      const ok = results.filter(Boolean) as any[];
      setLotteryDraws(ok);
      setFromCache(false);
      if (ok.length > 0) {
        try {
          localStorage.setItem(DRAWS_CACHE_KEY, JSON.stringify(ok));
        } catch {
          // ignora erros de storage
        }
      }
      if (ok.length === 0) setFetchError('Não foi possível obter os resultados oficiais agora. Tente novamente em instantes.');
    } finally {
      setFetching(false);
    }
  }, [selectedLotteryCheck, userGames]);

  const clearAll = () => {
    setLotteryDraws([]);
    setFetchError('');
    setFromCache(false);
    try {
      localStorage.removeItem(DRAWS_CACHE_KEY);
    } catch {
      // ignora
    }
  };

  const getLotteryName = (lotteryId: string) =>
    (lotteryTypes as any[])?.find(l => l.id === lotteryId)?.displayName || lotteryId;

  return (
    <Card className="bg-black/20 border border-primary/30 mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-primary flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5" />
          Conferência Oficial — Resultados da Caixa
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-normal text-primary/70">CAIXA</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Conferência via resultado oficial da Caixa */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-primary">Buscar resultado oficial</p>
            </div>
            {(lotteryDraws.length > 0 || fetchError) && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground text-xs h-7 px-2">
                Limpar
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Após o sorteio, clique em <span className="text-primary font-semibold">Buscar Resultado Oficial</span> para puxar as dezenas direto da Caixa e conferir automaticamente seus jogos. Mostra quantas dezenas foram acertadas em cada modalidade.
          </p>

          {/* Filtro de modalidade + botão buscar */}
          <div className="flex gap-2 items-center">
            <Select value={selectedLotteryCheck} onValueChange={setSelectedLotteryCheck}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Todas as modalidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as modalidades</SelectItem>
                {(lotteryTypes as any[])?.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={fetchOfficialResults}
              disabled={fetching}
              className="shrink-0 gap-2 font-semibold bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary"
            >
              <Search className="h-4 w-4" />
              {fetching ? 'Buscando...' : 'Buscar Resultado Oficial'}
            </Button>
          </div>

          {fetchError && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2">{fetchError}</p>
          )}

          {fromCache && lotteryDraws.length > 0 && (
            <p className="text-xs text-yellow-400/70 bg-yellow-500/10 rounded-lg p-2 flex items-center gap-1.5">
              <span>⚡</span>
              Exibindo resultado salvo anteriormente. Clique em "Buscar Resultado Oficial" para atualizar.
            </p>
          )}

          {/* Resultados por modalidade */}
          {lotteryDraws.length > 0 && (
            <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
              {lotteryDraws.map((d) => {
                const totalMatches = d.gameMatches.reduce((s, g) => s + g.matches.length, 0);
                const bestMatch = d.gameMatches.reduce((m, g) => Math.max(m, g.matches.length), 0);
                return (
                  <div key={d.lotteryId} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{d.displayName}</Badge>
                        <span className="text-xs text-muted-foreground">Concurso {d.contestNumber}</span>
                      </div>
                      <span className={`text-xs font-bold ${bestMatch >= 4 ? 'text-green-400' : bestMatch >= 2 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                        {d.gameMatches.length} jogo(s) • melhor: {bestMatch} acerto(s) • total: {totalMatches}
                      </span>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Dezenas sorteadas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {d.drawnNumbers.map(n => (
                          <NumberBall key={n} number={n} size="xs" />
                        ))}
                      </div>
                    </div>

                    {d.gameMatches.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Nenhum jogo salvo nesta modalidade.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {d.gameMatches.map((res, i) => (
                          <div key={i} className={`rounded-lg p-2.5 border text-xs flex items-start gap-2 ${
                            res.matches.length >= 4 ? 'bg-green-500/10 border-green-500/30'
                            : res.matches.length >= 2 ? 'bg-yellow-500/10 border-yellow-500/30'
                            : 'bg-white/5 border-white/10 opacity-70'
                          }`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                <span className={`font-bold text-xs ${
                                  res.matches.length >= 4 ? 'text-green-400'
                                  : res.matches.length >= 2 ? 'text-yellow-400'
                                  : 'text-muted-foreground'
                                }`}>
                                  {res.matches.length} acerto{res.matches.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {(res.game.selectedNumbers as number[]).map((n: number) => (
                                  <NumberBall
                                    key={n}
                                    number={n}
                                    size="xs"
                                    dimmed={!res.matches.includes(n)}
                                    selected={res.matches.includes(n)}
                                  />
                                ))}
                              </div>
                            </div>
                            {res.matches.length >= 2
                              ? <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                              : <XCircle className="h-4 w-4 text-white/20 shrink-0 mt-0.5" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Results() {
  const queryClient = useQueryClient();
  const [filterLottery, setFilterLottery] = useState<string>('all');
  const [searchContest, setSearchContest] = useState<string>('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationPrize, setCelebrationPrize] = useState<string>();
  const [filterDate, setFilterDate] = useState<string>('');
  const [clearingGames, setClearingGames] = useState(false);

  const handleClearAllGames = async () => {
    if (!window.confirm('Tem certeza que deseja remover todos os jogos salvos? Esta ação não pode ser desfeita.')) return;
    setClearingGames(true);
    try {
      const r = await fetch('/api/games', { method: 'DELETE' });
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/games'] });
        queryClient.invalidateQueries({ queryKey: ['/api/users/stats'] });
      }
    } finally {
      setClearingGames(false);
    }
  };

  const { data: lotteryTypes } = useLotteryTypes();

  const { data: userStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/users/stats"],
    queryFn: async () => {
      const response = await fetch('/api/users/stats');
      if (!response.ok) throw new Error('Failed to fetch user stats');
      return response.json();
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: userGames, isLoading: gamesLoading } = useQuery({
    queryKey: ["/api/games"],
    queryFn: async () => {
      const response = await fetch('/api/games?limit=100');
      if (!response.ok) throw new Error('Falha ao buscar jogos');
      return response.json();
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const gamesList: any[] = (userGames as any[]) || [];

  const filteredGames = gamesList.filter((game: any) => {
    if (filterLottery !== 'all' && game.lotteryId !== filterLottery) return false;
    if (searchContest && !game.contestNumber?.toString().includes(searchContest)) return false;
    if (filterDate) {
      const gameDate = new Date(game.createdAt).toLocaleDateString('pt-BR');
      const filterDateBR = new Date(filterDate + 'T00:00:00').toLocaleDateString('pt-BR');
      if (gameDate !== filterDateBR) return false;
    }
    return true;
  });

  const getLotteryName = (lotteryId: string) =>
    (lotteryTypes as any[])?.find(l => l.id === lotteryId)?.displayName || lotteryId;

  const getMatchesColor = (matches: number, prizeWon: string) => {
    const prize = parseFloat(prizeWon || "0");
    if (prize > 1000) return "text-neon-gold";
    if (prize > 100) return "text-neon-green";
    if (prize > 0) return "text-accent";
    return "text-muted-foreground";
  };

  const totalPrizeWon = filteredGames.reduce((sum, game) => sum + parseFloat(game.prizeWon || "0"), 0);

  const exportToPDF = async () => {
    try {
      const doc = new jsPDF({ format: 'a4', unit: 'mm' });
      const pageWidth = doc.internal.pageSize.getWidth();   // 210mm
      const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
      const marginX = 12;
      const marginTop = 12;
      const marginBottom = 15;
      const contentWidth = pageWidth - marginX * 2;

      const imgRes = await fetch('/folha-pdf.png');
      const imgBlob = await imgRes.blob();
      const imgBase64: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(imgBlob);
      });

      const addBackground = () => {
        doc.addImage(imgBase64, 'PNG', 0, 0, pageWidth, pageHeight);
        // Overlay escuro semitransparente para realçar as fontes brancas
        const anyDoc = doc as any;
        if (typeof anyDoc.setGState === 'function' && typeof anyDoc.GState === 'function') {
          const gs = new anyDoc.GState({ opacity: 0.55 });
          anyDoc.setGState(gs);
          doc.setFillColor(0, 0, 0);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          const gs2 = new anyDoc.GState({ opacity: 1 });
          anyDoc.setGState(gs2);
        }
      };

      const ensureSpace = (needed: number, currentY: number): number => {
        if (currentY + needed > pageHeight - marginBottom) {
          doc.addPage();
          addBackground();
          return marginTop + 6;
        }
        return currentY;
      };

      const writeWrapped = (text: string, x: number, y: number, maxW: number, lineH: number): number => {
        const lines = doc.splitTextToSize(text, maxW) as string[];
        for (const ln of lines) {
          y = ensureSpace(lineH, y);
          doc.text(ln, x, y);
          y += lineH;
        }
        return y;
      };

      addBackground();

      // Cabeçalho
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text("Shark Loterias - Relatório de Resultados", pageWidth / 2, marginTop + 4, { align: "center", maxWidth: contentWidth });

      doc.setFontSize(9);
      doc.setTextColor(230, 255, 230);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageWidth / 2, marginTop + 11, { align: "center" });

      // Resumo
      let yPos = marginTop + 22;
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text("Resumo Geral", marginX, yPos);
      yPos += 2;
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.3);
      doc.line(marginX, yPos, pageWidth - marginX, yPos);
      yPos += 6;

      doc.setFontSize(10);
      doc.text(`Total de Jogos: ${userStats?.totalGames || 0}`, marginX, yPos); yPos += 5;
      doc.text(`Jogos Premiados: ${userStats?.wins || 0}`, marginX, yPos); yPos += 5;
      doc.text(`Total Acumulado: R$ ${totalPrizeWon.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, marginX, yPos); yPos += 4;

      doc.setLineWidth(0.2);
      doc.line(marginX, yPos, pageWidth - marginX, yPos);
      yPos += 6;

      // Lista de jogos
      filteredGames.forEach((game: any, index: number) => {
        // Bloco precisa de ~26mm
        yPos = ensureSpace(26, yPos);

        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        const titulo = `${index + 1}. ${getLotteryName(game.lotteryId)} - Concurso #${game.contestNumber}`;
        yPos = writeWrapped(titulo, marginX, yPos, contentWidth, 5);

        doc.setFontSize(9);
        doc.setTextColor(230, 255, 230);
        yPos = writeWrapped(`Números: ${game.selectedNumbers.join(", ")}`, marginX + 2, yPos, contentWidth - 2, 4.5);
        yPos = writeWrapped(`Acertos: ${game.matches} | Prêmio: R$ ${parseFloat(game.prizeWon || "0").toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, marginX + 2, yPos, contentWidth - 2, 4.5);
        yPos = writeWrapped(`Data: ${new Date(game.createdAt).toLocaleDateString('pt-BR')} | Estratégia: ${game.strategy}`, marginX + 2, yPos, contentWidth - 2, 4.5);

        yPos += 1.5;
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.1);
        doc.line(marginX, yPos, pageWidth - marginX, yPos);
        yPos += 4;
      });

      doc.save("Shark_Loterias_Relatorio.pdf");
    } catch (error) {
      alert("Erro ao gerar PDF.");
    }
  };

  return (
    <div className="min-h-screen text-foreground pb-28" style={{ background: "#0B0F19" }}>
      <Navigation />
      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest uppercase text-primary/70">Painel de Resultados</span>
            </div>
            <h1 className="text-[22px] font-bold leading-tight text-white">Resultados</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">Acertos, conferências e histórico completo</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={exportToPDF}
              className="flex items-center gap-1.5 text-[12px] font-semibold px-3 h-8 rounded-xl border border-primary/40 text-primary hover:bg-primary/10 transition-all"
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </button>
            <button
              onClick={handleClearAllGames}
              disabled={clearingGames || gamesList.length === 0}
              className="flex items-center gap-1.5 text-[12px] font-semibold px-3 h-8 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <XCircle className="h-3.5 w-3.5" />
              {clearingGames ? 'Limpando…' : 'Limpar'}
            </button>
          </div>
        </div>

        {/* ── Stats strip ───────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Jogos",   val: userStats?.totalGames ?? 0,                                                           icon: Trophy,    accent: "text-primary",    ring: "border-primary/25" },
            { label: "Ganhos",  val: userStats?.wins ?? 0,                                                                 icon: Medal,     accent: "text-emerald-400", ring: "border-emerald-500/25" },
            { label: "Acerto",  val: `${userStats?.accuracy || 0}%`,                                                       icon: BarChart3, accent: "text-sky-400",     ring: "border-sky-500/25" },
            { label: "Prêmios", val: `R$\u00a0${totalPrizeWon.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign,accent: "text-yellow-400",  ring: "border-yellow-500/25" },
          ].map((s, i) => (
            <div key={i} className={`rounded-2xl border ${s.ring} p-2.5 flex flex-col items-center gap-1`} style={{ background: "#121826" }}>
              <s.icon className={`h-4 w-4 ${s.accent}`} />
              <span className={`text-[13px] font-black tabular-nums leading-none ${s.accent}`}>
                {statsLoading ? "–" : s.val}
              </span>
              <span className="text-[10px] text-muted-foreground leading-none">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── Conferência oficial ───────────────────────────── */}
        <LiveSorteioCard userGames={gamesList} />

        {/* ── Filters ───────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/10 p-3 space-y-2" style={{ background: "#121826" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Filtrar histórico</p>
          <div className="grid grid-cols-2 gap-2">
            <Select value={filterLottery} onValueChange={setFilterLottery}>
              <SelectTrigger className="h-9 text-[13px] rounded-xl" style={{ background: "#0B0F19", border: "1px solid rgba(255,255,255,0.1)" }}>
                <SelectValue placeholder="Modalidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {(lotteryTypes as any[])?.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              placeholder="Concurso…"
              value={searchContest}
              onChange={e => setSearchContest(e.target.value)}
              className="h-9 text-[13px] rounded-xl"
              style={{ background: "#0B0F19", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>
          <Input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="h-9 text-[13px] rounded-xl w-full"
            style={{ background: "#0B0F19", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <p className="text-[11px] text-muted-foreground/70">
            {filteredGames.length} de {gamesList.length} jogo(s)
          </p>
        </div>

        {/* ── Games list ────────────────────────────────────── */}
        <div className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-white px-0.5">Histórico de Jogos</h2>

          {gamesLoading ? (
            <div className="rounded-2xl border border-white/10 p-8 text-center text-sm text-muted-foreground animate-pulse" style={{ background: "#121826" }}>
              Carregando jogos…
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="rounded-2xl border border-white/10 p-10 text-center" style={{ background: "#121826" }}>
              <Trophy className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-[14px] text-muted-foreground">Nenhum jogo encontrado</p>
              <p className="text-[12px] text-muted-foreground/60 mt-1">Ajuste os filtros ou gere novos jogos</p>
            </div>
          ) : (
            filteredGames.map((game: any) => {
              const prize = parseFloat(game.prizeWon || "0");
              const isWinner = prize > 0;
              const isPending = game.status === "aguardando_sorteio" || game.status === "pending";
              return (
                <div
                  key={game.id}
                  className={`rounded-2xl border p-3.5 space-y-2.5 transition-all ${
                    isWinner   ? "border-yellow-500/40 bg-yellow-500/5" :
                    isPending  ? "border-white/10" :
                    "border-white/8"
                  }`}
                  style={!isWinner ? { background: "#121826" } : undefined}
                >
                  {/* top row */}
                  <div className="flex items-center justify-between flex-wrap gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[12px] font-bold text-foreground/90">{getLotteryName(game.lotteryId)}</span>
                      <span className="text-[11px] text-muted-foreground">#{game.contestNumber}</span>
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                          Aguardando
                        </span>
                      ) : game.status === "conferido" ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Conferido</span>
                      ) : game.status === "sorteado" ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">Sorteado</span>
                      ) : null}
                    </div>
                    <span className={`text-[13px] font-black tabular-nums ${isWinner ? "text-yellow-400" : "text-muted-foreground/50"}`}>
                      R$ {prize.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* numbers */}
                  <div className="flex flex-wrap gap-1">
                    {game.selectedNumbers.map((num: number) => (
                      <NumberBall key={num} number={num} size="xs" />
                    ))}
                  </div>

                  {/* pending notice */}
                  {isPending && (
                    <p className="text-[11px] text-yellow-400/70 bg-yellow-500/8 rounded-xl px-2.5 py-1.5">
                      Concurso <strong className="text-yellow-300">#{game.contestNumber}</strong> — conferência após o sorteio oficial.
                    </p>
                  )}

                  {/* date + strategy footer */}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50 pt-0.5 border-t border-white/5">
                    <span>{new Date(game.createdAt).toLocaleDateString('pt-BR')}</span>
                    {game.strategy && <span className="capitalize">{game.strategy}</span>}
                    {game.hits != null && game.hits > 0 && (
                      <span className="text-emerald-400/70 font-semibold ml-auto">{game.hits} acerto{game.hits !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
      <CelebrationAnimation isVisible={showCelebration} prizeAmount={celebrationPrize} onComplete={() => setShowCelebration(false)} />
    </div>
  );
}
