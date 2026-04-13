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
  Trash2,
  Shuffle,
  Info,
  TrendingUp,
  BookOpen,
  Award,
  RotateCcw,
} from "lucide-react";
import type { UserGame, LotteryType } from "@/types/lottery";
import {
  salvarJogos,
  carregarPesos,
  ajustarPesos,
  registrarResultadoOficial,
  analisarPerformance,
  estatisticasGerais,
  resetarMemoria,
  type SharkPesos,
} from "@/core/sharkMemory";
import { gerarRelatorio, getEmojiEstrategia, type Relatorio } from "@/core/sharkAnalytics";
import { desdobramentoInteligente } from "@/core/sharkDesdobramento";
import { salvarJogosGerados, toSavedGame } from "@/core/sharkSavedGames";
import BettingPlatformIntegration from "@/components/BettingPlatformIntegration";

const generateGameSchema = z.object({
  lotteryId: z.string().min(1, "Selecione uma modalidade"),
  numbersCount: z.number().min(1).optional(),
  gamesCount: z.number().min(1).max(100).optional(),
  strategy: z.enum(['hot', 'cold', 'mixed', 'ai', 'shark', 'manual', 'desdobramento']),
}).superRefine((data, ctx) => {
  if (!['manual', 'desdobramento'].includes(data.strategy)) {
    if (!data.numbersCount || data.numbersCount < 1) ctx.addIssue({ code: 'custom', message: 'Informe a quantidade de dezenas', path: ['numbersCount'] });
    if (!data.gamesCount  || data.gamesCount  < 1) ctx.addIssue({ code: 'custom', message: 'Informe a quantidade de jogos',   path: ['gamesCount']  });
  }
});

function binomial(n: number, k: number): number {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;
  let r = 1;
  for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
  return Math.round(r);
}

function getCombinations(arr: number[], k: number): number[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  return [
    ...getCombinations(rest, k - 1).map(c => [first, ...c]),
    ...getCombinations(rest, k),
  ];
}

const LOTTERY_PRICES: Record<string, number> = {
  megasena: 5.00, lotofacil: 3.00, quina: 2.50, lotomania: 3.00,
  duplasena: 2.50, timemania: 3.50, diadesorte: 2.50, supersete: 2.50,
};

type GenerateGameForm = z.infer<typeof generateGameSchema>;

interface GeneratedGame {
  numbers: number[];
  strategy: string;
  confidence?: number;
  reasoning?: string;
  sharkScore?: number;
  sharkOrigem?: string;
  sharkContexto?: {
    hot: number[];
    warm: number[];
    cold: number[];
    totalCandidatos: number;
    totalValidados: number;
  };
  rawGame?: any;
}

