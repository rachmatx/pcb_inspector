import type { Config } from "drizzle-kit";

/**
 * Lokal (tanpa env): dorong ke ./sqlite.db.
 * Produksi: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN lalu
 * `drizzle-kit push` untuk menyinkronkan skema ke Turso.
 */
export default {
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  ...(process.env.TURSO_DATABASE_URL
    ? {
        dialect: "turso",
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }
    : {
        dialect: "sqlite",
        dbCredentials: {
          url: "./sqlite.db",
        },
      }),
} satisfies Config;
