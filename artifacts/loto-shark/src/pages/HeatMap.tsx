import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import HeatMapGrid from "@/components/HeatMapGrid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLotteryTypes, useNumberFrequencies } from "@/hooks/useLotteryData";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Flame, 
  Snowflake, 
  Sun, 
  RefreshCw, 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  Zap
} from "lucide-react";
import type { NumberFrequency } from "@/types/lottery";

export default function HeatMap() {
  const [selectedLottery, setSelectedLottery] = useState<string>('');
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  // Data queries
  const { data: lotteryTypes, isLoading: lotteriesLoading } = useLotteryTypes();
  const { data: frequencies, isLoading: frequenciesLoading, refetch } = useNumberFrequencies(selectedLottery);

  const selectedLotteryData = lotteryTypes?.find(l => l.id === selectedLottery);

  const handleUpdateFrequencies = async () => {
    if (!selectedLottery) return;

    setIsUpdating(true);
    try {
      await apiRequest('POST', `/api/lotteries/${selectedLottery}/update-frequency`);
      await refetch();
      toast({
        title: "Frequências Atualizadas",
        description: "Os dados do mapa de calor foram atualizados com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao Atualizar",
        description: "Não foi possível atualizar as frequências. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getNumberDetails = (number: number): NumberFrequency | undefined => {
    return frequencies?.find(f => f.number === number);
  };

  const getTemperatureStats = () => {
    if (!frequencies) return { hot: 0, warm: 0, cold: 0 };

    return {
      hot: frequencies.filter(f => f.temperature === 'hot').length,
      warm: frequencies.filter(f => f.temperature === 'warm').length,
      cold: frequencies.filter(f => f.temperature === 'cold').length,
    };
  };

  const getMostFrequent = () => {
    if (!frequencies) return [];
    return frequencies
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);
  };

  const getLeastFrequent = () => {
    if (!frequencies) return [];
    return frequencies
      .sort((a, b) => a.frequency - b.frequency)
      .slice(0, 5);
  };

  const stats = getTemperatureStats();
  const mostFrequent = getMostFrequent();
  const leastFrequent = getLeastFrequent();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold neon-text text-primary mb-2" data-testid="heatmap-title">
            Mapa de Calor 🔥❄️♨️
          </h2>
          <p className="text-muted-foreground">
            Análise de frequência dos números sorteados
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Select value={selectedLottery} onValueChange={setSelectedLottery} disabled={lotteriesLoading}>
              <SelectTrigger className="w-48" data-testid="lottery-selector">
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

            <Button
              onClick={handleUpdateFrequencies}
              disabled={isUpdating || !selectedLottery}
              variant="outline"
              size="sm"
              data-testid="update-frequencies-button"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Atualizando...' : 'Atualizar'}
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Baseado nos últimos 20 concursos</span>
          </div>
        </div>

        {/* Temperature Statistics */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="neon-border bg-black/20">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Flame className="h-6 w-6 text-destructive mr-2" />
                <span className="text-2xl">🔥</span>
              </div>
              <div className="text-3xl font-bold text-destructive neon-text" data-testid="hot-count">
                {stats.hot}
              </div>
              <div className="text-sm text-muted-foreground">Números Quentes</div>
            </CardContent>
          </Card>

          <Card className="neon-border bg-black/20">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Sun className="h-6 w-6 text-amber-500 mr-2" />
                <span className="text-2xl">♨️</span>
              </div>
              <div className="text-3xl font-bold text-amber-500" data-testid="warm-count">
                {stats.warm}
              </div>
              <div className="text-sm text-muted-foreground">Números Mornos</div>
            </CardContent>
          </Card>

          <Card className="neon-border bg-black/20">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Snowflake className="h-6 w-6 text-primary mr-2" />
                <span className="text-2xl">❄️</span>
              </div>
              <div className="text-3xl font-bold text-primary neon-text" data-testid="cold-count">
                {stats.cold}
              </div>
              <div className="text-sm text-muted-foreground">Números Frios</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Heat Map */}
        {selectedLotteryData && (
          <div className="mb-8">
            <HeatMapGrid
              frequencies={frequencies || []}
              maxNumbers={selectedLotteryData.totalNumbers}
              isLoading={frequenciesLoading}
              onNumberClick={setSelectedNumber}
            />
          </div>
        )}

        {/* Analysis Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Most Frequent Numbers */}
          <Card className="neon-border bg-black/20">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Mais Frequentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mostFrequent.map((freq, index) => (
                <div key={freq.number} className="flex items-center justify-between p-2 bg-black/20 rounded">
                  <div className="flex items-center space-x-3">
                    <Badge variant="destructive" className="w-8 h-8 rounded-full flex items-center justify-center p-0">
                      {freq.number}
                    </Badge>
                    <span className="font-mono">#{index + 1}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-destructive">{freq.frequency}x</div>
                    <div className="text-xs text-muted-foreground">
                      {freq.lastDrawn ? new Date(freq.lastDrawn).toLocaleDateString('pt-BR') : 'N/A'}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Least Frequent Numbers */}
          <Card className="neon-border bg-black/20">
            <CardHeader>
              <CardTitle className="text-primary flex items-center">
                <TrendingDown className="h-5 w-5 mr-2" />
                Menos Frequentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {leastFrequent.map((freq, index) => (
                <div key={freq.number} className="flex items-center justify-between p-2 bg-black/20 rounded">
                  <div className="flex items-center space-x-3">
                    <Badge variant="secondary" className="w-8 h-8 rounded-full flex items-center justify-center p-0 bg-black/20 text-primary-foreground">
                      {freq.number}
                    </Badge>
                    <span className="font-mono">#{index + 1}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary">{freq.frequency}x</div>
                    <div className="text-xs text-muted-foreground">
                      {freq.lastDrawn ? new Date(freq.lastDrawn).toLocaleDateString('pt-BR') : 'N/A'}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Selected Number Details */}
          <Card className="neon-border bg-black/20">
            <CardHeader>
              <CardTitle className="text-accent flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Detalhes do Número
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedNumber ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-6xl font-bold text-accent neon-text mb-2" data-testid="selected-number">
                      {selectedNumber.toString().padStart(2, '0')}
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`${
                        getNumberDetails(selectedNumber)?.temperature === 'hot' ? 'bg-destructive' :
                        getNumberDetails(selectedNumber)?.temperature === 'warm' ? 'bg-black/20' :
                        'bg-primary'
                      } text-white`}
                    >
                      {getNumberDetails(selectedNumber)?.temperature === 'hot' ? '🔥 Quente' :
                       getNumberDetails(selectedNumber)?.temperature === 'warm' ? '♨️ Morno' :
                       '❄️ Frio'}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frequência:</span>
                      <span className="font-mono font-bold" data-testid="selected-frequency">
                        {getNumberDetails(selectedNumber)?.frequency || 0}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Último sorteio:</span>
                      <span className="font-mono" data-testid="selected-last-drawn">
                        {getNumberDetails(selectedNumber)?.lastDrawn 
                          ? new Date(getNumberDetails(selectedNumber)!.lastDrawn!).toLocaleDateString('pt-BR')
                          : 'Nunca'
                        }
                      </span>
                    </div>
                  </div>

                  <Button 
                    onClick={() => window.location.href = `/generator?lottery=${selectedLottery}&number=${selectedNumber}`}
                    className="w-full bg-black/20"
                    data-testid="use-in-generator-button"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Usar no Gerador
                  </Button>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Clique em um número para ver os detalhes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="text-center">
          <div className="inline-flex gap-4">
            <Button 
              onClick={() => window.location.href = '/generator'}
              className="bg-black/20"
              data-testid="go-to-generator-button"
            >
              <Zap className="h-4 w-4 mr-2" />
              Ir para Gerador
            </Button>

            <Button 
              onClick={() => window.location.href = '/ai-analysis'}
              variant="outline"
              className="border-secondary text-secondary hover:bg-black/20 px-6 py-3"
              data-testid="ai-analysis-button"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Análise IA
            </Button>
          </div>
        </div>
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