import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { listProviders } from "../lib/aiProviders";
import { getDrawCacheStats } from "../lib/drawCacheEngine";
import { db } from "@workspace/db";
import { Request, Response } from "express";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// GET /api/health/providers — status detalhado de todos os providers de IA + serviços externos
router.get("/health/providers", async (_req: Request, res: Response) => {
  try {
    const { providers, stats } = listProviders();

    const providerList = providers.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      model: p.model,
      enabled: p.enabled,
      priority: p.priority,
      successRate: Math.round(p.successRate * 100),
      totalCalls: p.totalCalls,
      successCalls: p.successCalls,
      avgLatencyMs: Math.round(p.avgLatencyMs),
      lastUsed: p.lastUsed,
      lastError: p.lastError ? p.lastError.slice(0, 120) : null,
      status: !p.enabled
        ? "disabled"
        : p.totalCalls === 0
        ? "standby"
        : p.successRate >= 0.7
        ? "healthy"
        : p.successRate >= 0.4
        ? "degraded"
        : "failing",
    }));

    // Verifica conexão com banco de dados
    let dbStatus = "unknown";
    let dbLatencyMs = 0;
    try {
      const dbStart = Date.now();
      await (db as any).execute("SELECT 1 AS ok");
      dbLatencyMs = Date.now() - dbStart;
      dbStatus = "healthy";
    } catch {
      dbStatus = "failing";
    }

    // Cache de sorteios (in-memory)
    const cacheStats = getDrawCacheStats();

    // Verifica Caixa API (timeout 5s)
    let caixaStatus = "unknown";
    let caixaLatencyMs = 0;
    try {
      const caixaStart = Date.now();
      const r = await fetch("https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena", {
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(5000),
      });
      caixaLatencyMs = Date.now() - caixaStart;
      const ct = r.headers.get("content-type") || "";
      caixaStatus = r.ok && ct.includes("json") ? "healthy" : "blocked";
    } catch {
      caixaStatus = "unreachable";
    }

    const overallStatus =
      dbStatus === "healthy" && stats.active > 0 ? "operational" : "degraded";

    res.json({
      timestamp: new Date().toISOString(),
      overall: overallStatus,
      services: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          note: dbStatus !== "healthy" ? "Verifique NEON_DATABASE_URL" : null,
        },
        caixaApi: {
          status: caixaStatus,
          latencyMs: caixaLatencyMs,
          note: caixaStatus !== "healthy"
            ? "Usando cache Neon como fallback (TTL 4h)"
            : null,
        },
        drawCache: {
          status: "active",
          entries: cacheStats.totalEntries,
        },
      },
      aiProviders: {
        summary: stats,
        providers: providerList,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Falha ao coletar status", detail: err?.message });
  }
});

export default router;
