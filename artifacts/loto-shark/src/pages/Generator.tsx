import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Navigation from "@/components/Navigation";
import { NumberBall } from "@/components/NumberBall";
import { Card, CardContent } from "@/components/ui/card";
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
  Zap, Brain, Copy, Target, Trash2, Shuffle, ChevronDown, ChevronUp,
  CheckCircle2, TrendingUp, Flame, Snowflake, Sun, BarChart3,
  RotateCcw, BookOpen, Award, RefreshCw, Cpu, Sparkles,
} from "lucide-react";
import {
  salvarJogos, carregarPesos, ajustarPesos, registrarResultadoOficial,
  analisarPerformance, estatisticasGerais, resetarMemoria, type SharkPesos,
} from "@/core/sharkMemory";
import { gerarRelatorio, getEmojiEstrategia, type Relatorio } from "@/core/sharkAnalytics";
import { desdobramentoInteligente } from "@/core/sharkDesdobramento";
import {
  calcularScorePrecisao, getRankColor, getRankBgColor, getRankEmoji,
  type PrecisionResult, type FreqEntry,
} from "@/core/sharkPrecisionEngine";
import { registrarDesempenho } from "@/core/sharkAutoLearning";
import GameInsightsCard from "@/components/GameInsightsCard";

/* ─── helpers ─────────────────────────────────────────── */
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
  return [...getCombinations(rest, k - 1).map(c => [first, ...c]), ...getCombinations(rest, k)];
}
const LOTTERY_PRICES: Record<string, number> = {
  megasena: 5.00, lotofacil: 3.00, quina: 2.50, lotomania: 3.00,
  duplasena: 2.50, timemania: 3.50, diadesorte: 2.50, supersete: 2.50,
  maisMilionaria: 6.00,
};

/* ─── loading steps ────────────────────────────────────── */
const LOADING_STEPS = [
  "Analisando tendências...",
  "Calculando cobertura...",
  "Avaliando entropia...",
  "Otimizando estrutura...",
  "Aplicando SharkCore...",
  "Finalizando melhores combinações...",
];

/* ─── types ────────────────────────────────────────────── */
const schema = z.object({
  lotteryId:    z.string().min(1, "Selecione uma modalidade"),
  numbersCount: z.number().min(1).optional(),
  gamesCount:   z.number().min(1).max(100).optional(),
  strategy:     z.enum(["shark", "manual", "desdobramento"]),
}).superRefine((data, ctx) => {
  if (!["manual", "desdobramento"].includes(data.strategy)) {
    if (!data.numbersCount) ctx.addIssue({ code: "custom", message: "Informe a quantidade de dezenas", path: ["numbersCount"] });
    if (!data.gamesCount)   ctx.addIssue({ code: "custom", message: "Informe a quantidade de jogos",   path: ["gamesCount"]  });
  }
});
type FormValues = z.infer<typeof schema>;

interface GeneratedGame {
  numbers: number[];
  strategy: string;
  confidence?: number;
  sharkScore?: number;
  sharkOrigem?: string;
  sharkContexto?: { hot: number[]; warm: number[]; cold: number[]; totalCandidatos: number; totalValidados: number };
  rawGame?: any;
}

/* ─── score bar ────────────────────────────────────────── */
function MiniScoreBar({ score }: { score: number }) {
  const pct  = Math.min(100, Math.max(0, score));
  const color = pct >= 80 ? "bg-yellow-400" : pct >= 65 ? "bg-emerald-400" : pct >= 50 ? "bg-sky-400" : "bg-slate-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums w-7 text-right text-muted-foreground">{pct}</span>
    </div>
  );
}

