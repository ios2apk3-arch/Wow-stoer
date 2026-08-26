import type { FastifyInstance } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { companies, refreshTokens, suppliers, users } from "../db/schema.ts";
import { hashPassword, verifyPassword } from "../lib/password.ts";
import { createRefreshToken, hashRefreshToken, signAccessToken } from "../lib/tokens.ts";
import { conflict, unauthorized } from "../lib/errors.ts";
import { findActiveUser, findLiveRefreshToken, noStore, requireAuth } from "../lib/context.ts";

const registerBody = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  phone: z.string().trim().max(32).default(""),
  password: z.string().min(10).max(200),
  role: z.enum(["buyer", "supplier"]),
  companyName: z.string().trim().min(2).max(160),
  countryCode: z.string().length(2).toUpperCase(),
  city: z.string().trim().max(120).default(""),
});

const loginBody = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

const refreshBody = z.object({ refreshToken: z.string().min(20).max(400) });

const publicUser = (u: typeof users.$inferSelect) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  companyId: u.companyId,
  avatarColor: u.avatarColor,
  createdAt: u.createdAt,
});

export async function registerAuthRoutes(app: FastifyInstance) {
  const { db, env } = app;

  const issueSession = async (user: typeof users.$inferSelect, userAgent?: string) => {
    const accessToken = await signAccessToken(env, {
      sub: user.id,
      role: user.role,
      companyId: user.companyId,
    });
    const { token, hash } = createRefreshToken();
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 864e5);
    await db.insert(refreshTokens).values({ userId: user.id, tokenHash: hash, expiresAt, userAgent });
    return { accessToken, refreshToken: token, expiresAt };
  };

  app.post("/auth/register", {
    config: { rateLimit: { max: env.NODE_ENV === "test" ? 100_000 : 10, timeWindow: "1 hour" } },
  }, async (request, reply) => {
    const body = registerBody.parse(request.body);
    noStore(reply);

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
    if (existing.length) throw conflict("An account with this email already exists");

    const passwordHash = await hashPassword(body.password);

    const created = await db.transaction(async (tx) => {
      const [company] = await tx.insert(companies).values({
        nameAr: body.companyName,
        nameEn: body.companyName,
        legalName: body.companyName,
        countryCode: body.countryCode,
        city: body.city,
        phone: body.phone,
        email: body.email,
        logo: body.role === "supplier" ? "🏭" : "🏪",
        verification: "pending",
      }).returning();

      if (body.role === "supplier") {
        await tx.insert(suppliers).values({ id: company.id });
      }

      const [user] = await tx.insert(users).values({
        companyId: company.id,
        name: body.name,
        email: body.email,
        phone: body.phone,
        role: body.role,
        passwordHash,
      }).returning();

      return { user, company };
    });

    const session = await issueSession(created.user, request.headers["user-agent"]);
    return reply.status(201).send({ user: publicUser(created.user), company: created.company, ...session });
  });

  app.post("/auth/login", {
    config: { rateLimit: { max: env.NODE_ENV === "test" ? 100_000 : 20, timeWindow: "15 minutes" } },
  }, async (request, reply) => {
    const body = loginBody.parse(request.body);
    noStore(reply);

    const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);

    // Hash even when the user is missing, so response time does not reveal
    // which emails are registered.
    const ok = user
      ? await verifyPassword(user.passwordHash, body.password)
      : await verifyPassword("$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$0000000000000000000000000000000000000000000", body.password);

    if (!user || !ok || !user.isActive) throw unauthorized("Invalid email or password");

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    const session = await issueSession(user, request.headers["user-agent"]);
    return { user: publicUser(user), ...session };
  });

  /** Rotate: the presented refresh token is revoked and replaced on every use. */
  app.post("/auth/refresh", async (request, reply) => {
    const body = refreshBody.parse(request.body);
    noStore(reply);

    const stored = await findLiveRefreshToken(db, hashRefreshToken(body.refreshToken));
    if (!stored) throw unauthorized("Invalid or expired refresh token");

    const user = await findActiveUser(db, stored.userId);
    if (!user) throw unauthorized("Account is no longer active");

    const session = await issueSession(user, request.headers["user-agent"]);
    const [replacement] = await db
      .select({ id: refreshTokens.id })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashRefreshToken(session.refreshToken)))
      .limit(1);

    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), replacedBy: replacement?.id ?? null })
      .where(eq(refreshTokens.id, stored.id));

    return { user: publicUser(user), ...session };
  });

  app.post("/auth/logout", async (request, reply) => {
    const body = refreshBody.safeParse(request.body);
    noStore(reply);
    if (body.success) {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.tokenHash, hashRefreshToken(body.data.refreshToken)), isNull(refreshTokens.revokedAt)));
    }
    return reply.status(204).send();
  });

  /** Revoke every session for the caller — "sign out everywhere". */
  app.post("/auth/logout-all", async (request, reply) => {
    const auth = requireAuth(request);
    noStore(reply);
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, auth.id));
    return reply.status(204).send();
  });

  app.get("/auth/me", async (request, reply) => {
    const auth = requireAuth(request);
    noStore(reply);
    const user = await findActiveUser(db, auth.id);
    if (!user) throw unauthorized();
    const company = user.companyId
      ? (await db.select().from(companies).where(eq(companies.id, user.companyId)).limit(1))[0] ?? null
      : null;
    return { user: publicUser(user), company };
  });
}
