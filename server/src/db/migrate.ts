import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSql } from "./client.ts";
import { loadEnv } from "../env.ts";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "migrations");

/**
 * Apply pending migrations in filename order, each inside its own transaction,
 * recording what ran. Re-running is a no-op.
 */
export async function runMigrations(databaseUrl: string, log: (m: string) => void = console.log) {
  const sql = createSql(databaseUrl, 1);
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    const applied = new Set(
      (await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map((r) => r.name),
    );
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const ddl = await readFile(join(migrationsDir, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(ddl);
        await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
      });
      log(`applied ${file}`);
      count += 1;
    }
    log(count ? `${count} migration(s) applied` : "database already up to date");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Allow `npm run migrate` as well as programmatic use from tests and boot.
if (import.meta.url === `file://${process.argv[1]}`) {
  const env = loadEnv();
  await runMigrations(env.DATABASE_URL);
}
