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
