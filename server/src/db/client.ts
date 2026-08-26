import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

export type Sql = ReturnType<typeof postgres>;

export function createSql(databaseUrl: string, max = 10): Sql {
  return postgres(databaseUrl, {
    max,
    // Railway's managed Postgres terminates TLS with its own certificate.
    ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") ? false : "require",
    onnotice: () => {},
    transform: { undefined: null },
  });
}

export function createDb(sql: Sql) {
  return drizzle(sql);
}

export type Database = ReturnType<typeof createDb>;
