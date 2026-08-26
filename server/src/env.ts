import { z } from "zod";

/**
 * Fail fast on misconfiguration. A server that boots with a missing secret is
 * worse than one that refuses to start.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /** Signing key for access tokens. Must be at least 32 bytes of entropy. */
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /**
   * Comma-separated list of allowed browser origins. Both localhost and
   * 127.0.0.1 are allowed by default: they are distinct origins to a browser,
   * and dev servers are reached by either.
   */
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173"),

  /** Guards the one-shot seed endpoint; unset disables it entirely. */
  SEED_TOKEN: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
  }
  return parsed.data;
}

export const corsOrigins = (env: Env): string[] =>
  env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
