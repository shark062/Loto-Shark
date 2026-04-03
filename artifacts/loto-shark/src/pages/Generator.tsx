import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLotteryTypes } from "@/hooks/useLotteryData";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dice6,
  Sparkles,
  Zap,
  Flame,
  Snowflake,
  Sun,
  Brain,
  Copy,
  Share,
  RefreshCw,
  Target,
  Settings,
  CheckCircle2,
  Trash2
} from "lucide-react";
import type { UserGame, LotteryType } from "@/types/lottery";
import BettingPlatformIntegration from "@/components/BettingPlatformIntegration";

const generateGameSchema = z.object({
  lotteryId: z.string().min(1, "Selecione uma modalidade"),
  numbersCount: z.number().min(1, "Quantidade de dezenas inválida"),
  gamesCount: z.number().min(1, "Quantidade de jogos inválida"),
  strategy: z.enum(['hot', 'cold', 'mixed', 'ai', 'manual']),
});

type GenerateGameForm = z.infer<typeof generateGameSchema>;

interface GeneratedGame {
  numbers: number[];
  strategy: string;
  confidence?: number;
  reasoning?: string;
}

export default function Generator() {
  const [location] = useLocation();
  const [generatedGames, setGeneratedGames] = useState<GeneratedGame[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Clear all generated games
  const clearGeneratedGames = () => {
    setGeneratedGames([]);
    toast({
      title: "Jogos Limpos!",
      description: "Todos os jogos gerados foram removidos.",
    });
  };

  // Parse URL parameters
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const preselectedLottery = urlParams.get('lottery');
  const preselectedNumber = urlParams.get('number');

  // Estado para selectedLotteryId - inicializa com valor da URL se disponível
  const [selectedLotteryId, setSelectedLotteryId] = useState<string>(preselectedLottery || '');

  // Data queries
  const { data: lotteryTypes, isLoading: lotteriesLoading } = useLotteryTypes();
  const { data: frequencies } = useQuery({
    queryKey: [`/api/lotteries/${selectedLotteryId}/frequency`],
    enabled: !!selectedLotteryId,
  });

  // Form setup
  const form = useForm<GenerateGameForm>({
    resolver: zodResolver(generateGameSchema),
    defaultValues: {
      lotteryId: preselectedLottery || '',
      numbersCount: undefined,
      gamesCount: undefined,
      strategy: undefined,
    },
  });

  // Atualiza o estado local selectedLotteryId sempre que o valor do formulário mudar
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (value.lotteryId !== undefined && value.lotteryId !== selectedLotteryId) {
        setSelectedLotteryId(value.lotteryId);
      }
    });
    return () => subscription.unsubscribe();
  }, [selectedLotteryId]);


  // Limpar campo dezenas quando trocar de modalidade
  useEffect(() => {
    if (selectedLotteryId) {
      form.setValue('numbersCount', undefined as any);
    }
  }, [selectedLotteryId]);

  const selectedLottery = lotteryTypes?.find(l => l.id === selectedLotteryId);

  // Não preenche automaticamente - deixa em branco para o usuário escolher
  useEffect(() => {
    if (selectedLottery) {
      // Remove o preenchimento automático
      // form.setValue('numbersCount', selectedLottery.minNumbers);
    }
  }, [selectedLottery]);

  // Generate games mutation
  const generateGamesMutation = useMutation({
    mutationFn: async (data: GenerateGameForm) => {
      const response = await apiRequest('POST', '/api/games/generate', data);
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedGames(data.map((game: UserGame) => ({
        numbers: game.selectedNumbers,
        strategy: game.strategy || 'mixed',
      })));
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/stats"] });
      toast({
        title: "Jogos Gerados!",
        description: `${data.length} jogo(s) gerado(s) com sucesso.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao Gerar Jogos",
        description: "Não foi possível gerar os jogos. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: GenerateGameForm) => {
    // Modo manual: salvar números selecionados
    if (data.strategy === 'manual') {
      if (selectedNumbers.length === 0) {
        toast({
          title: "Selecione números",
          description: `Selecione pelo menos 1 número.`,
          variant: "destructive"
        });
        return;
      }

      setGeneratedGames([{
        numbers: selectedNumbers,
        strategy: 'manual'
      }]);
      
      toast({
        title: "Jogo criado!",
        description: "Seus números foram selecionados com sucesso."
      });
      return;
    }

    // Modo automático: gerar jogos com IA
    setIsGenerating(true);
    try {
      await generateGamesMutation.mutateAsync(data);
    } finally {
      setIsGenerating(false);
    }
  };

  const getNumberFrequency = (number: number) => {
    return frequencies && Array.isArray(frequencies) ? frequencies.find((f: any) => f.number === number) : undefined;
  };

  const toggleNumber = (number: number) => {
    if (!selectedLottery) return;

    if (selectedNumbers.includes(number)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== number));
    } else {
      setSelectedNumbers([...selectedNumbers, number].sort((a, b) => a - b));
    }
  };

  const clearSelection = () => {
    setSelectedNumbers([]);
  };

  // Limpar seleção ao trocar de modalidade
  useEffect(() => {
    setSelectedNumbers([]);
  }, [selectedLotteryId]);

  const getStrategyInfo = (strategy: string) => {
    const strategies = {
      hot: {
        icon: <Flame className="h-4 w-4 text-destructive" />,
        emoji: '🔥',
        name: 'Números Quentes',
        description: 'Foca nos números que mais saem',
        color: 'text-destructive',
      },
      cold: {
        icon: <Snowflake className="h-4 w-4 text-primary" />,
        emoji: '❄️',
        name: 'Números Frios',
        description: 'Foca nos números que menos saem',
        color: 'text-primary',
      },
      mixed: {
        icon: <Sun className="h-4 w-4 text-amber-500" />,
        emoji: '♨️',
        name: 'Estratégia Mista',
        description: '40% quentes, 30% mornos, 30% frios',
        color: 'text-amber-500',
      },
      ai: {
        icon: <Brain className="h-4 w-4 text-secondary" />,
        emoji: '🤖',
        name: 'IA Avançada',
        description: 'Análise inteligente com padrões',
        color: 'text-secondary',
      },
      manual: {
        icon: <Target className="h-4 w-4 text-accent" />,
        emoji: '🎯',
        name: 'Escolha Manual',
        description: 'Selecione seus próprios números',
        color: 'text-accent',
      },
    };
    return strategies[strategy as keyof typeof strategies] || strategies.mixed;
  };

  const getNumberStyle = (number: number, strategy: string) => {
    const baseStyle = "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold";
    const colorStyle = "text-white"; // White numbers as requested

    if (strategy === 'hot') {
      return `${baseStyle} ${colorStyle} bg-red-500`;
    } else if (strategy === 'cold') {
      return `${baseStyle} ${colorStyle} bg-blue-500`;
    } else if (strategy === 'mixed') {
      const mod = number % 3;
      if (mod === 0) return `${baseStyle} ${colorStyle} bg-orange-500`; // Warm
      if (mod === 1) return `${baseStyle} ${colorStyle} bg-red-500`; // Hot
      return `${baseStyle} ${colorStyle} bg-blue-500`; // Cold
    } else if (strategy === 'ai') {
      return `${baseStyle} ${colorStyle} bg-purple-500`;
    }
    return `${baseStyle} ${colorStyle} bg-gray-500`; // Default neutral color
  };


  const copyToClipboard = (numbers: number[]) => {
    const text = numbers.join(' - ');
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Números copiados para a área de transferência.",
    });
  };


  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <main className="container mx-auto px-4 py-4">
        <div className="text-center mb-4">
          <div>
            <h2 className="text-2xl font-bold neon-text text-primary mb-1" data-testid="generator-title">
              Gerador Inteligente 🔮
            </h2>
            <p className="text-sm text-muted-foreground">
              Gere jogos com estratégias baseadas em IA e análise estatística
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Generator Form */}
          <Card className="neon-border bg-black/20">
            <CardHeader>
              <CardTitle className="text-primary flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Configurações do Jogo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Lottery Selection */}
                <div>
                  <Label className="flex items-center text-sm font-medium text-foreground mb-2">
                    <Target className="h-4 w-4 mr-2 text-primary" />
                    Modalidade
                  </Label>
                  <Select
                    value={form.watch('lotteryId')}
                    onValueChange={(value) => {
                      form.setValue('lotteryId', value);
                      // O useEffect acima irá capturar essa mudança e atualizar setSelectedLotteryId
                    }}
                    disabled={lotteriesLoading}
                  >
                    <SelectTrigger className="w-full">
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
                  {form.formState.errors.lotteryId && (
                    <p className="text-destructive text-sm mt-1">{form.formState.errors.lotteryId.message}</p>
                  )}
                </div>

                {/* Numbers Count */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center text-sm font-medium text-foreground mb-2">
                      <Dice6 className="h-4 w-4 mr-2 text-accent" />
                      Dezenas
                    </Label>
                    <Input
                      type="number"
                      placeholder=""
                      {...form.register('numbersCount', { valueAsNumber: true })}
                      className="bg-input border-border"
                      data-testid="numbers-count-input"
                    />
                  </div>

                  <div>
                    <Label className="flex items-center text-sm font-medium text-foreground mb-2">
                      <Copy className="h-4 w-4 mr-2 text-secondary" />
                      Qtd. Jogos
                    </Label>
                    <Input
                      type="number"
                      placeholder=""
                      {...form.register('gamesCount', { valueAsNumber: true })}
                      className="bg-input border-border"
                      data-testid="games-count-input"
                    />
                  </div>
                </div>

                {/* Strategy Selection */}
                <div>
                  <Label className="flex items-center text-sm font-medium text-foreground mb-2">
                    <Brain className="h-4 w-4 mr-2 text-secondary" />
                    Estratégia de Números
                  </Label>
                  <div className="space-y-2">
                    {(['hot', 'cold', 'mixed', 'ai', 'manual'] as const).map((strategy) => {
                      const info = getStrategyInfo(strategy);
                      const isSelected = form.watch('strategy') === strategy;

                      return (
                        <Card
                          key={strategy}
                          className={`cursor-pointer transition-all duration-200 ${
                            isSelected
                              ? 'bg-primary/20 border-primary/50 shadow-lg shadow-primary/20'
                              : 'bg-black/10 border-border/50 hover:bg-black/20 hover:border-primary/30'
                          }`}
                          onClick={() => form.setValue('strategy', strategy)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center space-x-3">
                                <div className={`p-2 rounded-full transition-colors ${
                                  isSelected ? 'bg-primary/30' : 'bg-background/50'
                                }`}>
                                  {info.icon}
                                </div>
                                <div>
                                  <h4 className={`font-semibold flex items-center transition-colors ${
                                    isSelected ? 'text-primary' : 'text-foreground'
                                  }`}>
                                    {info.name}
                                    <span className="ml-2 text-lg">{info.emoji}</span>
                                  </h4>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {info.description}
                                  </p>
                                </div>
                              </div>
                              {isSelected && (
                                <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                  <div className="w-2 h-2 rounded-full bg-white"></div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Manual Number Selection */}
                {form.watch('strategy') === 'manual' && selectedLottery && (
                  <Card className="bg-black/20">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-accent flex items-center">
                          <Target className="h-4 w-4 mr-2" />
                          Cartela - {selectedLottery.displayName}
                        </h5>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {selectedNumbers.length} números
                          </Badge>
                          {selectedNumbers.length > 0 && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                      </div>

                      {/* Grid de números - Cartela estilo mapa de calor */}
                      <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-xl p-3 mb-3 border border-white/20 shadow-lg">
                        <div className="grid grid-cols-10 gap-1.5">
                          {Array.from({ length: selectedLottery.totalNumbers }, (_, i) => {
                            const number = i + 1;
                            const isSelected = selectedNumbers.includes(number);
                            const freq = getNumberFrequency(number);
                            const temp = freq?.temperature || 'cold';

                            return (
                              <button
                                key={number}
                                type="button"
                                onClick={() => toggleNumber(number)}
                                className={`
                                  relative aspect-square rounded-lg text-xs font-bold 
                                  transition-all duration-200 border flex items-center justify-center
                                  ${isSelected
                                    ? temp === 'hot' 
                                      ? 'bg-red-500/90 border-red-400 text-white shadow-lg shadow-red-500/50 scale-110 z-10' 
                                      : temp === 'warm' 
                                      ? 'bg-yellow-500/90 border-yellow-400 text-white shadow-lg shadow-yellow-500/50 scale-110 z-10' 
                                      : 'bg-blue-500/90 border-blue-400 text-white shadow-lg shadow-blue-500/50 scale-110 z-10'
                                    : 'bg-black/40 border-white/20 text-white/70 hover:bg-white/20 hover:border-white/40 hover:text-white hover:scale-105'
                                  }
                                `}
                              >
                                <span className={isSelected ? 'font-extrabold' : ''}>
                                  {number.toString().padStart(2, '0')}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Números selecionados */}
                      {selectedNumbers.length > 0 && (
                        <div className="space-y-2 border-t border-primary/30 pt-2 mt-2">
                          <div className="bg-gradient-to-r from-black/50 to-black/30 rounded-xl p-2.5 border border-primary/20">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Seus números selecionados:
                              </p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={clearSelection}
                                className="h-6 text-xs text-muted-foreground hover:text-destructive px-2"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Limpar
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedNumbers.map((num) => {
                                const freq = getNumberFrequency(num);
                                const temp = freq?.temperature || 'cold';
                                return (
                                  <div
                                    key={num}
                                    className={`
                                      px-2.5 py-1 rounded-lg text-sm font-bold shadow-md
                                      ${temp === 'hot' ? 'bg-red-500 text-white shadow-red-500/40' :
                                        temp === 'warm' ? 'bg-yellow-500 text-white shadow-yellow-500/40' :
                                        'bg-blue-500 text-white shadow-blue-500/40'
                                      }
                                    `}
                                  >
                                    {num.toString().padStart(2, '0')}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Legenda compacta */}
                      <div className="bg-black/20 rounded-lg p-2 mt-2 border border-white/10">
                        <div className="flex justify-center gap-4 text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded bg-red-500 shadow-sm shadow-red-500/50"></div>
                            <span className="font-medium">🔥 Quentes</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded bg-yellow-500 shadow-sm shadow-yellow-500/50"></div>
                            <span className="font-medium">♨️ Mornos</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded bg-blue-500 shadow-sm shadow-blue-500/50"></div>
                            <span className="font-medium">❄️ Frios</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Strategy Details */}
                {form.watch('strategy') && form.watch('strategy') !== 'manual' && (
                  <Card className="bg-black/20">
                    <CardContent className="p-3">
                      <h5 className="font-medium text-accent mb-2 flex items-center">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Como Funciona: {getStrategyInfo(form.watch('strategy')).name}
                      </h5>
                      <div className="space-y-2">
                        {form.watch('strategy') === 'hot' && (
                          <div className="text-sm text-muted-foreground">
                            <div className="flex items-center mb-2">
                              <Flame className="h-4 w-4 mr-2 text-destructive" />
                              <span className="font-medium">Foco em números frequentes</span>
                            </div>
                            <ul className="space-y-1 ml-6">
                              <li>• Seleciona números que saíram mais vezes recentemente</li>
                              <li>• Baseado na tendência de repetição</li>
                              <li>• Ideal para quem acredita em "sequências quentes"</li>
                            </ul>
                          </div>
                        )}
                        {form.watch('strategy') === 'cold' && (
                          <div className="text-sm text-muted-foreground">
                            <div className="flex items-center mb-2">
                              <Snowflake className="h-4 w-4 mr-2 text-primary" />
                              <span className="font-medium">Foco em números atrasados</span>
                            </div>
                            <ul className="space-y-1 ml-6">
                              <li>• Seleciona números que não saem há mais tempo</li>
                              <li>• Baseado na teoria de compensação</li>
                              <li>• Ideal para quem acredita que "tudo se equilibra"</li>
                            </ul>
                          </div>
                        )}
                        {form.watch('strategy') === 'mixed' && (
                          <div className="text-sm text-muted-foreground">
                            <div className="flex items-center mb-2">
                              <Sun className="h-4 w-4 mr-2 text-amber-500" />
                              <span className="font-medium">Estratégia equilibrada</span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 mb-3">
                              <div className="text-center p-2 bg-black/20 rounded">
                                <div className="font-bold text-destructive">40%</div>
                                <div className="text-xs">🔥 Quentes</div>
                              </div>
                              <div className="text-center p-2 bg-amber-500/10 rounded">
                                <div className="font-bold text-amber-500">30%</div>
                                <div className="text-xs">♨️ Mornos</div>
                              </div>
                              <div className="text-center p-2 bg-black/20 rounded">
                                <div className="font-bold text-primary">30%</div>
                                <div className="text-xs">❄️ Frios</div>
                              </div>
                            </div>
                            <p className="text-xs">Combina diferentes temperaturas para balancear riscos e oportunidades</p>
                          </div>
                        )}
                        {form.watch('strategy') === 'ai' && (
                          <div className="text-sm text-muted-foreground">
                            <div className="flex items-center mb-2">
                              <Brain className="h-4 w-4 mr-2 text-secondary" />
                              <span className="font-medium">Inteligência artificial avançada</span>
                            </div>
                            <ul className="space-y-1 ml-6">
                              <li>• Analisa padrões complexos nos dados históricos</li>
                              <li>• Considera múltiplas variáveis simultâneas</li>
                              <li>• Algoritmo de machine learning otimizado</li>
                              <li>• Recomendado para jogadores experientes</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Generate Button */}
                <Button
                  type="submit"
                  disabled={isGenerating || !selectedLotteryId}
                  className="w-full bg-black/20 hover:bg-primary/20 border border-primary/50 text-white"
                  data-testid="generate-games-button"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                      GERANDO JOGOS...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      GERAR JOGOS INTELIGENTES
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Generated Games */}
          <div className="space-y-3">
            <Card className="neon-border bg-black/20">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-accent flex items-center">
                  <Dice6 className="h-5 w-5 mr-2" />
                  Jogos Gerados
                </CardTitle>
                {generatedGames.length > 0 && (
                  <div className="flex gap-2">
                  </div>
                )}
              </CardHeader>
            <CardContent className="space-y-3 p-4">
              {generatedGames.length > 0 ? (
                generatedGames.map((game, index) => {
                  const strategyInfo = getStrategyInfo(game.strategy);

                  return (
                    <Card key={index} className="bg-black/20 border-border/50">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-primary">
                              Jogo #{index + 1}
                            </span>
                            <Badge variant="secondary" className={`${strategyInfo.color} text-xs`}>
                              {strategyInfo.emoji} {strategyInfo.name}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(game.numbers)}
                            data-testid={`copy-game-${index}-button`}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          {game.numbers.map((number) => (
                            <Badge
                              key={number}
                              className={getNumberStyle(number, game.strategy)}
                              data-testid={`game-${index}-number-${number}`}
                            >
                              {number.toString().padStart(2, '0')}
                            </Badge>
                          ))}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Estratégia: {strategyInfo.description}
                          {game.confidence && ` • Confiança: ${Math.round(game.confidence * 100)}%`}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  <Dice6 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">Nenhum jogo gerado ainda</p>
                  <p className="text-sm">Configure os parâmetros e clique em "Gerar Jogos"</p>
                </div>
              )}
            </CardContent>
            </Card>

            {/* Betting Platform Integration */}
            {generatedGames.length > 0 && selectedLotteryId && (
              <BettingPlatformIntegration
                lotteryId={selectedLotteryId}
                games={generatedGames.map(g => ({ numbers: g.numbers }))}
              />
            )}
          </div>
        </div>

        {/* Quick Actions */}
        {generatedGames.length > 0 && (
          <div className="text-center mt-4">
            <div className="inline-flex gap-3">
              <Button
                onClick={() => window.location.href = '/heat-map'}
                variant="outline"
                className="border-primary text-primary hover:bg-black/20"
                data-testid="view-heatmap-button"
              >
                <Flame className="h-4 w-4 mr-2" />
                Ver Mapa de Calor
              </Button>

              <Button
                onClick={() => window.location.href = '/results'}
                className="bg-black/20 hover:bg-primary/20"
                data-testid="view-results-button"
              >
                <Target className="h-4 w-4 mr-2" />
                Verificar Resultados
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Developer Footer */}
      <footer className="text-center py-3 mt-4 border-t border-border/20">
        <p className="text-xs text-muted-foreground">
          powered by <span className="text-accent font-semibold">Shark062</span>
        </p>
      </footer>
    </div>
  );
}