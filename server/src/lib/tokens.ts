import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { Env } from "../env.ts";

export interface AccessClaims extends JWTPayload {
  sub: string;
  role: "buyer" | "supplier" | "admin";
  companyId: string | null;
}

const ISSUER = "waw-smart-commerce";
const AUDIENCE = "waw-api";

const key = (env: Env) => new TextEncoder().encode(env.JWT_SECRET);

/** JWTPayload has an index signature, so the input shape is spelled out. */
export interface AccessTokenInput {
  sub: string;
  role: "buyer" | "supplier" | "admin";
  companyId: string | null;
}

export async function signAccessToken(env: Env, claims: AccessTokenInput) {
  return new SignJWT({ role: claims.role, companyId: claims.companyId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_TTL)
    .sign(key(env));
}

export async function verifyAccessToken(env: Env, token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, key(env), { issuer: ISSUER, audience: AUDIENCE });
  return payload as AccessClaims;
}

/**
 * Refresh tokens are opaque random strings. Only their SHA-256 digest is
 * stored, so a database dump cannot be replayed as a live session.
 */
export function createRefreshToken() {
  const token = randomBytes(48).toString("base64url");
  return { token, hash: hashRefreshToken(token) };
}

export const hashRefreshToken = (token: string) => createHash("sha256").update(token).digest("hex");
