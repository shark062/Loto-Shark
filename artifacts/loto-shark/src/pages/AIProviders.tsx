import { useState, useEffect } from "react";
import { Brain, Plus, Trash2, TestTube, CheckCircle, XCircle,
         TrendingUp, Zap, Shield, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NeonCard } from "@/components/NeonCard";
import Navigation from "@/components/Navigation";

// ── Tipos ────────────────────────────────────────────────────

type AIProviderType =
  | "openai" | "anthropic" | "gemini" | "deepseek"
  | "groq" | "mistral" | "cohere" | "together" | "openrouter" | "custom";

interface ProviderConfig {
  id: string;
  type: AIProviderType;
  name: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
  enabled: boolean;
  priority: number;
  totalCalls: number;
  successCalls: number;
  successRate: number;
  avgLatencyMs: number;
  lastUsed?: string;
  lastError?: string;
}

interface EvolutionEntry {
  timestamp: string;
  providerName: string;
  action: string;
  latencyMs?: number;
  details?: string;
}

// ── Constantes ────────────────────────────────────────────────

const PROVIDER_TYPES: { type: AIProviderType; label: string; color: string; models: string[] }[] = [
  {
    type: "openai",
    label: "OpenAI",
    color: "text-green-400",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  },
  {
    type: "anthropic",
    label: "Anthropic (Claude)",
    color: "text-orange-400",
    models: ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307", "claude-3-opus-20240229"],
  },
  {
    type: "gemini",
    label: "Google Gemini",
    color: "text-blue-400",
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"],
  },
  {
    type: "deepseek",
    label: "DeepSeek",
    color: "text-purple-400",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    type: "groq",
    label: "Groq (Ultra-rápido)",
    color: "text-yellow-400",
    models: ["llama-3.1-8b-instant", "llama-3.1-70b-versatile", "mixtral-8x7b-32768"],
  },
  {
    type: "mistral",
    label: "Mistral",
    color: "text-red-400",
    models: ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"],
  },
  {
    type: "openrouter",
    label: "OpenRouter (Multi-modelo)",
    color: "text-cyan-400",
    models: ["openai/gpt-4o-mini", "anthropic/claude-3-haiku", "google/gemini-flash-1.5", "meta-llama/llama-3.1-8b-instruct:free"],
  },
  {
    type: "custom",
    label: "API Custom (OpenAI-compatível)",
    color: "text-gray-400",
    models: ["gpt-3.5-turbo"],
  },
];

const ACTION_ICONS: Record<string, string> = {
  call: "📡",
  success: "✅",
  error: "❌",
  promoted: "⬆️",
  demoted: "⬇️",
};

// ── Componente principal ──────────────────────────────────────

