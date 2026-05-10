import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const rawConnectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!rawConnectionString) {
  throw new Error(
    "NEON_DATABASE_URL ou DATABASE_URL deve estar definido.",
  );
}

// Remove parâmetros não suportados pelo driver pg (channel_binding, uselibpqcompat)
const connectionString = rawConnectionString
  .replace(/[&?]channel_binding=[^&]*/g, "")
  .replace(/[&?]uselibpqcompat=[^&]*/g, "")
  .replace(/\?&/, "?");

export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