export default function Generator() {
  const [location] = useLocation();
  const [generatedGames, setGeneratedGames] = useState<GeneratedGame[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [sharkRawGames, setSharkRawGames] = useState<any[]>([]);
  const [desdobramentoGames, setDesdobramentoGames] = useState<GeneratedGame[]>([]);
  const [showDesdobramento, setShowDesdobramento] = useState(false);
  const [sharkPesos, setSharkPesos] = useState<SharkPesos>({ frequencia: 0.5, atraso: 0.3, repeticao: 0.2 });
  const [sharkStats, setSharkStats] = useState<ReturnType<typeof estatisticasGerais> | null>(null);
  const [showMemoriaPanel, setShowMemoriaPanel] = useState(false);
  const [resultInput, setResultInput] = useState("");
  const [showRegistrar, setShowRegistrar] = useState(false);
  const [desdobramentoLimit, setDesdobramentoLimit] = useState<number | "">("");
  const [sharkDesdobramentoLimit, setSharkDesdobramentoLimit] = useState<number | "">("");
  const [relatorio, setRelatorio] = useState<Relatorio>({});
  const [jogosInteligente, setJogosInteligente] = useState<GeneratedGame[]>([]);
  const [showInteligente, setShowInteligente] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const pesos = ajustarPesos();
    setSharkPesos(pesos);
    setSharkStats(estatisticasGerais());
    setRelatorio(gerarRelatorio());
  }, []);

  const clearGeneratedGames = () => {
    setGeneratedGames([]);
    setSharkRawGames([]);
    setDesdobramentoGames([]);
    setShowDesdobramento(false);
    toast({ title: "Jogos Limpos!", description: "Todos os jogos foram removidos." });
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
      strategy: 'shark' as const,
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
      const payload: any = { ...data };
      if (data.strategy === 'shark') {
        payload.pesos = carregarPesos();
      }
      const response = await apiRequest('POST', '/api/games/generate', payload);
      return response.json();
    },
    onSuccess: (data) => {
      const isShark = data[0]?.strategy === 'shark';
      setGeneratedGames(data.map((game: any) => ({
        numbers: game.selectedNumbers,
        strategy: game.strategy || 'mixed',
        confidence: game.confidence,
        reasoning: game.reasoning,
        sharkScore: game.sharkScore,
        sharkOrigem: game.sharkOrigem,
        sharkContexto: game.sharkContexto,
        rawGame: game,
      })));
      if (isShark) {
        setSharkRawGames(data);
        setDesdobramentoGames([]);
        setShowDesdobramento(false);
        setShowRegistrar(false);
        setResultInput("");
        // Salva na memória
        salvarJogos(
          data.map((g: any) => ({ jogo: g.selectedNumbers, score: g.sharkScore || 0, origem: g.sharkOrigem || 'master' })),
          data[0]?.lotteryId || form.getValues('lotteryId'),
        );
        setSharkStats(estatisticasGerais());
      } else {
        setSharkRawGames([]);
        setDesdobramentoGames([]);
        setShowDesdobramento(false);
      }
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

  const desdobramentoMutation = useMutation({
    mutationFn: async ({ lotteryId, jogos, limite }: { lotteryId: string; jogos: any[]; limite: number }) => {
      const response = await apiRequest('POST', '/api/games/desdobramento', { lotteryId, jogos, limite });
      return response.json();
    },
    onSuccess: (data) => {
      const combos: GeneratedGame[] = (data.games || []).map((game: any) => ({
        numbers: game.selectedNumbers,
        strategy: 'desdobramento-shark',
        confidence: game.confidence,
        reasoning: game.reasoning,
      }));
      setDesdobramentoGames(combos);
      setShowDesdobramento(true);
      toast({
        title: `🔀 Desdobramento Shark!`,
        description: `${data.totalCombinacoes} combinações geradas de ${data.poolUsado?.length || 0} dezenas únicas.`,
      });
    },
    onError: () => {
      toast({ title: "Erro no Desdobramento", description: "Não foi possível gerar o desdobramento.", variant: "destructive" });
    },
  });

  const onSubmit = async (data: GenerateGameForm) => {
    // Modo manual
    if (data.strategy === 'manual') {
      if (selectedNumbers.length === 0) {
        toast({ title: "Selecione números", description: "Selecione pelo menos 1 número.", variant: "destructive" });
        return;
      }
      setGeneratedGames([{ numbers: selectedNumbers, strategy: 'manual' }]);
      toast({ title: "Jogo criado!", description: "Seus números foram selecionados com sucesso." });
      return;
    }

    // Modo desdobramento
    if (data.strategy === 'desdobramento') {
      if (!selectedLottery) { toast({ title: "Selecione a modalidade", variant: "destructive" }); return; }
      const min = selectedLottery.minNumbers;
      if (selectedNumbers.length < min) {
        toast({ title: "Selecione mais números", description: `Mínimo: ${min} dezenas para ${selectedLottery.displayName}.`, variant: "destructive" });
        return;
      }
      const limit = typeof desdobramentoLimit === 'number' && desdobramentoLimit > 0 ? desdobramentoLimit : undefined;
      const combos = getCombinations(selectedNumbers, min);
      const limited = limit ? combos.slice(0, limit) : combos;
      if (limited.length === 0) {
        toast({ title: "Nenhuma combinação gerada", description: "Selecione mais dezenas ou ajuste o limite.", variant: "destructive" });
        return;
      }
      setGeneratedGames(limited.map(c => ({ numbers: c, strategy: 'desdobramento' })));
      toast({ title: "Desdobramento gerado! 🔀", description: `${limited.length} de ${combos.length} combinações possíveis geradas.` });
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
      shark: {
        icon: <Brain className="h-4 w-4 text-primary" />,
        emoji: '',
        name: 'Predições com IA',
        description: 'Motor autônomo: simula milhares de combinações e seleciona as melhores com aprendizado contínuo',
        color: 'text-primary',
      },
      manual: {
        icon: <Target className="h-4 w-4 text-accent" />,
        emoji: '🎯',
        name: 'Escolha Manual',
        description: 'Selecione seus próprios números',
        color: 'text-accent',
      },
      desdobramento: {
        icon: <Shuffle className="h-4 w-4 text-emerald-400" />,
        emoji: '🔀',
        name: 'Desdobramento',
        description: 'Escolha mais dezenas e gere todas as combinações possíveis',
        color: 'text-emerald-400',
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
    } else if (strategy === 'shark') {
      return `${baseStyle} ${colorStyle} bg-yellow-500`;
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

        <div className="grid grid-cols-1 gap-4">
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

                {/* Numbers Count — hidden for manual/desdobramento modes */}
                {form.watch('strategy') !== 'manual' && form.watch('strategy') !== 'desdobramento' && (
                  <div className="grid grid-cols-1 gap-4">
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
                        placeholder="Máx. 100"
                        min={1}
                        max={100}
                        {...form.register('gamesCount', { valueAsNumber: true })}
                        className="bg-input border-border"
                        data-testid="games-count-input"
                      />
                    </div>
                  </div>
                )}

                {/* Strategy — single fixed option */}
                <Card className="bg-primary/20 border-primary/50 shadow-lg shadow-primary/20">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-full bg-primary/30">
                          <Brain className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-primary">Predições com IA</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Motor autônomo: simula milhares de combinações e seleciona as melhores com aprendizado contínuo
                          </p>
                        </div>
                      </div>
                      <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0 ml-3">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

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
                        <div className="number-grid grid grid-cols-10 gap-1.5">
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

                {/* Desdobramento Number Selection */}
                {form.watch('strategy') === 'desdobramento' && selectedLottery && (() => {
                  const min = selectedLottery.minNumbers;
                  const n = selectedNumbers.length;
                  const combos = n >= min ? binomial(n, min) : 0;
                  const price = LOTTERY_PRICES[selectedLottery.id] || 3.00;
                  return (
                    <Card className="bg-black/20 border-emerald-500/30">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium text-emerald-400 flex items-center">
                            <Shuffle className="h-4 w-4 mr-2" />
                            Cartela – {selectedLottery.displayName}
                          </h5>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-400">
                              {n} dezenas
                            </Badge>
                            {selectedNumbers.length > 0 && (
                              <Button type="button" variant="ghost" size="sm" onClick={clearSelection}
                                className="h-6 text-xs text-muted-foreground hover:text-destructive px-2">
                                <Trash2 className="h-3 w-3 mr-1" />Limpar
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Quantity input */}
                        <div className="mb-3 flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-2.5">
                          <label className="text-xs text-emerald-300 font-semibold whitespace-nowrap flex items-center gap-1.5">
                            <Shuffle className="h-3.5 w-3.5" />
                            Quantidade de desdobramentos:
                          </label>
                          <Input
                            type="number"
                            min={1}
                            max={combos > 0 ? combos : 9999}
                            placeholder="Qtd"
                            value={desdobramentoLimit}
                            onChange={e => {
                              const v = e.target.value;
                              if (v === "") setDesdobramentoLimit("");
                              else setDesdobramentoLimit(Math.max(1, parseInt(v) || 1));
                            }}
                            className="h-7 text-sm w-24 text-center bg-black/40 border-emerald-500/30 text-emerald-200"
                          />
                          {n >= min && combos > 0 && (
                            <span className="text-xs text-muted-foreground">
                              de {combos} possíveis
                            </span>
                          )}
                        </div>

                        {/* Combo preview banner */}
                        {n < min ? (
                          <div className="rounded-xl p-2.5 mb-3 border text-center text-sm font-semibold bg-white/5 border-white/10 text-muted-foreground">
                            Selecione pelo menos {min} dezenas (ainda faltam {min - n})
                          </div>
                        ) : combos > 0 && (
                          <div className="rounded-xl p-2.5 mb-3 border text-center text-sm font-semibold bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                            {(() => {
                              const effectiveLimit = typeof desdobramentoLimit === 'number' && desdobramentoLimit > 0 ? desdobramentoLimit : combos;
                              const jogos = Math.min(effectiveLimit, combos);
                              return `🔀 ${n} dezenas → ${jogos} jogo${jogos !== 1 ? 's' : ''} gerados • Custo est. R$ ${(jogos * price).toFixed(2).replace('.', ',')}`;
                            })()}
                          </div>
                        )}

                        {/* Number grid */}
                        <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-xl p-3 mb-3 border border-white/20">
                          <div className="number-grid grid grid-cols-10 gap-1.5">
                            {Array.from({ length: selectedLottery.totalNumbers }, (_, i) => {
                              const number = i + 1;
                              const isSel = selectedNumbers.includes(number);
                              const freq = getNumberFrequency(number);
                              const temp = freq?.temperature || 'cold';
                              return (
                                <button key={number} type="button" onClick={() => toggleNumber(number)}
                                  className={`relative aspect-square rounded-lg text-xs font-bold transition-all duration-200 border flex items-center justify-center
                                    ${isSel
                                      ? temp === 'hot'  ? 'bg-red-500/90 border-red-400 text-white shadow-lg shadow-red-500/50 scale-110 z-10'
                                      : temp === 'warm' ? 'bg-yellow-500/90 border-yellow-400 text-white shadow-lg shadow-yellow-500/50 scale-110 z-10'
                                      :                   'bg-emerald-500/90 border-emerald-400 text-white shadow-lg shadow-emerald-500/50 scale-110 z-10'
                                      : 'bg-black/40 border-white/20 text-white/70 hover:bg-white/20 hover:border-white/40 hover:text-white hover:scale-105'
                                    }`}>
                                  <span className={isSel ? 'font-extrabold' : ''}>{number.toString().padStart(2, '0')}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Selected numbers pills */}
                        {selectedNumbers.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {selectedNumbers.map(num => {
                              const freq = getNumberFrequency(num);
                              const temp = freq?.temperature || 'cold';
                              return (
                                <div key={num} className={`px-2.5 py-1 rounded-lg text-sm font-bold shadow-md
                                  ${temp === 'hot' ? 'bg-red-500 text-white' : temp === 'warm' ? 'bg-yellow-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                  {num.toString().padStart(2, '0')}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Legend */}
                        <div className="bg-black/20 rounded-lg p-2 border border-white/10">
                          <div className="flex justify-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500"></div><span>🔥 Quentes</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-500"></div><span>♨️ Mornos</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500"></div><span>❄️ Frios</span></div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Strategy Details */}
                {form.watch('strategy') && form.watch('strategy') !== 'manual' && form.watch('strategy') !== 'desdobramento' && (
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
                            <div className="grid grid-cols-1 gap-3 mb-3">
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
                              <span className="font-medium">Análise estatística multivariável</span>
                            </div>
                            <ul className="space-y-1 ml-6">
                              <li>• Frequência real dos últimos 20 sorteios da Caixa</li>
                              <li>• Equilíbrio par/ímpar próximo de 50%</li>
                              <li>• Soma total dentro da faixa estatística esperada</li>
                              <li>• Evita sequências consecutivas excessivas</li>
                            </ul>
                          </div>
                        )}
                        {form.watch('strategy') === 'shark' && (
                          <div className="text-sm text-muted-foreground">
                            <div className="flex items-center mb-2">
                              <Brain className="h-4 w-4 mr-2 text-primary" />
                              <span className="font-medium text-primary">Predições com IA</span>
                            </div>
                            <ul className="space-y-1 ml-6">
                              <li>• 🔬 Simula estratégias nos últimos 20 sorteios reais</li>
                              <li>• 🏆 Escolhe automaticamente a que teve mais acertos</li>
                              <li>• 📊 Pontua cada jogo por frequência + atraso + repetição</li>
                              <li>• ✅ Valida paridade e sequências antes de incluir</li>
                              <li>• 🧠 Aprende com os resultados anteriores registrados</li>
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
                  className="w-full border text-white bg-primary/20 hover:bg-primary/30 border-primary/50"
                  data-testid="generate-games-button"
                >
                  {isGenerating ? (
                    <><RefreshCw className="h-5 w-5 mr-2 animate-spin" />GERANDO PREDIÇÕES...</>
                  ) : (
                    <><Brain className="h-5 w-5 mr-2" />GERAR PREDIÇÕES COM IA</>
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

                        {game.strategy === 'shark' ? (
                          <div className="space-y-1 mt-1">
                            <div className="text-xs text-yellow-400/80 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                Origem: <span className="font-semibold capitalize">{game.sharkOrigem || '—'}</span>
                              </span>
                              {game.sharkScore !== undefined && (
                                <span className="text-muted-foreground">• score {game.sharkScore}</span>
                              )}
                              {game.confidence && (
                                <span className="text-muted-foreground">• confiança {Math.round(game.confidence * 100)}%</span>
                              )}
                            </div>
                            {game.sharkContexto && (
                              <div className="text-xs text-muted-foreground">
                                {game.sharkContexto.totalCandidatos} candidatos → {game.sharkContexto.totalValidados} validados
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            Estratégia: {strategyInfo.description}
                            {game.confidence && ` • Confiança: ${Math.round(game.confidence * 100)}%`}
                          </div>
                        )}
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

            {/* Botão Desdobramento Shark */}
            {sharkRawGames.length > 0 && (
              <Card className="neon-border bg-black/20 border-yellow-500/40">
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-semibold text-yellow-400 flex items-center gap-2">
                    <Shuffle className="h-4 w-4" />
                    Desdobramento Automático Shark
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Combina os melhores jogos e gera variações otimizadas. Defina quantas quer gerar:
                  </p>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-yellow-300 font-semibold whitespace-nowrap">
                      Quantidade:
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      placeholder="Qtd"
                      value={sharkDesdobramentoLimit}
                      onChange={e => {
                        const v = e.target.value;
                        if (v === "") setSharkDesdobramentoLimit("");
                        else setSharkDesdobramentoLimit(Math.max(1, Math.min(500, parseInt(v) || 1)));
                      }}
                      className="h-7 text-sm w-24 text-center bg-black/40 border-yellow-500/30 text-yellow-200"
                    />
                    <span className="text-xs text-muted-foreground">máximo 500</span>
                  </div>
                  <Button
                    onClick={() => {
                      const lotteryId = form.getValues('lotteryId');
                      const limite = typeof sharkDesdobramentoLimit === 'number' && sharkDesdobramentoLimit > 0
                        ? sharkDesdobramentoLimit : 500;
                      desdobramentoMutation.mutate({ lotteryId, jogos: sharkRawGames, limite });
                    }}
                    disabled={desdobramentoMutation.isPending || sharkDesdobramentoLimit === ""}
                    className="w-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-300"
                  >
                    {desdobramentoMutation.isPending ? (
                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Gerando...</>
                    ) : (
                      <><Shuffle className="h-4 w-4 mr-2" />
                        Gerar {typeof sharkDesdobramentoLimit === 'number' ? sharkDesdobramentoLimit : '...'} Desdobramentos 🔀
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Desdobramento Inteligente (frontend) */}
            {sharkRawGames.length > 0 && selectedLottery && (
              <Card className="neon-border bg-black/20 border-cyan-500/40">
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Desdobramento Inteligente
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Analisa os {sharkRawGames.length} jogos e cria variações baseadas nos números mais frequentes entre eles.
                  </p>
                  <Button
                    onClick={() => {
                      const min = selectedLottery!.minNumbers;
                      const resultado = desdobramentoInteligente(sharkRawGames, min, 50, 20);
                      if (resultado.total === 0) {
                        toast({ title: "Sem dados suficientes", description: "Gere mais jogos Shark primeiro.", variant: "destructive" });
                        return;
                      }
                      const games: GeneratedGame[] = resultado.combinacoes.map(c => ({
                        numbers: c,
                        strategy: "desdobramento-inteligente",
                      }));
                      setJogosInteligente(games);
                      setShowInteligente(true);
                      toast({
                        title: "🧠 Desdobramento Inteligente!",
                        description: `${resultado.total} combinações de ${resultado.poolUsado.length} dezenas-chave.`,
                      });
                    }}
                    className="w-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Gerar Desdobramento Inteligente 🧠
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Jogos do Desdobramento Inteligente */}
            {showInteligente && jogosInteligente.length > 0 && (
              <Card className="neon-border bg-black/20 border-cyan-500/30">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-cyan-400 flex items-center text-base">
                    <Brain className="h-5 w-5 mr-2" />
                    Desdobramento Inteligente ({jogosInteligente.length} combinações)
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowInteligente(false)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2 p-4 max-h-96 overflow-y-auto">
                  {jogosInteligente.map((game, index) => (
                    <Card key={index} className="bg-black/20 border-cyan-500/20">
                      <CardContent className="p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-cyan-400">#{index + 1}</span>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(game.numbers)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {game.numbers.map(n => (
                            <Badge key={n} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-cyan-600 text-white p-0">
                              {n.toString().padStart(2, '0')}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Shark Learning Memory Panel */}
            {sharkRawGames.length > 0 && (
              <Card className="neon-border bg-black/20 border-cyan-500/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-cyan-400 flex items-center text-base">
                      <Brain className="h-5 w-5 mr-2" />
                      Shark Memory &amp; Aprendizado
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-cyan-400 hover:text-cyan-300"
                      onClick={() => setShowMemoriaPanel(v => !v)}
                    >
                      {showMemoriaPanel ? "Ocultar" : "Ver Detalhes"}
                    </Button>
                  </div>
                </CardHeader>
                {showMemoriaPanel && (
                  <CardContent className="space-y-4">
                    {/* Current Weights */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Pesos Aprendidos</p>
                      <div className="space-y-2">
                        {[
                          { label: "Frequência", value: sharkPesos.frequencia, color: "bg-yellow-400" },
                          { label: "Atraso", value: sharkPesos.atraso, color: "bg-orange-400" },
                          { label: "Repetição", value: sharkPesos.repeticao, color: "bg-cyan-400" },
                        ].map(p => (
                          <div key={p.label} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-24">{p.label}</span>
                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${p.color}`}
                                style={{ width: `${Math.round(p.value * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-white w-10 text-right">{Math.round(p.value * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stats */}
                    {sharkStats && sharkStats.totalComAcertos > 0 && (
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          { icon: BookOpen, label: "Com resultado", value: sharkStats.totalComAcertos },
                          { icon: Award, label: "Média acertos", value: sharkStats.mediaGeral.toFixed(1) },
                          { icon: TrendingUp, label: "Maior acerto", value: sharkStats.melhorAcerto },
                        ].map(s => (
                          <div key={s.label} className="bg-white/5 rounded-lg p-2 text-center">
                            <s.icon className="h-4 w-4 mx-auto mb-1 text-cyan-400" />
                            <p className="text-lg font-bold text-white">{s.value}</p>
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Painel de Desempenho por Estratégia */}
                    {Object.keys(relatorio).length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">
                          Desempenho por Estratégia
                        </p>
                        <div className="space-y-1">
                          {Object.entries(relatorio)
                            .sort((a, b) => b[1].media - a[1].media)
                            .map(([estrategia, dados]) => (
                              <div
                                key={estrategia}
                                className="flex items-center justify-between text-xs bg-white/5 rounded px-2 py-1.5"
                              >
                                <span className="text-white/80 capitalize">
                                  {getEmojiEstrategia(estrategia)}{" "}
                                  {estrategia.replace(/_/g, " ")}
                                </span>
                                <span className="text-cyan-300 font-mono tabular-nums">
                                  média {dados.media.toFixed(1)} | 🏆 {dados.melhor} | {dados.jogos}j
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Registrar Resultado */}
                    <div className="border border-white/10 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-white flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                        Registrar Resultado Oficial
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Digite as dezenas sorteadas (separadas por vírgula). O Shark calculará os acertos automaticamente.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Ex: 5,12,23,34,45,58"
                          value={resultInput}
                          onChange={e => setResultInput(e.target.value)}
                          className="h-8 text-sm bg-white/5 border-white/20 flex-1"
                        />
                        <Button
                          size="sm"
                          className="bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-300 text-xs whitespace-nowrap"
                          disabled={!resultInput.trim()}
                          onClick={() => {
                            const dezenas = resultInput.split(/[,\s]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
                            if (dezenas.length === 0) {
                              toast({ title: "Formato inválido", description: "Digite as dezenas separadas por vírgula.", variant: "destructive" });
                              return;
                            }
                            const lotteryId = form.getValues('lotteryId');
                            const res = registrarResultadoOficial(dezenas, lotteryId);
                            const novosP = ajustarPesos();
                            setSharkPesos(novosP);
                            setSharkStats(estatisticasGerais());
                            setRelatorio(gerarRelatorio());
                            setResultInput("");
                            toast({ title: "Resultado registrado!", description: `${res.registrados} jogo(s) avaliado(s). Melhor: ${res.melhorAcerto} acerto(s). Pesos ajustados!` });
                          }}
                        >
                          Registrar
                        </Button>
                      </div>
                    </div>

                    {/* Reset */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 w-full text-xs"
                      onClick={() => {
                        if (window.confirm("Apagar toda a memória do Shark? Essa ação não pode ser desfeita.")) {
                          resetarMemoria();
                          setSharkPesos({ frequencia: 0.5, atraso: 0.3, repeticao: 0.2 });
                          setSharkStats(estatisticasGerais());
                          toast({ title: "Memória resetada", description: "O Shark voltará aos pesos padrão." });
                        }
                      }}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Resetar memória do Shark
                    </Button>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Desdobramento Games */}
            {showDesdobramento && desdobramentoGames.length > 0 && (
              <Card className="neon-border bg-black/20 border-yellow-500/30">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-yellow-400 flex items-center text-base">
                    <Shuffle className="h-5 w-5 mr-2" />
                    Desdobramento Shark ({desdobramentoGames.length} combinações)
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowDesdobramento(false)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2 p-4 max-h-96 overflow-y-auto">
                  {desdobramentoGames.map((game, index) => (
                    <Card key={index} className="bg-black/20 border-yellow-500/20">
                      <CardContent className="p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-yellow-400">#{index + 1}</span>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(game.numbers)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {game.numbers.map(n => (
                            <Badge key={n} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-yellow-500 text-white p-0">
                              {n.toString().padStart(2, '0')}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            )}

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