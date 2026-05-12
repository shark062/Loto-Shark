import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Database, Globe, Brain, Zap, Activity, AlertTriangle, CheckCircle2, Clock, HardDrive } from "lucide-react";

interface ProviderStatus {
  id: string;
  name: string;
  type: string;
  model: string;
  enabled: boolean;
  status: "healthy" | "degraded" | "failing" | "disabled" | "standby";
  successRate: number;
  totalCalls: number;
  successCalls: number;
  avgLatencyMs: number;
  lastUsed: string | null;
  lastError: string | null;
  priority: number;
}

interface HealthData {
  timestamp: string;
  overall: "operational" | "degraded";
  services: {
    database: { status: string; latencyMs: number; note: string | null };
    caixaApi: { status: string; latencyMs: number; note: string | null };
    drawCache: { status: string; entries: number };
  };
  aiProviders: {
    summary: { total: number; active: number; inactive: number };
    providers: ProviderStatus[];
  };
}

function statusColor(status: string): string {
  switch (status) {
    case "healthy": case "operational": case "active": return "#00E5A8";
    case "degraded": case "blocked": return "#F59E0B";
    case "failing": case "unreachable": return "#EF4444";
    case "standby": return "#00D2FF";
    case "disabled": return "#64748B";
    default: return "#64748B";
  }
}

