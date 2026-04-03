import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import CelebrationAnimation from "@/components/CelebrationAnimation";
import LiveEmbed from "@/components/LiveEmbed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLotteryTypes } from "@/hooks/useLotteryData";
import { jsPDF } from "jspdf";
import logoPng from "@assets/Logo_Futurista_da_Shark_Loterias_1757013773517-B635QT2F_1767439134606.png";
import { 
  Trophy, 
  TrendingUp, 
  Calendar, 
  DollarSign,
  Target,
  Filter,
  Search,
  Medal,
  Award,
  Sparkles,
  BarChart3,
  Download,
  Clock
} from "lucide-react";
import type { UserGame } from "@/types/lottery";

export default function Results() {
  const [filterLottery, setFilterLottery] = useState<string>('all');
  const [searchContest, setSearchContest] = useState<string>('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationPrize, setCelebrationPrize] = useState<string>();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterTime, setFilterTime] = useState<string>('');

  const { data: lotteryTypes } = useLotteryTypes();

  const { data: userStats, isLoading: statsLoading } = useQuery({
    queryKey: ['user-stats'],
    queryFn: async () => {
      const response = await fetch('/api/users/stats');
      if (!response.ok) throw new Error('Failed to fetch user stats');
      return response.json();
    },
    refetchInterval: 60000,
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: userGames, isLoading: gamesLoading } = useQuery({
    queryKey: ["/api/games?limit=50"],
    staleTime: 2 * 60 * 1000,
    refetchInterval: 30000,
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
    if (filterMonth) {
      const gameMonth = new Date(game.createdAt).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
      if (gameMonth !== filterMonth) return false;
    }
    if (filterYear) {
      const gameYear = new Date(game.createdAt).getFullYear().toString();
      if (gameYear !== filterYear) return false;
    }
    if (filterTime) {
      const gameTime = new Date(game.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (gameTime !== filterTime) return false;
    }
    return true;
  });

  const getLotteryName = (lotteryId: string) => {
    return (lotteryTypes as any[])?.find(l => l.id === lotteryId)?.displayName || lotteryId;
  };

  const getPrizeTier = (lotteryId: string, matches: number) => {
    const tiers: Record<string, Record<number, string>> = {
      megasena: { 6: 'Sena', 5: 'Quina', 4: 'Quadra' },
      lotofacil: { 15: '15 acertos', 14: '14 acertos', 13: '13 acertos', 12: '12 acertos', 11: '11 acertos' },
      quina: { 5: 'Quina', 4: 'Quadra', 3: 'Terno', 2: 'Duque' },
    };
    return tiers[lotteryId]?.[matches] || `${matches} acertos`;
  };

  const getMatchesColor = (matches: number, prizeWon: string) => {
    const prize = parseFloat(prizeWon || "0");
    if (prize > 1000) return "text-neon-gold";
    if (prize > 100) return "text-neon-green";
    if (prize > 0) return "text-accent";
    return "text-muted-foreground";
  };

  const totalPrizeWon = filteredGames.reduce((sum, game) => sum + parseFloat(game.prizeWon || "0"), 0);
  const winningGames = filteredGames.filter(game => parseFloat(game.prizeWon || "0") > 0);
  const bestResult = winningGames.reduce((best, game) => {
    const prize = parseFloat(game.prizeWon || "0");
    const bestPrize = parseFloat(best?.prizeWon || "0");
    return prize > bestPrize ? game : best;
  }, null as UserGame | null);

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Logo Watermark - Background
      try {
        const imgWidth = 120;
        const imgHeight = 120;
        const docAny = doc as any;
        
        // Ativar transparência se suportado
        if (docAny.saveGraphicsState && docAny.setGState) {
          docAny.saveGraphicsState();
          const GState = (jsPDF as any).GState || docAny.GState;
          if (GState) {
            docAny.setGState(new GState({ opacity: 0.25 }));
          }
          doc.addImage(
            logoPng, 
            "PNG", 
            (pageWidth - imgWidth) / 2, 
            (pageHeight - imgHeight) / 2, 
            imgWidth, 
            imgHeight, 
            undefined, 
            'FAST'
          );
          docAny.restoreGraphicsState();
        } else {
          // Fallback: Logo bem clara no fundo (se não suportar GState, a imagem original será usada)
          doc.addImage(logoPng, "PNG", (pageWidth - imgWidth) / 2, (pageHeight - imgHeight) / 2, imgWidth, imgHeight, undefined, 'FAST');
        }
      } catch (e) {
        console.error("Logo error:", e);
      }

      doc.setFontSize(22);
      doc.setTextColor(0, 150, 255);
      doc.text("Shark Loterias - Relatorio de Resultados", pageWidth / 2, 20, { align: "center" });

      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageWidth / 2, 28, { align: "center" });

      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("Resumo Geral", 20, 45);
      
      doc.setFontSize(11);
      doc.text(`Total de Jogos: ${userStats?.totalGames || 0}`, 20, 55);
      doc.text(`Jogos Premiados: ${userStats?.wins || 0}`, 20, 62);
      doc.text(`Total Acumulado: R$ ${totalPrizeWon.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, 69);

      let yPos = 85;
      filteredGames.forEach((game: any, index: number) => {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(`${index + 1}. ${getLotteryName(game.lotteryId)} - Concurso #${game.contestNumber}`, 20, yPos);
        
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(`Números: ${game.selectedNumbers.join(", ")}`, 20, yPos + 7);
        doc.text(`Acertos: ${game.matches} | Prêmio: R$ ${parseFloat(game.prizeWon || "0").toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, yPos + 14);
        doc.text(`Data: ${new Date(game.createdAt).toLocaleDateString('pt-BR')} | Estratégia: ${game.strategy}`, 20, yPos + 21);
        
        yPos += 35;
      });

      doc.save("Shark_Loterias_Relatorio.pdf");
    } catch (error) {
      console.error("PDF Export failed:", error);
      alert("Erro ao gerar PDF. Verifique se há jogos para exportar.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold neon-text text-primary mb-2">Resultados 📊</h2>
            <p className="text-muted-foreground">Confira seus acertos e prêmios</p>
          </div>
          <Button onClick={exportToPDF} className="bg-primary hover:bg-primary/80 text-white flex items-center gap-2">
            <Download className="h-4 w-4" /> Exportar PDF
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Jogos", val: userStats?.totalGames, icon: Trophy, color: "text-primary" },
            { label: "Prêmios", val: userStats?.wins, icon: Medal, color: "text-neon-green" },
            { label: "Taxa", val: `${userStats?.accuracy || 0}%`, icon: BarChart3, color: "text-accent" },
            { label: "Total", val: `R$ ${totalPrizeWon.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-neon-gold" }
          ].map((stat, i) => (
            <Card key={i} className="bg-black/20">
              <CardContent className="p-4 text-center">
                <stat.icon className={`h-8 w-8 mx-auto mb-2 ${stat.color}`} />
                <div className={`text-2xl font-bold ${stat.color} neon-text`}>{statsLoading ? "..." : stat.val}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-black/20 mb-6 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <Select value={filterLottery} onValueChange={setFilterLottery}>
              <SelectTrigger><SelectValue placeholder="Modalidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {lotteryTypes?.map(l => <SelectItem key={l.id} value={l.id}>{l.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Concurso..." value={searchContest} onChange={e => setSearchContest(e.target.value)} />
            <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Mostrando {filteredGames.length} de {gamesList.length} jogos
          </div>
        </Card>

        <Card className="bg-black/20 backdrop-blur-sm">
          <CardHeader><CardTitle className="text-primary">Histórico de Jogos</CardTitle></CardHeader>
          <CardContent>
            {gamesLoading ? <div className="animate-pulse">Carregando...</div> : (
              <div className="space-y-4">
                {filteredGames.length > 0 ? filteredGames.map((game: any, index: number) => (
                  <Card key={game.id} className="bg-black/20 border-border/50">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex gap-2">
                          <Badge variant="secondary">{getLotteryName(game.lotteryId)}</Badge>
                          <Badge variant="outline">#{game.contestNumber}</Badge>
                        </div>
                        <div className={`font-bold ${getMatchesColor(game.matches, game.prizeWon)}`}>
                          R$ {parseFloat(game.prizeWon || "0").toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {game.selectedNumbers.map((num: number) => (
                          <Badge key={num} variant="secondary" className="w-8 h-8 rounded-full flex items-center justify-center">
                            {num.toString().padStart(2, '0')}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )) : (
                  <div className="text-center py-12 text-muted-foreground">Nenhum jogo encontrado com os filtros aplicados.</div>
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
