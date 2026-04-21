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
import { jsPDF } from "jspdf";
import { 
  Trophy, 
  Medal,
  Award,
  BarChart3,
  Download,
  Tv2,
  ExternalLink,
  CheckCircle,
  XCircle,
  DollarSign,
  Search,
  Target,
  Mic,
  MicOff,
  Radio,
} from "lucide-react";
import type { UserGame } from "@/types/lottery";

const CANAL_CAIXA_URL = "https://www.youtube.com/@canalcaixa/live";
const CANAL_CAIXA_CHANNEL_ID = "UCvqoM_rM5ZNRW0V2TjNLk8A";

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

  const { data: liveData } = useQuery<{ videoId: string; embedUrl: string }>({
    queryKey: ["/api/youtube/live"],
    queryFn: async () => {
      const res = await fetch("/api/youtube/live");
      if (!res.ok) throw new Error("live unavailable");
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const [selectedLotteryCheck, setSelectedLotteryCheck] = useState<string>("");
  const [checkResults, setCheckResults] = useState<{ game: any; matches: number[] }[]>([]);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [micError, setMicError] = useState('');
  const recognitionRef = useRef<any>(null);

  const runCheck = useCallback((drawn: number[], games: any[]) => {
    if (drawn.length === 0) { setCheckResults([]); return; }
    const gamesToCheck = selectedLotteryCheck && selectedLotteryCheck !== "all"
      ? games.filter(g => g.lotteryId === selectedLotteryCheck)
      : games;
    const results = gamesToCheck.map((game: any) => ({
      game,
      matches: (game.selectedNumbers as number[]).filter(n => drawn.includes(n)),
    }));
    results.sort((a, b) => b.matches.length - a.matches.length);
    setCheckResults(results);
  }, [selectedLotteryCheck]);

  useEffect(() => {
    runCheck(drawnNumbers, userGames);
  }, [drawnNumbers, selectedLotteryCheck, userGames, runCheck]);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMicError('Reconhecimento de voz não suportado neste navegador. Use Chrome ou Samsung Internet.');
      return;
    }
    setMicError('');
    const recognition = new SR();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let full = '';
      for (let i = 0; i < event.results.length; i++) {
        full += event.results[i][0].transcript + ' ';
      }
      setTranscript(full.trim());
      const nums = extractNumbersFromSpeech(full);
      setDrawnNumbers(nums);
    };
    recognition.onerror = (e: any) => {
      if (e.error !== 'aborted') setMicError(`Erro: ${e.error}`);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      startListening();
    }
  };

  // Auto-ativa o microfone ao abrir a página
  useEffect(() => {
    const timer = setTimeout(() => startListening(), 800);
    return () => {
      clearTimeout(timer);
      recognitionRef.current?.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAll = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setDrawnNumbers([]);
    setTranscript('');
    setCheckResults([]);
    setMicError('');
  };

  const getLotteryName = (lotteryId: string) =>
    (lotteryTypes as any[])?.find(l => l.id === lotteryId)?.displayName || lotteryId;

  return (
    <Card className="bg-black/20 border border-red-500/40 mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-red-400 flex items-center gap-2 text-base">
          <Tv2 className="h-5 w-5" />
          Sorteio ao Vivo — Canal Oficial Caixa
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-normal text-red-400">AO VIVO</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Vídeo embed automático — Canal Caixa ao vivo */}
        <div className="w-full rounded-xl overflow-hidden border border-red-500/20 bg-black" style={{ aspectRatio: '16/9' }}>
          <iframe
            className="w-full h-full"
            style={{ minHeight: 200 }}
            src={liveData?.embedUrl ?? "https://www.youtube.com/embed/live_stream?channel=UC_unXshByY_Tf0XG_SgD8fA&autoplay=1"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            title="Sorteio ao Vivo — Canal Caixa"
          />
        </div>

        {/* Botão para abrir no YouTube caso o embed não carregue */}
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.open(CANAL_CAIXA_URL, '_blank')}
            className="text-red-400 hover:text-red-300 gap-1.5 text-xs"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir canal no YouTube
          </Button>
        </div>

        {/* Conferência automática por áudio */}
        <div className="border-t border-white/10 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-primary">Conferência Automática por Áudio</p>
            </div>
            {(drawnNumbers.length > 0 || transcript) && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground text-xs h-7 px-2">
                Limpar
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Ative o microfone e aponte para o áudio do sorteio. As dezenas pronunciadas são capturadas e conferidas automaticamente contra seus jogos salvos, em qualquer modalidade.
          </p>

          {/* Filtro de modalidade + botão mic */}
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
              onClick={toggleListening}
              className={`shrink-0 gap-2 font-semibold transition-all ${
                isListening
                  ? 'bg-red-600 hover:bg-red-700 text-white border-red-500 animate-pulse'
                  : 'bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary'
              }`}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {isListening ? 'Parar' : 'Ativar Mic'}
            </Button>
          </div>

          {micError && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2">{micError}</p>
          )}

          {/* Dezenas detectadas */}
          {drawnNumbers.length > 0 && (
            <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">
                {drawnNumbers.length} dezena{drawnNumbers.length !== 1 ? 's' : ''} detectada{drawnNumbers.length !== 1 ? 's' : ''}
                {isListening && <span className="ml-2 text-green-400 animate-pulse">● ouvindo...</span>}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {drawnNumbers.map(n => (
                  <span key={n} className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-black text-xs font-black">
                    {n.toString().padStart(2, '0')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Status escutando sem números ainda */}
          {isListening && drawnNumbers.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-green-400 animate-pulse">
              <Mic className="h-3.5 w-3.5" />
              Ouvindo... aguardando dezenas pronunciadas
            </div>
          )}

          {/* Resultados automáticos */}
          {checkResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {checkResults.filter(r => r.matches.length > 0).length} jogo(s) com acerto(s) de {checkResults.length} conferidos
              </p>
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {checkResults.map((res, i) => (
                  <div key={i} className={`rounded-lg p-2.5 border text-xs flex items-start gap-2 ${
                    res.matches.length >= 4 ? 'bg-green-500/10 border-green-500/30'
                    : res.matches.length >= 2 ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-white/5 border-white/10 opacity-50'
                  }`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-xs py-0 px-1.5">{getLotteryName(res.game.lotteryId)}</Badge>
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
                          <span key={n} className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold leading-none ${
                            res.matches.includes(n) ? 'bg-green-500 text-white' : 'bg-white/10 text-white/50'
                          }`}>
                            {n.toString().padStart(2, '0')}
                          </span>
                        ))}
                      </div>
                    </div>
                    {res.matches.length >= 2
                      ? <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                      : <XCircle className="h-4 w-4 text-white/20 shrink-0 mt-0.5" />}
                  </div>
                ))}
              </div>
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
      const doc = new jsPDF({ format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const imgRes = await fetch('/folha-pdf.png');
      const imgBlob = await imgRes.blob();
      const imgBase64: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(imgBlob);
      });

      const addBackground = () => {
        doc.addImage(imgBase64, 'PNG', 0, 0, pageWidth, pageHeight);
      };

      addBackground();

      doc.setFontSize(44);
      doc.setTextColor(255, 255, 255);
      doc.text("Shark Loterias - Relatório de Resultados", pageWidth / 2, 25, { align: "center" });

      doc.setFontSize(20);
      doc.setTextColor(230, 255, 230);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageWidth / 2, 42, { align: "center" });

      doc.setFontSize(28);
      doc.setTextColor(255, 255, 255);
      doc.text("Resumo Geral", 20, 62);

      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.3);
      doc.line(20, 67, pageWidth - 20, 67);

      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text(`Total de Jogos: ${userStats?.totalGames || 0}`, 20, 80);
      doc.text(`Jogos Premiados: ${userStats?.wins || 0}`, 20, 94);
      doc.text(`Total Acumulado: R$ ${totalPrizeWon.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, 108);

      doc.line(20, 114, pageWidth - 20, 114);

      let yPos = 130;
      filteredGames.forEach((game: any, index: number) => {
        if (yPos > pageHeight - 80) {
          doc.addPage();
          addBackground();
          yPos = 25;
        }

        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text(`${index + 1}. ${getLotteryName(game.lotteryId)} - Concurso #${game.contestNumber}`, 20, yPos);

        doc.setFontSize(18);
        doc.setTextColor(230, 255, 230);
        doc.text(`Números: ${game.selectedNumbers.join(", ")}`, 22, yPos + 14);
        doc.text(`Acertos: ${game.matches} | Prêmio: R$ ${parseFloat(game.prizeWon || "0").toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 22, yPos + 28);
        doc.text(`Data: ${new Date(game.createdAt).toLocaleDateString('pt-BR')} | Estratégia: ${game.strategy}`, 22, yPos + 42);

        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.1);
        doc.line(20, yPos + 50, pageWidth - 20, yPos + 50);

        yPos += 64;
      });

      doc.save("Shark_Loterias_Relatorio.pdf");
    } catch (error) {
      alert("Erro ao gerar PDF.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="container mx-auto px-3 sm:px-4 py-6">
        <div className="text-center mb-5">
          <h2 className="text-xl sm:text-2xl font-bold neon-text text-primary mb-1">Resultados 📊</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Confira seus acertos, transmissão ao vivo e prêmios</p>
          <div className="flex justify-center mt-3 gap-2 flex-wrap">
            <Button onClick={exportToPDF} className="bg-primary hover:bg-primary/80 text-black flex items-center gap-2 text-xs sm:text-sm">
              <Download className="h-4 w-4" /> Exportar PDF
            </Button>
            <Button
              variant="outline"
              onClick={handleClearAllGames}
              disabled={clearingGames || gamesList.length === 0}
              className="border-red-500/50 text-red-400 hover:bg-red-500/10 flex items-center gap-2 text-xs sm:text-sm"
            >
              <XCircle className="h-4 w-4" />
              {clearingGames ? 'Removendo...' : 'Limpar Jogos'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5">
          {[
            { label: "Total de Jogos", val: userStats?.totalGames ?? 0, icon: Trophy, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
            { label: "Premiados", val: userStats?.wins ?? 0, icon: Medal, color: "text-neon-green", bg: "bg-green-500/10", border: "border-green-500/20" },
            { label: "Taxa de Acerto", val: `${userStats?.accuracy || 0}%`, icon: BarChart3, color: "text-accent", bg: "bg-accent/10", border: "border-accent/20" },
            { label: "Total Ganho", val: `R$ ${totalPrizeWon.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" }
          ].map((stat, i) => (
            <Card key={i} className={`bg-black/20 border ${stat.border}`}>
              <CardContent className="p-2 sm:p-3 flex flex-col items-center text-center">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 ${stat.bg} rounded-lg flex items-center justify-center mb-1.5`}>
                  <stat.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${stat.color}`} />
                </div>
                <div className={`text-base sm:text-lg font-bold ${stat.color} neon-text leading-tight`}>
                  {statsLoading ? "–" : stat.val}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <LiveSorteioCard userGames={gamesList} />

        <Card className="bg-black/20 mb-4 p-3">
          <div className="grid grid-cols-1 gap-2">
            <Select value={filterLottery} onValueChange={setFilterLottery}>
              <SelectTrigger><SelectValue placeholder="Modalidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {(lotteryTypes as any[])?.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Buscar concurso..." value={searchContest} onChange={e => setSearchContest(e.target.value)} />
            <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Mostrando {filteredGames.length} de {gamesList.length} jogos
          </div>
        </Card>

        <Card className="bg-black/20 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-primary text-base">Histórico de Jogos</CardTitle>
          </CardHeader>
          <CardContent>
            {gamesLoading ? (
              <div className="animate-pulse text-sm text-muted-foreground py-4 text-center">Carregando...</div>
            ) : (
              <div className="space-y-3">
                {filteredGames.length > 0 ? filteredGames.map((game: any, index: number) => (
                  <Card key={game.id} className="bg-black/20 border-border/50">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-center mb-2 flex-wrap gap-1">
                        <div className="flex gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-xs">{getLotteryName(game.lotteryId)}</Badge>
                          <Badge variant="outline" className="text-xs">#{game.contestNumber}</Badge>
                        </div>
                        <div className={`text-sm font-bold ${getMatchesColor(game.matches, game.prizeWon)}`}>
                          R$ {parseFloat(game.prizeWon || "0").toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {game.selectedNumbers.map((num: number) => (
                          <span key={num} className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-xs font-bold text-white">
                            {num.toString().padStart(2, '0')}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )) : (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    Nenhum jogo encontrado com os filtros aplicados.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <CelebrationAnimation isVisible={showCelebration} prizeAmount={celebrationPrize} onComplete={() => setShowCelebration(false)} />
    </div>
  );
}
