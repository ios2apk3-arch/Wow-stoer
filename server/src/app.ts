import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { corsOrigins, type Env } from "./env.ts";
import { ApiError } from "./lib/errors.ts";
import { attachAuth } from "./lib/context.ts";
import { createDb, createSql, type Database, type Sql } from "./db/client.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerCatalogRoutes } from "./routes/catalog.ts";
import { registerCartRoutes } from "./routes/cart.ts";
import { registerOrderRoutes } from "./routes/orders.ts";
import { registerRfqRoutes } from "./routes/rfq.ts";
import { registerNegotiationRoutes } from "./routes/negotiations.ts";
import { registerMessagingRoutes } from "./routes/messaging.ts";
import { registerNotificationRoutes } from "./routes/notifications.ts";
import { registerAdminRoutes } from "./routes/admin.ts";
import { registerAnalyticsRoutes } from "./routes/analytics.ts";

declare module "fastify" {
  interface FastifyInstance {
    env: Env;
    db: Database;
    sql: Sql;
  }
}

export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : { level: env.LOG_LEVEL },
    trustProxy: true,
    bodyLimit: 1_048_576,
  });

  const sql = createSql(env.DATABASE_URL);
  app.decorate("env", env);
  app.decorate("sql", sql);
  app.decorate("db", createDb(sql));
  app.addHook("onClose", async () => {
    await sql.end({ timeout: 5 });
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: corsOrigins(env),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(rateLimit, {
    max: env.NODE_ENV === "test" ? 100_000 : 300,
    timeWindow: "1 minute",
    // Rate-limit per account when known, per IP otherwise, so one noisy
    // network does not throttle everyone behind it.
    keyGenerator: (req) => req.auth?.id ?? req.ip,
  });

  app.addHook("onRequest", attachAuth);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Request validation failed",
          details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      });
    }
    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply.status(429).send({ error: { code: "rate_limited", message: "Too many requests" } });
    }
    // Unexpected: log the detail, tell the client nothing that aids an attacker.
    request.log.error({ err: error }, "unhandled error");
    return reply.status(500).send({ error: { code: "internal_error", message: "Something went wrong" } });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ error: { code: "not_found", message: "Route not found" } }),
  );

  app.get("/health", async () => {
    await sql`SELECT 1`;
    return { status: "ok", service: "waw-api", time: new Date().toISOString() };
  });

  await app.register(async (api) => {
    await registerAuthRoutes(api);
    await registerCatalogRoutes(api);
    await registerCartRoutes(api);
    await registerOrderRoutes(api);
    await registerRfqRoutes(api);
    await registerNegotiationRoutes(api);
    await registerMessagingRoutes(api);
    await registerNotificationRoutes(api);
    await registerAdminRoutes(api);
    await registerAnalyticsRoutes(api);
  }, { prefix: "/api/v1" });

  return app;
}
