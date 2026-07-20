/**
 * Ordered, tracked migration runner for the numbered SQL files in
 * ../migrations (001, 002, 003, …). Each file is applied at most once, inside a
 * transaction, and recorded in a `schema_migrations` table — so it's safe to
 * run on every deploy and it can never apply a file twice or out of order.
 *
 * Run:  SUPABASE_DB_URL=postgres://… node --experimental-strip-types scripts/migrate.ts
 *       (or `pnpm --filter @workspace/api-server migrate`)
 *
 * SUPABASE_DB_URL is the Postgres connection URI from
 * Supabase → Project Settings → Database → Connection string.
 *
 * NOTE: this runs the ONGOING numbered migrations only. The one-time bootstrap
 * schema (DATABASE_SETUP.sql, MIGRATE_FIREBASE_AUTH.sql, and the app-table
 * files under artifacts/suraksha/supabase) is a documented first-time step —
 * see migrations/README.md.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { pendingMigrations } from "../src/lib/migrations.ts";

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

async function main(): Promise<void> {
  const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("SUPABASE_DB_URL (or DATABASE_URL) is not set — cannot run migrations.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const [files, appliedRes] = await Promise.all([
      readdir(MIGRATIONS_DIR),
      client.query<{ name: string }>("SELECT name FROM public.schema_migrations"),
    ]);
    const applied = appliedRes.rows.map((r) => r.name);
    const pending = pendingMigrations(files, applied);

    if (pending.length === 0) {
      console.log("Migrations up to date — nothing to apply.");
      return;
    }

    console.log(`Applying ${pending.length} migration(s): ${pending.join(", ")}`);
    for (const name of pending) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, name), "utf8");
      // Each migration is atomic: the file + its bookkeeping commit together,
      // so a mid-file failure leaves schema_migrations untouched and the file
      // is retried in full next run.
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO public.schema_migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
        console.log(`  ✓ ${name}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`  ✗ ${name} failed — rolled back.`);
        throw err;
      }
    }
    console.log("Migrations complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
