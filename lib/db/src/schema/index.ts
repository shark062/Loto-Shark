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
