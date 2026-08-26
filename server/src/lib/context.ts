import type { FastifyReply, FastifyRequest } from "fastify";
import { and, eq, gt, isNull } from "drizzle-orm";
import { forbidden, unauthorized } from "./errors.ts";
import { verifyAccessToken } from "./tokens.ts";
import { refreshTokens, users } from "../db/schema.ts";
import type { AccessClaims } from "./tokens.ts";

export interface AuthUser {
  id: string;
  role: "buyer" | "supplier" | "admin";
  companyId: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthUser;
  }
}

function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length ? token : null;
}

/**
 * Populate `request.auth` when a valid token is present. Never rejects — route
 * guards decide what an anonymous request may do.
 */
export async function attachAuth(request: FastifyRequest) {
  const token = bearer(request);
  if (!token) return;
  try {
    const claims: AccessClaims = await verifyAccessToken(request.server.env, token);
    request.auth = { id: claims.sub, role: claims.role, companyId: claims.companyId ?? null };
  } catch {
    // An expired or forged token is simply not an identity.
  }
}

export function requireAuth(request: FastifyRequest): AuthUser {
  if (!request.auth) throw unauthorized();
  return request.auth;
}

export function requireRole(request: FastifyRequest, ...roles: AuthUser["role"][]): AuthUser {
  const user = requireAuth(request);
  // Admins are deliberately allowed everywhere; every other role is exact-match.
  if (user.role !== "admin" && !roles.includes(user.role)) throw forbidden();
  return user;
}

/** A company-scoped actor. Buyers and suppliers always belong to a company. */
export function requireCompany(request: FastifyRequest, ...roles: AuthUser["role"][]): AuthUser & { companyId: string } {
  const user = roles.length ? requireRole(request, ...roles) : requireAuth(request);
  if (!user.companyId) throw forbidden("This account is not linked to a company");
  return user as AuthUser & { companyId: string };
}

/** Admins may read anything; everyone else only their own company's records. */
export function assertOwnsCompany(user: AuthUser, companyId: string) {
  if (user.role === "admin") return;
  if (user.companyId !== companyId) throw forbidden();
}

export async function findLiveRefreshToken(db: import("../db/client.ts").Database, tokenHash: string) {
  const rows = await db
    .select()
    .from(refreshTokens)
    .where(and(
      eq(refreshTokens.tokenHash, tokenHash),
      isNull(refreshTokens.revokedAt),
      gt(refreshTokens.expiresAt, new Date()),
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function findActiveUser(db: import("../db/client.ts").Database, id: string) {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.isActive, true)))
    .limit(1);
  return rows[0] ?? null;
}

export const noStore = (reply: FastifyReply) => reply.header("cache-control", "no-store");