function StatusDot({ status }: { status: string }) {
  const color = statusColor(status);
  const pulse = ["healthy", "operational", "active"].includes(status);
  return (
    <span
      style={{
        display: "inline-block",
        width: 8, height: 8,
        borderRadius: "50%",
        background: color,
        boxShadow: pulse ? `0 0 8px ${color}` : "none",
        animation: pulse ? "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" : "none",
        flexShrink: 0,
      }}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = statusColor(status);
  const label: Record<string, string> = {
    healthy: "OK", operational: "Operacional", active: "Ativo",
    degraded: "Degradado", blocked: "Bloqueado",
    failing: "Falha", unreachable: "Inatingível",
    standby: "Standby", disabled: "Desativado", unknown: "Desconhecido",
  };
  return (
    <span
      style={{
        fontSize: 10, fontWeight: 700, padding: "2px 8px",
        borderRadius: 999, border: `1px solid ${color}40`,
        color, background: `${color}15`,
        textTransform: "uppercase", letterSpacing: 1,
      }}
    >
      {label[status] || status}
    </span>
  );
}

function formatLatency(ms: number): string {
  if (ms === 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Nunca";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "Agora mesmo";
  if (diff < 3600000) return `${Math.round(diff / 60000)}min atrás`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h atrás`;
  return `${Math.round(diff / 86400000)}d atrás`;
}

const TYPE_ICONS: Record<string, string> = {
  openai: "⚡", anthropic: "🧠", groq: "🚀", deepseek: "🔬",
  gemini: "✨", openrouter: "🌐", mistral: "💫", cohere: "🔷",
};

export default function APIStatus() {
  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery<HealthData>({
    queryKey: ["/api/health/providers"],
    queryFn: async () => {
      const r = await fetch("/api/health/providers");
      if (!r.ok) throw new Error("Falha ao buscar status");
      return r.json();
    },
    refetchInterval: 30 * 1000,
    staleTime: 20 * 1000,
  });

  const BG = "#0B0F19";
  const SURFACE = "#121826";
  const CARD = "#182235";

  return (
    <div className="min-h-screen text-foreground" style={{ background: BG }}>
      <Navigation />
      <main className="max-w-lg mx-auto px-4 pt-4 pb-32">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Activity className="h-3.5 w-3.5" style={{ color: "#00D2FF" }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#00D2FF80" }}>
                Sistema
              </span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>Status da API</h1>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, color: "#00D2FF",
              background: "rgba(0,210,255,0.08)",
              border: "1px solid rgba(0,210,255,0.2)",
              borderRadius: 10, padding: "6px 12px",
              cursor: "pointer", opacity: isLoading ? 0.5 : 1,
            }}
          >
            <RefreshCw style={{ width: 14, height: 14, animation: isLoading ? "spin 1s linear infinite" : "none" }} />
            Atualizar
          </button>
        </div>

        {/* Overall status */}
        {data && (
          <div
            style={{
              borderRadius: 16, padding: "14px 16px", marginBottom: 16,
              background: SURFACE, border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StatusDot status={data.overall} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  {data.overall === "operational" ? "Todos os sistemas operacionais" : "Degradação parcial detectada"}
                </div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                  Atualizado: {formatRelative(data.timestamp)}
                </div>
              </div>
            </div>
            <StatusBadge status={data.overall} />
          </div>
        )}

        {/* Loading */}
        {isLoading && !data && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <RefreshCw style={{ width: 24, height: 24, margin: "0 auto 8px", color: "#00D2FF", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 14, color: "#64748B" }}>Verificando serviços...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ borderRadius: 12, padding: 14, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#EF4444", fontSize: 13, fontWeight: 600 }}>
              <AlertTriangle style={{ width: 16, height: 16 }} />
              Não foi possível carregar o status
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Services */}
            <div style={{ borderRadius: 16, background: SURFACE, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 16, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  <Globe style={{ width: 14, height: 14, color: "#00D2FF" }} />
                  Serviços de Infraestrutura
                </div>
              </div>
              <div style={{ padding: "4px 0" }}>
                {/* Database */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Database style={{ width: 14, height: 14, color: "#64748B" }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Banco de Dados Neon</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>PostgreSQL via Drizzle ORM</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#64748B" }}>{formatLatency(data.services.database.latencyMs)}</span>
                    <StatusBadge status={data.services.database.status} />
                  </div>
                </div>

                {/* Caixa API */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Globe style={{ width: 14, height: 14, color: "#64748B" }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>API Caixa Econômica</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>
                        {data.services.caixaApi.note || "Resultados oficiais dos sorteios"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#64748B" }}>{formatLatency(data.services.caixaApi.latencyMs)}</span>
                    <StatusBadge status={data.services.caixaApi.status} />
                  </div>
                </div>

                {/* Draw cache */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <HardDrive style={{ width: 14, height: 14, color: "#64748B" }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Cache de Sorteios</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>
                        {data.services.drawCache.entries} {data.services.drawCache.entries === 1 ? "entrada" : "entradas"} em memória
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={data.services.drawCache.status} />
                </div>
              </div>
            </div>

            {/* AI Providers */}
            <div style={{ borderRadius: 16, background: SURFACE, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  <Brain style={{ width: 14, height: 14, color: "#00D2FF" }} />
                  Providers de IA
                </div>
                <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#64748B" }}>
                  <span style={{ color: "#00E5A8" }}>{data.aiProviders.summary.active} ativos</span>
                  <span>·</span>
                  <span>{data.aiProviders.summary.total} total</span>
                </div>
              </div>

              <div style={{ padding: "4px 0" }}>
                {data.aiProviders.providers
                  .sort((a, b) => a.priority - b.priority)
                  .map((p, i) => (
                    <div
                      key={p.id}
                      style={{
                        padding: "10px 16px",
                        borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                        opacity: p.status === "disabled" ? 0.5 : 1,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: p.totalCalls > 0 ? 8 : 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{TYPE_ICONS[p.type] || "🔷"}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>{p.model}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <StatusDot status={p.status} />
                          <StatusBadge status={p.status} />
                        </div>
                      </div>

                      {p.totalCalls > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 4 }}>
                          {[
                            { label: "Taxa sucesso", value: `${p.successRate}%`, color: p.successRate >= 70 ? "#00E5A8" : p.successRate >= 40 ? "#F59E0B" : "#EF4444" },
                            { label: "Latência", value: formatLatency(p.avgLatencyMs), color: "#fff" },
                            { label: "Último uso", value: formatRelative(p.lastUsed), color: "#64748B" },
                          ].map(m => (
                            <div key={m.label} style={{ background: CARD, borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.value}</div>
                              <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>{m.label}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {p.totalCalls > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 10, color: "#64748B" }}>
                            <span>Taxa de sucesso</span>
                            <span>{p.successCalls}/{p.totalCalls} chamadas</span>
                          </div>
                          <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 99,
                              width: `${p.successRate}%`,
                              background: p.successRate >= 70 ? "#00E5A8" : p.successRate >= 40 ? "#F59E0B" : "#EF4444",
                              transition: "width 0.6s ease",
                            }} />
                          </div>
                        </div>
                      )}

                      {p.lastError && (
                        <div style={{ marginTop: 6, fontSize: 10, color: "#EF444480", padding: "4px 8px", background: "rgba(239,68,68,0.06)", borderRadius: 6 }}>
                          ⚠ {p.lastError}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#3a4a5a" }}>
              Atualização automática a cada 30s · {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR") : "—"}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
