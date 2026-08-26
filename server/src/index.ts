import { buildApp } from "./app.ts";
import { loadEnv } from "./env.ts";
import { runMigrations } from "./db/migrate.ts";

const env = loadEnv();

// Migrate on boot: a container that starts against an out-of-date schema
// would fail on its first request anyway, and this keeps deploys one step.
await runMigrations(env.DATABASE_URL, (m) => console.log(`[migrate] ${m}`));

const app = await buildApp(env);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.log.info(`${signal} received, shutting down`);
    app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: env.PORT, host: env.HOST });