/* ─── accordion ────────────────────────────────────────── */
function Accordion({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon?: React.ComponentType<any> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground/80 hover:text-foreground transition-colors"
        style={{ background: "rgba(18,24,38,0.7)" }}
      >
        <span className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-primary" />}
          {title}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 pt-2" style={{ background: "rgba(18,24,38,0.5)" }}>{children}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
export default function Generator() {
  const [location]            = useLocation();
  const urlParams             = new URLSearchParams(location.split("?")[1] || "");
  const preselectedLottery    = urlParams.get("lottery") || "";

  const [generatedGames, setGeneratedGames]   = useState<GeneratedGame[]>([]);
  const [isGenerating, setIsGenerating]       = useState(false);
  const [loadingStep, setLoadingStep]         = useState(0);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [sharkRawGames, setSharkRawGames]     = useState<any[]>([]);
  const [pipelineResult, setPipelineResult]   = useState<any>(null);
  const [precisionMap, setPrecisionMap]       = useState<Record<string, PrecisionResult>>({});
  const [desdobramentoGames, setDesdobramentoGames] = useState<GeneratedGame[]>([]);
  const [showDesdobramento, setShowDesdobramento]   = useState(false);
  const [desdobramentoLimit, setDesdobramentoLimit] = useState<number | "">("");
  const [sharkDesdobramentoLimit, setSharkDesdobramentoLimit] = useState<number | "">(20);
  const [jogosInteligente, setJogosInteligente]     = useState<GeneratedGame[]>([]);
  const [showInteligente, setShowInteligente]       = useState(false);
  const [advancedMode, setAdvancedMode]             = useState(false);
  const [sharkPesos, setSharkPesos]   = useState<SharkPesos>({ frequencia: 0.5, atraso: 0.3, repeticao: 0.2 });
  const [sharkStats, setSharkStats]   = useState<ReturnType<typeof estatisticasGerais> | null>(null);
  const [relatorio, setRelatorio]     = useState<Relatorio>({});
  const [resultInput, setResultInput] = useState("");
  const [selectedLotteryId, setSelectedLotteryId] = useState(preselectedLottery);

  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { toast }         = useToast();
  const queryClient       = useQueryClient();
  const { data: lotteryTypes, isLoading: lotteriesLoading } = useLotteryTypes();
  const { data: frequenciesRaw } = useQuery({
    queryKey: ["/api/lotteries", selectedLotteryId, "frequency"],
    enabled: !!selectedLotteryId,
    select: (data: any) => {
      const arr  = Array.isArray(data) ? data : (data?.frequencies ?? []);
      const meta = Array.isArray(data) ? {} : (data?.meta ?? {});
      return { frequencies: arr, meta };
    },
  });
  const frequencies = frequenciesRaw?.frequencies ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { lotteryId: preselectedLottery, numbersCount: undefined, gamesCount: undefined, strategy: "shark" },
  });

  useEffect(() => {
    const sub = form.watch(v => { if (v.lotteryId && v.lotteryId !== selectedLotteryId) setSelectedLotteryId(v.lotteryId); });
    return () => sub.unsubscribe();
  }, [selectedLotteryId]);

  useEffect(() => { if (selectedLotteryId) { form.setValue("numbersCount", undefined as any); setSelectedNumbers([]); } }, [selectedLotteryId]);

  useEffect(() => {
    setSharkPesos(ajustarPesos());
    setSharkStats(estatisticasGerais());
    setRelatorio(gerarRelatorio());
  }, []);

  const selectedLottery = lotteryTypes?.find(l => l.id === selectedLotteryId);

  /* ── loading animation ─────────────────────────────── */
  const startLoading = () => {
    setLoadingStep(0);
    loadingIntervalRef.current = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length);
    }, 900);
  };
  const stopLoading = () => {
    if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
  };

  /* ── mutations ─────────────────────────────────────── */
  const generateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/v3/generate", {
        lotteryId: data.lotteryId,
        dezenas:   data.numbersCount,
        quantity:  data.gamesCount,
      });
      return res.json();
    },
    onSuccess: (resp) => {
      const games = resp.games || resp;
      setPipelineResult(resp.pipeline || null);
      setGeneratedGames(games.map((g: any) => ({
        numbers: g.selectedNumbers || g.numbers,
        strategy: g.strategy || "shark",
        confidence: g.confidence,
        sharkScore: g.sharkScore,
        sharkOrigem: g.sharkOrigem,
        sharkContexto: g.sharkContexto,
        rawGame: g,
      })));
      const freqEntries: FreqEntry[] = (frequenciesRaw?.frequencies ?? []).map((f: any) => ({
        number: f.number, frequency: f.frequency, temperature: f.temperature,
      }));
      const modalityId = games[0]?.lotteryId || form.getValues("lotteryId");
      const totalNums  = lotteryTypes?.find(l => l.id === modalityId)?.totalNumbers ?? 60;
      const newPrecision: Record<string, PrecisionResult> = {};
      games.forEach((g: any, i: number) => {
        const nums = (g.selectedNumbers || g.numbers) as number[];
        const pr   = calcularScorePrecisao(nums, freqEntries, modalityId, totalNums);
        newPrecision[String(i)] = pr;
        registrarDesempenho(g.sharkOrigem || g.strategy || "shark", pr.score);
      });
      setPrecisionMap(newPrecision);
      setSharkRawGames(games);
      setDesdobramentoGames([]);
      setShowDesdobramento(false);
      salvarJogos(
        games.map((g: any) => ({ jogo: g.selectedNumbers || g.numbers, score: g.sharkScore || 0, origem: g.sharkOrigem || "master" })),
        games[0]?.lotteryId || form.getValues("lotteryId"),
      );
      setSharkStats(estatisticasGerais());
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/games"] });
      toast({ title: `${games.length} jogo(s) gerado(s)`, description: "Salvo automaticamente." });
    },
    onError: () => toast({ title: "Erro ao gerar jogos", description: "Tente novamente.", variant: "destructive" }),
  });

  const desdobramentoMutation = useMutation({
    mutationFn: async ({ lotteryId, jogos, limite }: { lotteryId: string; jogos: any[]; limite: number }) => {
      const res = await apiRequest("POST", "/api/games/desdobramento", { lotteryId, jogos, limite });
      return res.json();
    },
    onSuccess: (data) => {
      const combos: GeneratedGame[] = (data.games || []).map((g: any) => ({
        numbers: g.selectedNumbers, strategy: "desdobramento-shark",
        confidence: g.confidence, sharkScore: g.sharkScore,
      }));
      setDesdobramentoGames(combos);
      setShowDesdobramento(true);
      toast({ title: `${data.totalCombinacoes} combinações geradas!` });
    },
    onError: () => toast({ title: "Erro no desdobramento", variant: "destructive" }),
  });

  /* ── submit ────────────────────────────────────────── */
  const onSubmit = async (data: FormValues) => {
    if (data.strategy === "manual") {
      if (selectedNumbers.length === 0) { toast({ title: "Selecione os números", variant: "destructive" }); return; }
      setGeneratedGames([{ numbers: selectedNumbers, strategy: "manual" }]);
      return;
    }
    if (data.strategy === "desdobramento") {
      if (!selectedLottery) { toast({ title: "Selecione a modalidade", variant: "destructive" }); return; }
      const min = selectedLottery.minNumbers;
      if (selectedNumbers.length < min) {
        toast({ title: "Selecione mais números", description: `Mínimo: ${min} dezenas.`, variant: "destructive" }); return;
      }
      const combos  = getCombinations(selectedNumbers, min);
      const limited = typeof desdobramentoLimit === "number" ? combos.slice(0, desdobramentoLimit) : combos;
      setGeneratedGames(limited.map(c => ({ numbers: c, strategy: "desdobramento" })));
      toast({ title: `${limited.length} combinações geradas` });
      return;
    }
    setIsGenerating(true);
    startLoading();
    try {
      await generateMutation.mutateAsync(data);
    } finally {
      stopLoading();
      setIsGenerating(false);
    }
  };

  const clearAll = () => {
    setGeneratedGames([]); setSharkRawGames([]); setDesdobramentoGames([]);
    setShowDesdobramento(false); setPrecisionMap({}); setPipelineResult(null);
  };

  const copyToClipboard = (numbers: number[]) => {
    navigator.clipboard.writeText(numbers.join(" - "));
    toast({ title: "Copiado!" });
  };

  const getNumberFrequency = (n: number) => (frequencies as any[]).find((f: any) => f.number === n);
  const toggleNumber = (n: number) => {
    if (!selectedLottery) return;
    setSelectedNumbers(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort((a, b) => a - b));
  };

  const strategy    = form.watch("strategy");
  const lotteryId   = form.watch("lotteryId");
  const isAdvanced  = strategy === "manual" || strategy === "desdobramento";
  const hasGames    = generatedGames.length > 0;
  const price       = LOTTERY_PRICES[selectedLotteryId] ?? 3.00;

  /* ─────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen text-foreground" style={{ background: "#0B0F19" }}>
      <Navigation />

      <main className="max-w-lg mx-auto px-4 pt-4 pb-32">

        {/* ── Header ───────────────────────────────────── */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest uppercase text-primary/70">SharkCore v3.0</span>
            </div>
            <h1 className="text-[22px] font-bold leading-tight text-white">Gerador Inteligente</h1>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground/60 block">14 engines</span>
            <span className="text-[10px] text-primary/50">IA unificada</span>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">

          {/* ── Config card ──────────────────────────────── */}
          <div
            className="rounded-2xl border border-white/10 p-4 space-y-3"
            style={{ background: "#121826" }}
          >
            {/* Modalidade */}
            <div className="space-y-2">
              <Label className="text-[14px] font-semibold text-foreground/90 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Modalidade
              </Label>
              <Select
                value={form.watch("lotteryId")}
                onValueChange={v => form.setValue("lotteryId", v)}
                disabled={lotteriesLoading}
              >
                <SelectTrigger className="h-12 text-[15px] rounded-xl" style={{ background: "#0B0F19", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <SelectValue placeholder="Selecione a modalidade" />
                </SelectTrigger>
                <SelectContent>
                  {lotteryTypes?.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.lotteryId && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.lotteryId.message}</p>
              )}
            </div>

            {/* Dezenas + Quantidade */}
            {!isAdvanced && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[14px] font-semibold text-foreground/90">
                    Dezenas
                    {selectedLottery && (
                      <span className="text-muted-foreground font-normal ml-1 text-xs">
                        (min {selectedLottery.minNumbers})
                      </span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    placeholder={selectedLottery?.minNumbers?.toString() ?? "—"}
                    {...form.register("numbersCount", { valueAsNumber: true })}
                    className="h-12 text-[15px] rounded-xl text-center"
                    style={{ background: "#0B0F19", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                  {form.formState.errors.numbersCount && (
                    <p className="text-destructive text-xs">{form.formState.errors.numbersCount.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-[14px] font-semibold text-foreground/90">
                    Jogos
                    <span className="text-muted-foreground font-normal ml-1 text-xs">(máx 100)</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="5"
                    min={1}
                    max={100}
                    {...form.register("gamesCount", { valueAsNumber: true })}
                    className="h-12 text-[15px] rounded-xl text-center"
                    style={{ background: "#0B0F19", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                </div>
              </div>
            )}

            {/* Advanced toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !advancedMode;
                setAdvancedMode(next);
                if (!next) form.setValue("strategy", "shark");
              }}
              className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {advancedMode ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Modo avançado (manual / desdobramento)
            </button>

            {advancedMode && (
              <div className="space-y-4 pt-1">
                <div className="space-y-2">
                  <Label className="text-[14px] font-semibold text-foreground/90">Modo</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["manual", "desdobramento"] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => form.setValue("strategy", s)}
                        className={`rounded-xl py-2.5 px-3 text-[13px] font-semibold border transition-all duration-200 text-left ${
                          strategy === s
                            ? "border-primary/60 bg-primary/10 text-primary"
                            : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20"
                        }`}
                      >
                        {s === "manual" ? "Escolha Manual" : "Desdobramento"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Number picker */}
                {isAdvanced && selectedLottery && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-foreground/80">
                        Cartela — {selectedLottery.displayName}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{selectedNumbers.length} selecionados</Badge>
                        {selectedNumbers.length > 0 && (
                          <button type="button" onClick={() => setSelectedNumbers([])} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {strategy === "desdobramento" && (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Limite combinações:</span>
                          <Input
                            type="number" min={1}
                            value={desdobramentoLimit}
                            onChange={e => setDesdobramentoLimit(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                            className="h-8 text-sm w-24 text-center"
                            style={{ background: "#0B0F19" }}
                          />
                          {selectedNumbers.length >= selectedLottery.minNumbers && (
                            <span className="text-xs text-emerald-400">
                              {binomial(selectedNumbers.length, selectedLottery.minNumbers).toLocaleString("pt-BR")} possíveis
                            </span>
                          )}
                        </div>
                        {selectedNumbers.length < selectedLottery.minNumbers && (
                          <p className="text-xs text-amber-400">
                            Selecione pelo menos {selectedLottery.minNumbers} dezenas
                            (faltam {selectedLottery.minNumbers - selectedNumbers.length})
                          </p>
                        )}
                      </>
                    )}

                    <div className="rounded-xl p-3 border border-white/10" style={{ background: "rgba(11,15,25,0.8)" }}>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {Array.from({ length: selectedLottery.totalNumbers }, (_, i) => {
                          const n    = i + 1;
                          const freq = getNumberFrequency(n);
                          return (
                            <NumberBall
                              key={n} number={n} size="xs"
                              onClick={() => toggleNumber(n)}
                              selected={selectedNumbers.includes(n)}
                              temperature={freq?.temperature as any}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-center gap-5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Quentes</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />Mornos</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Frios</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── CTA button ───────────────────────────────── */}
          <button
            type="submit"
            disabled={isGenerating || !lotteryId}
            className="w-full h-[54px] rounded-2xl text-[16px] font-bold tracking-wide transition-all duration-300 relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: isGenerating
                ? "rgba(0,229,168,0.15)"
                : "linear-gradient(135deg, #00c896 0%, #007aff 100%)",
              boxShadow: !isGenerating && lotteryId ? "0 0 32px rgba(0,200,150,0.35), 0 4px 20px rgba(0,0,0,0.4)" : "none",
              color: "#fff",
            }}
          >
            {isGenerating ? (
              <span className="flex flex-col items-center justify-center gap-1">
                <span className="flex items-center gap-2 text-[15px]">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {LOADING_STEPS[loadingStep]}
                </span>
                <span className="flex gap-1">
                  {LOADING_STEPS.map((_, i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                      style={{ background: i === loadingStep ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)" }}
                    />
                  ))}
                </span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                {isAdvanced && strategy === "manual"  ? <Target className="h-5 w-5" /> :
                 isAdvanced && strategy === "desdobramento" ? <Shuffle className="h-5 w-5" /> :
                 <Zap className="h-5 w-5" />}
                {isAdvanced && strategy === "manual"  ? "CONFIRMAR JOGO MANUAL" :
                 isAdvanced && strategy === "desdobramento" ? "GERAR DESDOBRAMENTO" :
                 "INICIAR ANÁLISE SHARKCORE"}
              </span>
            )}
          </button>

          {/* ── Como funciona (accordeon) ─────────────────── */}
          <Accordion title="Como funciona o SharkCore?" icon={Sparkles}>
            <div className="space-y-2 text-[14px] text-muted-foreground">
              {[
                { icon: BarChart3, text: "Analisa os últimos 30 sorteios reais da Caixa" },
                { icon: Brain,     text: "Gera e valida milhares de combinações candidatas" },
                { icon: Cpu,       text: "14 engines ativos: entropia, correlação, distribuição, tendência..." },
                { icon: CheckCircle2, text: "HyperScore classifica cada jogo de 0 a 1000" },
                { icon: TrendingUp, text: "Seleciona apenas os jogos com maior ROI esperado" },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </Accordion>
        </form>

        {/* ═══ RESULTS ════════════════════════════════════ */}
        {hasGames && (
          <div className="mt-4 space-y-3">

            {/* ── GameInsights ─────────────────────────────── */}
            {pipelineResult && (
              <GameInsightsCard
                pipeline={pipelineResult}
                game={generatedGames[0]?.rawGame}
              />
            )}

            {/* ── Games list header ────────────────────────── */}
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[17px] font-bold text-white">
                Jogos Gerados
                <span className="ml-2 text-sm font-normal text-muted-foreground">({generatedGames.length})</span>
              </h2>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar
              </button>
            </div>

            {/* ── Individual games ─────────────────────────── */}
            <div className="space-y-3">
              {generatedGames.map((game, index) => {
                const pr = precisionMap[String(index)];
                return (
                  <div
                    key={index}
                    className="rounded-2xl border border-white/10 p-4 space-y-3"
                    style={{ background: "#121826" }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-primary">Jogo #{index + 1}</span>
                        {pr && (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${getRankBgColor(pr.rank)}`}>
                            {getRankEmoji(pr.rank)} {pr.rank}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(game.numbers)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </button>
                    </div>

                    {/* Numbers */}
                    <div className="flex flex-wrap gap-1.5">
                      {game.numbers.map(n => {
                        const freq = getNumberFrequency(n);
                        return <NumberBall key={n} number={n} size="sm" temperature={freq?.temperature as any} />;
                      })}
                    </div>

                    {/* FORÇA DO JOGO */}
                    {pr && (
                      <div className="space-y-1.5 pt-1 border-t border-white/8">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Força do Jogo
                          </span>
                          <span className={`text-[15px] font-black tabular-nums ${getRankColor(pr.rank)}`}>
                            {pr.score}/100
                          </span>
                        </div>
                        <MiniScoreBar score={pr.score} />
                        {pr.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                            {pr.reasons.slice(0, 4).map((r, i) => (
                              <span key={i} className="text-[11px] text-emerald-400/80 flex items-center gap-1">
                                <CheckCircle2 className="h-2.5 w-2.5 shrink-0" /> {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Shark metadata (compact) */}
                    {game.sharkOrigem && (
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground pt-0.5">
                        <span>Origem: <span className="text-foreground/70 capitalize">{game.sharkOrigem}</span></span>
                        {game.sharkScore != null && <span>Score: <span className="text-foreground/70">{game.sharkScore}</span></span>}
                        {game.confidence   != null && <span>Confiança: <span className="text-foreground/70">{Math.round(game.confidence * 100)}%</span></span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Quick actions ─────────────────────────────── */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => window.location.href = "/heat-map"}
                className="flex-1 h-11 rounded-xl border border-white/15 text-[13px] font-semibold text-foreground/80 hover:border-primary/40 hover:text-primary transition-all"
                style={{ background: "rgba(18,24,38,0.8)" }}
              >
                <Flame className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                Mapa de Calor
              </button>
              <button
                type="button"
                onClick={() => window.location.href = "/results"}
                className="flex-1 h-11 rounded-xl border border-white/15 text-[13px] font-semibold text-foreground/80 hover:border-primary/40 hover:text-primary transition-all"
                style={{ background: "rgba(18,24,38,0.8)" }}
              >
                <Target className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                Verificar Resultados
              </button>
            </div>

            {/* ── Desdobramento automático (accordion) ─────── */}
            {sharkRawGames.length > 0 && (
              <Accordion title="Desdobramento Automático Shark" icon={Shuffle}>
                <div className="space-y-3">
                  <p className="text-[13px] text-muted-foreground">
                    Gera variações otimizadas combinando os melhores jogos gerados.
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Quantidade:</span>
                    <Input
                      type="number" min={1} max={500}
                      value={sharkDesdobramentoLimit}
                      onChange={e => setSharkDesdobramentoLimit(e.target.value === "" ? "" : Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="h-8 text-sm w-24 text-center"
                      style={{ background: "#0B0F19" }}
                    />
                    <span className="text-xs text-muted-foreground">máx. 500</span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      const limite = typeof sharkDesdobramentoLimit === "number" ? sharkDesdobramentoLimit : 500;
                      desdobramentoMutation.mutate({ lotteryId: form.getValues("lotteryId"), jogos: sharkRawGames, limite });
                    }}
                    disabled={desdobramentoMutation.isPending || sharkDesdobramentoLimit === ""}
                    className="w-full bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary"
                  >
                    {desdobramentoMutation.isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Gerando...</> : <><Shuffle className="h-4 w-4 mr-2" />Gerar Desdobramentos</>}
                  </Button>

                  {showDesdobramento && desdobramentoGames.length > 0 && (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {desdobramentoGames.map((g, i) => (
                        <div key={i} className="rounded-xl border border-white/8 p-2.5" style={{ background: "#0B0F19" }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-primary/80">#{i + 1}</span>
                            <button type="button" onClick={() => copyToClipboard(g.numbers)} className="text-muted-foreground hover:text-foreground">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1">{g.numbers.map(n => <NumberBall key={n} number={n} size="xs" />)}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Desdobramento Inteligente */}
                  {selectedLottery && (
                    <Button
                      type="button"
                      onClick={() => {
                        const min = selectedLottery!.minNumbers;
                        const res = desdobramentoInteligente(sharkRawGames, min, 50, 20);
                        if (res.total === 0) { toast({ title: "Gere mais jogos primeiro", variant: "destructive" }); return; }
                        setJogosInteligente(res.combinacoes.map(c => ({ numbers: c, strategy: "desdobramento-inteligente" })));
                        setShowInteligente(true);
                        toast({ title: `${res.total} combinações inteligentes geradas` });
                      }}
                      className="w-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300"
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      Desdobramento Inteligente
                    </Button>
                  )}

                  {showInteligente && jogosInteligente.length > 0 && (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {jogosInteligente.map((g, i) => (
                        <div key={i} className="rounded-xl border border-cyan-500/15 p-2.5" style={{ background: "#0B0F19" }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-cyan-400/80">#{i + 1}</span>
                            <button type="button" onClick={() => copyToClipboard(g.numbers)} className="text-muted-foreground hover:text-foreground">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1">{g.numbers.map(n => <NumberBall key={n} number={n} size="xs" />)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Accordion>
            )}

            {/* ── Shark Memory (accordion) ──────────────────── */}
            {sharkRawGames.length > 0 && (
              <Accordion title="Shark Memory & Aprendizado" icon={Brain}>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Pesos Aprendidos</p>
                    <div className="space-y-2">
                      {[
                        { label: "Frequência", value: sharkPesos.frequencia, color: "bg-yellow-400" },
                        { label: "Atraso",     value: sharkPesos.atraso,     color: "bg-orange-400" },
                        { label: "Repetição",  value: sharkPesos.repeticao,  color: "bg-primary"    },
                      ].map(p => (
                        <div key={p.label} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-20">{p.label}</span>
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${p.color}`} style={{ width: `${Math.round(p.value * 100)}%` }} />
                          </div>
                          <span className="text-xs text-white w-9 text-right">{Math.round(p.value * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {sharkStats && sharkStats.totalComAcertos > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { icon: BookOpen,  label: "Registrados", value: sharkStats.totalComAcertos },
                        { icon: Award,     label: "Média",       value: sharkStats.mediaGeral.toFixed(1) },
                        { icon: TrendingUp, label: "Melhor",     value: sharkStats.melhorAcerto },
                      ].map(s => (
                        <div key={s.label} className="rounded-xl p-2.5 text-center" style={{ background: "#0B0F19" }}>
                          <s.icon className="h-4 w-4 mx-auto mb-1 text-primary" />
                          <p className="text-base font-bold text-white">{s.value}</p>
                          <p className="text-[11px] text-muted-foreground">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Registrar resultado */}
                  <div className="rounded-xl border border-white/10 p-3 space-y-2" style={{ background: "#0B0F19" }}>
                    <p className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      Registrar Resultado Oficial
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ex: 5,12,23,34,45,58"
                        value={resultInput}
                        onChange={e => setResultInput(e.target.value)}
                        className="h-8 text-sm flex-1"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      />
                      <Button
                        type="button" size="sm"
                        className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs"
                        disabled={!resultInput.trim()}
                        onClick={() => {
                          const dezenas = resultInput.split(/[,\s]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
                          if (!dezenas.length) { toast({ title: "Formato inválido", variant: "destructive" }); return; }
                          const res = registrarResultadoOficial(dezenas, form.getValues("lotteryId"));
                          setSharkPesos(ajustarPesos());
                          setSharkStats(estatisticasGerais());
                          setRelatorio(gerarRelatorio());
                          setResultInput("");
                          toast({ title: `${res.registrados} jogo(s) avaliado(s) · Melhor: ${res.melhorAcerto} acertos` });
                        }}
                      >Registrar</Button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full text-xs text-red-400/70 hover:text-red-400 transition-colors flex items-center justify-center gap-1.5 py-1"
                    onClick={() => {
                      if (window.confirm("Apagar toda a memória do Shark?")) {
                        resetarMemoria();
                        setSharkPesos({ frequencia: 0.5, atraso: 0.3, repeticao: 0.2 });
                        setSharkStats(estatisticasGerais());
                        toast({ title: "Memória resetada" });
                      }
                    }}
                  >
                    <RotateCcw className="h-3 w-3" /> Resetar memória do Shark
                  </button>
                </div>
              </Accordion>
            )}
          </div>
        )}

        {/* Empty state */}
        {!hasGames && !isGenerating && (
          <div className="text-center py-8 space-y-2">
            <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(0,229,168,0.08)" }}>
              <Zap className="h-5 w-5 text-primary/50" />
            </div>
            <p className="text-[14px] text-muted-foreground">Configure acima e toque em Iniciar</p>
            <p className="text-[12px] text-muted-foreground/50">O SharkCore cuidará de tudo</p>
          </div>
        )}
      </main>

    </div>
  );
}
