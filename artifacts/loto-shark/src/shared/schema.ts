import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  password: varchar("password"), // hashed password for JWT auth
  role: varchar("role").default("FREE"), // "FREE" | "PREMIUM"
  subscriptionExpires: timestamp("subscription_expires"), // for premium expiry
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Lottery types table
export const lotteryTypes = pgTable("lottery_types", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  displayName: varchar("display_name").notNull(),
  minNumbers: integer("min_numbers").notNull(),
  maxNumbers: integer("max_numbers").notNull(),
  totalNumbers: integer("total_numbers").notNull(),
  drawDays: text("draw_days").array(),
  drawTime: varchar("draw_time"),
  isActive: boolean("is_active").default(true),
});

// Lottery draws table
export const lotteryDraws = pgTable("lottery_draws", {
  id: serial("id").primaryKey(),
  lotteryId: varchar("lottery_id").references(() => lotteryTypes.id),
  contestNumber: integer("contest_number").notNull(),
  drawDate: timestamp("draw_date").notNull(),
  drawnNumbers: integer("drawn_numbers").array(),
  prizeAmount: decimal("prize_amount", { precision: 15, scale: 2 }),
  winners: jsonb("winners"), // Array of winner objects with prize tiers
  isOfficial: boolean("is_official").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_draws_lottery_date").on(table.lotteryId, table.drawDate),
  index("idx_draws_contest").on(table.lotteryId, table.contestNumber),
]);

