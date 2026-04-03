
import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLotteryTypes, useNumberFrequencies, useLotteryDraws } from "@/hooks/useLotteryData";
import { apiRequest } from "@/lib/queryClient";
import { 
  Target, 
  Flame, 
  Sun, 
  Snowflake, 
  Trash2, 
  Save, 
  Download,
  Copy,
  CheckCircle2,
  History,
  Trophy
} from "lucide-react";

export default function ManualPicker() {
  const [selectedLottery, setSelectedLottery] = useState<string>('');
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const { toast } = useToast();

  const { data: lotteryTypes, isLoading: lotteriesLoading } = useLotteryTypes();
  const { data: frequencies, isLoading: frequenciesLoading } = useNumberFrequencies(selectedLottery);
  const { data: latestDraws, isLoading: drawsLoading } = useLotteryDraws(selectedLottery, 10);

  const selectedLotteryData = lotteryTypes?.find(l => l.id === selectedLottery);

  // Limpar seleção ao trocar de modalidade
  useEffect(() => {
    setSelectedNumbers([]);
  }, [selectedLottery]);

  const getNumberFrequency = (number: number) => {
    return frequencies?.find(f => f.number === number);
  };

  const getNumberStyle = (number: number, isSelected: boolean) => {
    const freq = getNumberFrequency(number);
    const temperature = freq?.temperature || 'cold';

    const baseStyle = "w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold cursor-pointer transition-all duration-200 border-2";
    
    if (isSelected) {
      // Números selecionados com cores de temperatura
      if (temperature === 'hot') {
        return `${baseStyle} bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/50 scale-110`;
      } else if (temperature === 'warm') {
        return `${baseStyle} bg-yellow-500 text-white border-yellow-400 shadow-lg shadow-yellow-500/50 scale-110`;
      } else {
        return `${baseStyle} bg-blue-500 text-white border-blue-400 shadow-lg shadow-blue-500/50 scale-110`;
      }
    } else {
      // Números não selecionados com cores suaves
      if (temperature === 'hot') {
        return `${baseStyle} bg-red-500/20 text-red-400 border-red-400/30 hover:bg-red-500/40`;
      } else if (temperature === 'warm') {
        return `${baseStyle} bg-yellow-500/20 text-yellow-400 border-yellow-400/30 hover:bg-yellow-500/40`;
      } else {
        return `${baseStyle} bg-blue-500/20 text-blue-400 border-blue-400/30 hover:bg-blue-500/40`;
      }
    }
  };

  const toggleNumber = (number: number) => {
    if (!selectedLotteryData) return;

    if (selectedNumbers.includes(number)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== number));
    } else {
      if (selectedNumbers.length >= selectedLotteryData.maxNumbers) {
        toast({
          title: "Limite atingido",
          description: `Você pode selecionar no máximo ${selectedLotteryData.maxNumbers} números.`,
          variant: "destructive"
        });
        return;
      }
      setSelectedNumbers([...selectedNumbers, number].sort((a, b) => a - b));
    }
  };

  const clearSelection = () => {
    setSelectedNumbers([]);
    toast({
      title: "Seleção limpa",
      description: "Todos os números foram desmarcados."
    });
  };

  const saveGame = async () => {
    if (!selectedLotteryData) return;

    if (selectedNumbers.length < selectedLotteryData.minNumbers) {
      toast({
        title: "Números insuficientes",
        description: `Selecione pelo menos ${selectedLotteryData.minNumbers} números.`,
        variant: "destructive"
      });
      return;
    }

    try {
      await apiRequest('POST', '/api/games', {
        lotteryId: selectedLottery,
        selectedNumbers,
        strategy: 'manual'
      });

      toast({
        title: "✅ Jogo salvo!",
        description: `Seu jogo foi salvo com sucesso.`
      });

      setSelectedNumbers([]);
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o jogo. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const exportNumbers = () => {
    if (selectedNumbers.length === 0) return;

    const text = selectedNumbers.map(n => n.toString().padStart(2, '0')).join(' - ');
    navigator.clipboard.writeText(text);

    toast({
      title: "Copiado!",
      description: "Números copiados para a área de transferência."
    });
  };

  const downloadNumbers = () => {
    if (selectedNumbers.length === 0) return;

    const content = [
      `🦈 SHARK LOTO - Jogo Manual`,
      `Modalidade: ${selectedLotteryData?.displayName}`,
      `Data: ${new Date().toLocaleString('pt-BR')}`,
      ``,
      `Números selecionados:`,
      selectedNumbers.map(n => n.toString().padStart(2, '0')).join(' - '),
      ``,
      `Powered by Shark062`
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shark-loto-manual-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Download concluído!",
      description: "Arquivo salvo com sucesso."
    });
  };

  const getTemperatureIcon = (temp: string) => {
    switch (temp) {
      case 'hot': return <Flame className="h-4 w-4 text-red-500" />;
      case 'warm': return <Sun className="h-4 w-4 text-yellow-500" />;
      case 'cold': return <Snowflake className="h-4 w-4 text-blue-500" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold neon-text text-primary mb-2">
            Escolha suas Dezenas 🎯
          </h2>
          <p className="text-muted-foreground">
            Selecione manualmente seus números com visualização de frequência
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-8">
          <Select value={selectedLottery} onValueChange={setSelectedLottery} disabled={lotteriesLoading}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecione a modalidade" />
            </SelectTrigger>
            <SelectContent>
              {lotteryTypes?.map((lottery) => (
                <SelectItem key={lottery.id} value={lottery.id}>
                  {lottery.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedLotteryData && (
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-sm">
                {selectedNumbers.length} / {selectedLotteryData.minNumbers}-{selectedLotteryData.maxNumbers} números
              </Badge>
              {selectedNumbers.length >= selectedLotteryData.minNumbers && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Number Grid */}
          <div className="lg:col-span-2">
            <Card className="neon-border bg-black/20">
              <CardHeader>
                <CardTitle className="text-primary flex items-center justify-between">
                  <span className="flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    Selecione os Números
                  </span>
                  {selectedLotteryData && (
                    <span className="text-sm text-muted-foreground">
                      1 a {selectedLotteryData.totalNumbers}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedLotteryData ? (
                  <>
                    <div className="grid grid-cols-10 gap-2 mb-6">
                      {Array.from({ length: selectedLotteryData.totalNumbers }, (_, i) => {
                        const number = i + 1;
                        const isSelected = selectedNumbers.includes(number);

                        return (
                          <button
                            key={number}
                            onClick={() => toggleNumber(number)}
                            className={getNumberStyle(number, isSelected)}
                            disabled={frequenciesLoading}
                          >
                            {number.toString().padStart(2, '0')}
                          </button>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="flex justify-center gap-6 text-sm border-t border-border/20 pt-4">
                      <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-red-500" />
                        <span className="text-muted-foreground">Quentes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4 text-yellow-500" />
                        <span className="text-muted-foreground">Mornos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Snowflake className="h-4 w-4 text-blue-500" />
                        <span className="text-muted-foreground">Frios</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    <Target className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Selecione uma modalidade para começar</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Selection Summary */}
          <div className="space-y-4">
            <Card className="neon-border bg-black/20">
              <CardHeader>
                <CardTitle className="text-accent flex items-center">
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Números Selecionados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedNumbers.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {selectedNumbers.map((num) => {
                        const freq = getNumberFrequency(num);
                        const temp = freq?.temperature || 'cold';
                        
                        return (
                          <Badge
                            key={num}
                            className={`${
                              temp === 'hot' ? 'bg-red-500' :
                              temp === 'warm' ? 'bg-yellow-500' :
                              'bg-blue-500'
                            } text-white text-base px-3 py-1`}
                          >
                            {num.toString().padStart(2, '0')}
                          </Badge>
                        );
                      })}
                    </div>

                    <div className="space-y-2 pt-4 border-t border-border/20">
                      <Button
                        onClick={saveGame}
                        disabled={!selectedLotteryData || selectedNumbers.length < (selectedLotteryData?.minNumbers || 0)}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Jogo
                      </Button>

                      <Button
                        onClick={exportNumbers}
                        variant="outline"
                        className="w-full"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar Números
                      </Button>

                      <Button
                        onClick={downloadNumbers}
                        variant="outline"
                        className="w-full"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Baixar Jogo
                      </Button>

                      <Button
                        onClick={clearSelection}
                        variant="destructive"
                        className="w-full"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Limpar Seleção
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p className="text-sm">Nenhum número selecionado</p>
                    <p className="text-xs mt-2">Clique nos números acima para selecionar</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Frequency Info */}
            {selectedNumbers.length > 0 && (
              <Card className="neon-border bg-black/20">
                <CardHeader>
                  <CardTitle className="text-sm">Análise de Frequência</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-red-500" />
                      Quentes
                    </span>
                    <Badge variant="destructive">
                      {selectedNumbers.filter(n => getNumberFrequency(n)?.temperature === 'hot').length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-yellow-500" />
                      Mornos
                    </span>
                    <Badge className="bg-yellow-500">
                      {selectedNumbers.filter(n => getNumberFrequency(n)?.temperature === 'warm').length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Snowflake className="h-4 w-4 text-blue-500" />
                      Frios
                    </span>
                    <Badge className="bg-blue-500">
                      {selectedNumbers.filter(n => getNumberFrequency(n)?.temperature === 'cold').length}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Últimos Resultados - Aparece apenas quando uma modalidade é selecionada */}
        {selectedLottery && selectedLotteryData && (
          <div className="mt-8">
            <Card className="neon-border bg-black/20">
              <CardHeader>
                <CardTitle className="text-primary flex items-center">
                  <History className="h-5 w-5 mr-2" />
                  Últimos 10 Resultados - {selectedLotteryData.displayName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {drawsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">Carregando resultados...</p>
                  </div>
                ) : latestDraws && latestDraws.length > 0 ? (
                  <div className="space-y-3">
                    {latestDraws.map((draw, index) => (
                      <div
                        key={draw.contestNumber}
                        className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-border/20 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {index === 0 && (
                            <Trophy className="h-5 w-5 text-yellow-500" />
                          )}
                          <div>
                            <div className="text-sm font-semibold">
                              Concurso {draw.contestNumber}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(draw.drawDate).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                          {draw.drawnNumbers?.sort((a, b) => a - b).map((num) => {
                            const freq = getNumberFrequency(num);
                            const temp = freq?.temperature || 'cold';
                            
                            return (
                              <Badge
                                key={num}
                                className={`${
                                  temp === 'hot' ? 'bg-red-500/80' :
                                  temp === 'warm' ? 'bg-yellow-500/80' :
                                  'bg-blue-500/80'
                                } text-white font-mono`}
                              >
                                {num.toString().padStart(2, '0')}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum resultado disponível para esta modalidade</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Developer Footer */}
      <footer className="text-center py-4 mt-8 border-t border-border/20">
        <p className="text-xs text-muted-foreground">
          powered by <span className="text-accent font-semibold">Shark062</span>
        </p>
      </footer>
    </div>
  );
}
