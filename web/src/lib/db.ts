import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Satu driver untuk lokal & produksi (Vercel):
 * - Lokal (tanpa env): file SQLite ./sqlite.db — tanpa modul native.
 * - Produksi: Turso via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
 * Dialek tetap SQLite sehingga skema & migrasi tak berubah.
 */
const url = process.env.TURSO_DATABASE_URL ?? "file:./sqlite.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({
  url,
  ...(authToken ? { authToken } : {}),
});

export const db = drizzle(client, { schema });
export type Db = typeof db;