// User generated games table
export const userGames = pgTable("user_games", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  lotteryId: varchar("lottery_id").references(() => lotteryTypes.id),
  selectedNumbers: integer("selected_numbers").array(),
  contestNumber: integer("contest_number"),
  strategy: varchar("strategy"), // "hot", "cold", "mixed", "ai"
  isPlayed: boolean("is_played").default(false),
  matches: integer("matches").default(0),
  prizeWon: decimal("prize_won", { precision: 15, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_user_games_user").on(table.userId),
  index("idx_user_games_lottery").on(table.lotteryId),
]);

// Number frequency tracking
export const numberFrequency = pgTable("number_frequency", {
  id: serial("id").primaryKey(),
  lotteryId: varchar("lottery_id").references(() => lotteryTypes.id),
  number: integer("number").notNull(),
  frequency: integer("frequency").default(0),
  lastDrawn: timestamp("last_drawn"),
  temperature: varchar("temperature"), // "hot", "warm", "cold"
  drawsSinceLastSeen: integer("draws_since_last_seen").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_freq_lottery_num").on(table.lotteryId, table.number),
]);

// AI analysis results
export const aiAnalysis = pgTable("ai_analysis", {
  id: serial("id").primaryKey(),
  lotteryId: varchar("lottery_id").references(() => lotteryTypes.id),
  analysisType: varchar("analysis_type"), // "pattern", "prediction", "strategy"
  result: jsonb("result"),
  confidence: decimal("confidence", { precision: 5, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// User preferences and settings
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  favoriteLotteries: text("favorite_lotteries").array(),
  defaultStrategy: varchar("default_strategy").default("mixed"),
  notificationsEnabled: boolean("notifications_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ===== SISTEMA DE MÉTRICAS DE PERFORMANCE =====

// Predições do sistema para avaliação posterior
export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  lotteryId: varchar("lottery_id").references(() => lotteryTypes.id),
  contestNumber: integer("contest_number").notNull(),
  modelName: varchar("model_name").notNull(), // "aiService", "advancedAI", "temporal", etc.
  strategy: varchar("strategy").notNull(), // "balanced", "hot", "fibonacci", etc.
  predictedNumbers: integer("predicted_numbers").array().notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }),
  metadata: jsonb("metadata"), // informações adicionais sobre a predição
  actualNumbers: integer("actual_numbers").array(), // preenchido quando sai o resultado
  matches: integer("matches"), // quantos números acertou
  accuracy: decimal("accuracy", { precision: 5, scale: 4 }), // % de acerto
  isEvaluated: boolean("is_evaluated").default(false),
  evaluatedAt: timestamp("evaluated_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Índice único para evitar predições duplicadas
  index("unique_prediction").on(table.lotteryId, table.contestNumber, table.modelName, table.strategy)
]);

// Performance histórica dos modelos
export const modelPerformance = pgTable("model_performance", {
  id: serial("id").primaryKey(),
  modelName: varchar("model_name").notNull(),
  lotteryId: varchar("lottery_id").references(() => lotteryTypes.id),
  totalPredictions: integer("total_predictions").default(0),
  totalCorrectPredictions: integer("total_correct_predictions").default(0),
  averageAccuracy: decimal("average_accuracy", { precision: 5, scale: 4 }),
  averageConfidence: decimal("average_confidence", { precision: 5, scale: 4 }),
  bestAccuracy: decimal("best_accuracy", { precision: 5, scale: 4 }),
  worstAccuracy: decimal("worst_accuracy", { precision: 5, scale: 4 }),
  lastEvaluationDate: timestamp("last_evaluation_date"),
  performanceGrade: varchar("performance_grade"), // "A", "B", "C", "D", "F"
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Comparação de estratégias
export const strategyComparison = pgTable("strategy_comparison", {
  id: serial("id").primaryKey(),
  strategyA: varchar("strategy_a").notNull(),
  strategyB: varchar("strategy_b").notNull(),
  lotteryId: varchar("lottery_id").references(() => lotteryTypes.id),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  strategyAWins: integer("strategy_a_wins").default(0),
  strategyBWins: integer("strategy_b_wins").default(0),
  draws: integer("draws").default(0),
  winnerStrategy: varchar("winner_strategy"),
  significanceLevel: decimal("significance_level", { precision: 5, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Logs de versionamento dos modelos
export const modelVersions = pgTable("model_versions", {
  id: serial("id").primaryKey(),
  modelName: varchar("model_name").notNull(),
  version: varchar("version").notNull(),
  changes: text("changes").notNull(),
  performanceImprovement: decimal("performance_improvement", { precision: 5, scale: 4 }),
  isProduction: boolean("is_production").default(false),
  backupData: jsonb("backup_data"), // backup dos parâmetros anteriores
  deployedAt: timestamp("deployed_at").defaultNow(),
  deployedBy: varchar("deployed_by").default("system"),
});

// Backtesting - testes em dados históricos
export const backtestResults = pgTable("backtest_results", {
  id: serial("id").primaryKey(),
  testName: varchar("test_name").notNull(),
  modelName: varchar("model_name").notNull(),
  lotteryId: varchar("lottery_id").references(() => lotteryTypes.id),
  strategy: varchar("strategy").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  totalTests: integer("total_tests").notNull(),
  successfulPredictions: integer("successful_predictions").default(0),
  averageAccuracy: decimal("average_accuracy", { precision: 5, scale: 4 }),
  profitability: decimal("profitability", { precision: 10, scale: 2 }), // se fosse dinheiro real
  maxDrawdown: decimal("max_drawdown", { precision: 5, scale: 4 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 5, scale: 4 }),
  testResults: jsonb("test_results"), // dados detalhados dos testes
  conclusions: text("conclusions"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const insertLotteryDrawSchema = createInsertSchema(lotteryDraws).omit({
  id: true,
  createdAt: true,
});

export const insertUserGameSchema = createInsertSchema(userGames).omit({
  id: true,
  createdAt: true,
});

export const insertNumberFrequencySchema = createInsertSchema(numberFrequency).omit({
  id: true,
  updatedAt: true,
});

export const insertAiAnalysisSchema = createInsertSchema(aiAnalysis).omit({
  id: true,
  createdAt: true,
});

// Insert schemas para as novas tabelas de performance
export const insertPredictionSchema = createInsertSchema(predictions).omit({
  id: true,
  createdAt: true,
  evaluatedAt: true,
});

export const insertModelPerformanceSchema = createInsertSchema(modelPerformance).omit({
  id: true,
  updatedAt: true,
});

export const insertStrategyComparisonSchema = createInsertSchema(strategyComparison).omit({
  id: true,
  createdAt: true,
});

export const insertModelVersionSchema = createInsertSchema(modelVersions).omit({
  id: true,
  deployedAt: true,
});

export const insertBacktestResultSchema = createInsertSchema(backtestResults).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LotteryType = typeof lotteryTypes.$inferSelect;
export type LotteryDraw = typeof lotteryDraws.$inferSelect;
export type UserGame = typeof userGames.$inferSelect;
export type NumberFrequency = typeof numberFrequency.$inferSelect;
export type AiAnalysis = typeof aiAnalysis.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertLotteryDraw = z.infer<typeof insertLotteryDrawSchema>;
export type InsertUserGame = z.infer<typeof insertUserGameSchema>;
export type InsertNumberFrequency = z.infer<typeof insertNumberFrequencySchema>;
export type InsertAiAnalysis = z.infer<typeof insertAiAnalysisSchema>;

// Novos tipos para sistema de métricas de performance
export type Prediction = typeof predictions.$inferSelect;
export type ModelPerformance = typeof modelPerformance.$inferSelect;
export type StrategyComparison = typeof strategyComparison.$inferSelect;
export type ModelVersion = typeof modelVersions.$inferSelect;
export type BacktestResult = typeof backtestResults.$inferSelect;

export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type InsertModelPerformance = z.infer<typeof insertModelPerformanceSchema>;
export type InsertStrategyComparison = z.infer<typeof insertStrategyComparisonSchema>;
export type InsertModelVersion = z.infer<typeof insertModelVersionSchema>;
export type InsertBacktestResult = z.infer<typeof insertBacktestResultSchema>;

// Next Draw Info interface for API responses
export interface NextDrawInfo {
  contestNumber: number;
  drawDate: string;
  drawTime: string;
  timeRemaining: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  };
  estimatedPrize: string;
}

// User Statistics interface for API responses
export interface UserStats {
  totalGames: number;
  wins: number;
  totalPrizeWon: string;
  accuracy: number;
  favoriteStrategy: string;
  averageNumbers: number;
}