export default function AIProviders() {
  const [providers, setProviders]       = useState<ProviderConfig[]>([]);
  const [evolutionLog, setEvolutionLog] = useState<EvolutionEntry[]>([]);
  const [stats, setStats]               = useState<any>(null);
  const [showForm, setShowForm]         = useState(false);
  const [showLog, setShowLog]           = useState(false);
  const [testing, setTesting]           = useState<string | null>(null);
  const [testResult, setTestResult]     = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [loading, setLoading]           = useState(false);

  // Formulário
  const [form, setForm] = useState({
    type: "openai" as AIProviderType,
    name: "",
    apiKey: "",
    model: "gpt-4o-mini",
    baseUrl: "",
  });

  // ── Fetch ──────────────────────────────────────────────────

  const fetchData = async () => {
    try {
      const [provRes, logRes] = await Promise.all([
        fetch("/api/ai-providers"),
        fetch("/api/ai-providers/evolution?limit=30"),
      ]);
      const provData = await provRes.json();
      const logData  = await logRes.json();
      setProviders(provData.providers || []);
      setStats(provData.stats);
      setEvolutionLog(logData.log || []);
    } catch (e) {
      console.error("Erro ao carregar providers:", e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // atualiza a cada 30s
    return () => clearInterval(interval);
  }, []);

  // ── Ações ──────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!form.name || !form.apiKey) return;
    setLoading(true);
    try {
      await fetch("/api/ai-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ type: "openai", name: "", apiKey: "", model: "gpt-4o-mini", baseUrl: "" });
      setShowForm(false);
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await fetch(`/api/ai-providers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    await fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este provider?")) return;
    await fetch(`/api/ai-providers/${id}`, { method: "DELETE" });
    await fetchData();
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const res = await fetch(`/api/ai-providers/${id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult((prev) => ({
        ...prev,
        [id]: { ok: data.success, msg: data.success ? `OK ${data.latencyMs}ms` : data.error },
      }));
    } catch (e: any) {
      setTestResult((prev) => ({ ...prev, [id]: { ok: false, msg: e.message } }));
    } finally {
      setTesting(null);
    }
  };

  const typeInfo = (type: AIProviderType) =>
    PROVIDER_TYPES.find((t) => t.type === type);

  const onTypeChange = (type: AIProviderType) => {
    const info = PROVIDER_TYPES.find((t) => t.type === type);
    setForm((f) => ({ ...f, type, model: info?.models[0] || "" }));
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <>
      <Navigation />
      <div className="container mx-auto px-4 py-6 max-w-4xl">

      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Brain className="text-cyan-400 w-5 h-5" />
          <h1 className="text-2xl font-bold text-white">Provedores de IA</h1>
        </div>
        <p className="text-sm text-gray-400 mb-3">
          Configure qualquer IA — o sistema aprende qual é a melhor automaticamente
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="ghost" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            className="bg-cyan-600 hover:bg-cyan-500 text-white"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar IA
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Providers", value: stats.total, icon: Shield, color: "text-blue-400" },
            { label: "Ativos", value: stats.active, icon: Zap, color: "text-green-400" },
            { label: "Melhor IA", value: stats.best, icon: TrendingUp, color: "text-yellow-400" },
            { label: "Chamadas", value: stats.totalCalls, icon: Brain, color: "text-purple-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <NeonCard key={label} className="p-3 text-center">
              <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
              <div className="text-lg font-bold text-white">{value}</div>
              <div className="text-xs text-gray-400">{label}</div>
            </NeonCard>
          ))}
        </div>
      )}

      {/* Formulário de adição */}
      {showForm && (
        <NeonCard className="mb-6 border border-cyan-500/30">
          <h2 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nova IA
          </h2>
          <div className="space-y-3">
            {/* Tipo */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Provedor</label>
              <select
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                value={form.type}
                onChange={(e) => onTypeChange(e.target.value as AIProviderType)}
              >
                {PROVIDER_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Nome */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nome (para identificar)</label>
              <input
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="Ex: Minha OpenAI, GPT Principal..."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* API Key */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Chave de API</label>
              <input
                type="password"
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono"
                placeholder="sk-... ou AI... ou gsk_..."
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              />
              <p className="text-xs text-yellow-500/70 mt-1 flex items-center gap-1">
                🔒 Após salvar, a chave não pode ser visualizada ou editada — apenas excluída.
              </p>
            </div>

            {/* Modelo */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Modelo</label>
              <select
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              >
                {typeInfo(form.type)?.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Base URL (somente custom/openrouter) */}
            {(form.type === "custom" || form.type === "openrouter") && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">URL Base da API</label>
                <input
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono"
                  placeholder="https://sua-api.com/v1"
                  value={form.baseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 bg-cyan-600 hover:bg-cyan-500"
                onClick={handleAdd}
                disabled={loading || !form.name || !form.apiKey}
              >
                {loading ? "Salvando..." : "Salvar Provider"}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </NeonCard>
      )}

      {/* Lista de Providers */}
      {providers.length === 0 ? (
        <NeonCard className="text-center py-12">
          <Brain className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhum provider configurado.</p>
          <p className="text-gray-500 text-sm mt-1">
            Adicione sua primeira chave de API acima.
          </p>
        </NeonCard>
      ) : (
        <div className="space-y-3">
          {providers.map((p) => {
            const info = typeInfo(p.type);
            const result = testResult[p.id];
            return (
              <NeonCard
                key={p.id}
                className={`border ${p.enabled ? "border-white/10" : "border-white/5 opacity-60"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-black/40 ${info?.color}`}>
                        {info?.label || p.type}
                      </span>
                      <span className="text-white font-medium text-sm truncate">{p.name}</span>
                      {p.priority === 1 && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                          ⭐ Melhor
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">{p.model}</div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>🎯 {Math.round(p.successRate * 100)}% sucesso</span>
                      <span>⚡ {Math.round(p.avgLatencyMs)}ms</span>
                      <span>📡 {p.totalCalls} chamadas</span>
                      {p.priority && <span>🏆 #{p.priority}</span>}
                    </div>
                    {/* Chave mascarada — nunca exibida completa */}
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs font-mono text-gray-500 bg-black/30 px-2 py-0.5 rounded">
                        🔒 {p.apiKey}
                      </span>
                    </div>
                    {result && (
                      <div className={`flex items-center gap-1 mt-1 text-xs ${result.ok ? "text-green-400" : "text-red-400"}`}>
                        {result.ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {result.msg}
                      </div>
                    )}
                    {p.lastError && !result && (
                      <div className="text-xs text-red-400 mt-1 truncate">
                        Último erro: {p.lastError}
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-2 items-end shrink-0">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={testing === p.id || !p.enabled}
                        onClick={() => handleTest(p.id)}
                      >
                        {testing === p.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <TestTube className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
                        onClick={() => handleDelete(p.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <button
                      onClick={() => handleToggle(p.id, p.enabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        p.enabled ? "bg-cyan-600" : "bg-gray-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          p.enabled ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </NeonCard>
            );
          })}
        </div>
      )}

      {/* Log Evolutivo */}
      {evolutionLog.length > 0 && (
        <div className="mt-6">
          <button
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-3"
            onClick={() => setShowLog(!showLog)}
          >
            <TrendingUp className="w-4 h-4" />
            Log Evolutivo ({evolutionLog.length} entradas)
            {showLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showLog && (
            <NeonCard className="max-h-64 overflow-y-auto">
              <div className="space-y-1">
                {evolutionLog.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-white/5">
                    <span>{ACTION_ICONS[entry.action] || "•"}</span>
                    <span className="text-gray-500 shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString("pt-BR")}
                    </span>
                    <span className="text-cyan-400 shrink-0">{entry.providerName}</span>
                    <span className="text-gray-400">{entry.action}</span>
                    {entry.latencyMs && (
                      <span className="text-green-400">{entry.latencyMs}ms</span>
                    )}
                    {entry.details && (
                      <span className="text-gray-500 truncate">{entry.details}</span>
                    )}
                  </div>
                ))}
              </div>
            </NeonCard>
          )}
        </div>
      )}
    </div>
    </>
  );
}
