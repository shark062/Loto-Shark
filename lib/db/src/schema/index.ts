import { pgTable, text, serial, integer, numeric, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userGamesTable = pgTable("user_games", {
  id: serial("id").primaryKey(),
  lotteryId: text("lottery_id").notNull(),
  selectedNumbers: jsonb("selected_numbers").notNull().$type<number[]>(),
  strategy: text("strategy").notNull().default("mixed"),
  confidence: numeric("confidence"),
  reasoning: text("reasoning"),
  dataSource: text("data_source"),
  sharkScore: numeric("shark_score"),
  sharkOrigem: text("shark_origem"),
  sharkContexto: jsonb("shark_contexto"),
  matches: integer("matches").notNull().default(0),
  prizeWon: text("prize_won").notNull().default("0"),
  contestNumber: integer("contest_number"),
  status: text("status").notNull().default("pending"),
  hits: integer("hits").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserGameSchema = createInsertSchema(userGamesTable).omit({ id: true, createdAt: true });
export type InsertUserGame = z.infer<typeof insertUserGameSchema>;
export type UserGame = typeof userGamesTable.$inferSelect;

export const aiProvidersTable = pgTable("ai_providers", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  apiKey: text("api_key").notNull(),
  model: text("model").notNull(),
  baseUrl: text("base_url").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  successRate: numeric("success_rate").notNull().default("0.7"),
  totalCalls: integer("total_calls").notNull().default(0),
  successCalls: integer("success_calls").notNull().default(0),
  avgLatencyMs: numeric("avg_latency_ms").notNull().default("0"),
  lastUsed: text("last_used"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AiProvider = typeof aiProvidersTable.$inferSelect;

export const lotteryDrawsCache = pgTable('lottery_draws_cache', {
  id: serial('id').primaryKey(),
  lotteryId: text('lottery_id').notNull().unique(),
  draws: jsonb('draws').notNull().$type<number[][]>(),
  latestContest: integer('latest_contest').notNull().default(0),
  fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
  drawCount: integer('draw_count').notNull().default(0),
});

// ── Fase 1: Contest Snapshots ──────────────────────────────────
// Armazena snapshots completos de cada geração (para rastreabilidade e backtest)
export const contestSnapshotsTable = pgTable('contest_snapshots', {
  id: text('id').primaryKey(),
  modality: text('modality').notNull(),
  contestNumber: integer('contest_number').notNull(),
  contestDate: text('contest_date').notNull(),
  generatedAt: timestamp('generated_at').notNull().defaultNow(),
  algorithmVersion: text('algorithm_version').notNull().default('2.1.0'),
  aiVersion: text('ai_version').notNull().default('ensemble-v1'),
  generationHash: text('generation_hash').notNull(),
  gamesCount: integer('games_count').notNull().default(0),
  strategy: text('strategy').notNull().default('mixed'),
  statisticsSnapshot: jsonb('statistics_snapshot').$type<Record<string, any>>(),
  filtersSnapshot: jsonb('filters_snapshot').$type<Record<string, any>>(),
  backtestResult: jsonb('backtest_result').$type<Record<string, any>>(),
  pipelineVersion: text('pipeline_version').notNull().default('v1'),
});

export type ContestSnapshot = typeof contestSnapshotsTable.$inferSelect;

// ── Fase 15: Audit Log (persistência no banco) ────────────────
// Complementa o audit logger em memória com persistência de eventos críticos
export const auditLogsTable = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  modality: text('modality'),
  contestNumber: integer('contest_number'),
  algorithmVersion: text('algorithm_version'),
  generationHash: text('generation_hash'),
  gamesCount: integer('games_count'),
  score: integer('score'),
  aiUsed: text('ai_used'),
  latencyMs: integer('latency_ms'),
  success: boolean('success').default(true),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;

// ── Fase 14: Stats Cache (persistência de estatísticas computadas) ──
export const statsCacheTable = pgTable('stats_cache', {
  id: serial('id').primaryKey(),
  lotteryId: text('lottery_id').notNull(),
  drawCount: integer('draw_count').notNull(),
  computedAt: timestamp('computed_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  frequencyMap: jsonb('frequency_map').$type<Record<string, number>>(),
  delayMap: jsonb('delay_map').$type<Record<string, number>>(),
  hotNumbers: jsonb('hot_numbers').$type<number[]>(),
  coldNumbers: jsonb('cold_numbers').$type<number[]>(),
  warmNumbers: jsonb('warm_numbers').$type<number[]>(),
  avgSum: numeric('avg_sum'),
  avgEvens: numeric('avg_evens'),
  cycleData: jsonb('cycle_data').$type<Record<string, any>>(),
  coverageScore: integer('coverage_score'),
});
