import { SignJWT, jwtVerify } from "jose";
import { Prisma } from "../generated/prisma/client";
import prisma from "../db/prisma";
import { randomBytes, createHash } from "node:crypto";
import { getPrivateKey, getPublicKey } from "../config/keys";
import type { JWTPayload } from "../types/auth";
import "dotenv/config";

export const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export class TokenError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "TokenError";
  }
}

// ACCESS TOKENS

export async function signAccessToken(payload: JWTPayload): Promise<string> {
  const privateKey = await getPrivateKey();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.ACCESS_TOKEN_EXPIRY!)
    .setIssuer("cheapskate")
    .setAudience("cheapskate-client")
    .sign(privateKey);
}

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const publicKey = await getPublicKey();
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: "cheapskate",
    audience: "cheapskate-client",
    algorithms: ["RS256"],
  });

  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new TokenError("INVALID TOKEN");
  }

  return { sub: payload.sub, email: payload.email, name: typeof payload.name === "string" ? payload.name : null, };
}

// HELPER FUNCTIONS

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateRawToken(): string {
  return randomBytes(64).toString("base64url");
}

function tokenExpiry(): Date {
  return new Date(Date.now() + SEVEN_DAYS);
}

// REFRESH TOKENS

// on login
export async function createRefreshToken(
  userId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<string> {
  const raw = generateRawToken();

  await tx.refreshToken.create({
    data: {
      token: hashToken(raw),
      userId,
      expiresAt: tokenExpiry(),
    },
  });

  return raw;
}

// rotate refresh token on /refresh

export async function rotateRefreshToken(
  rawToken: string,
): Promise<{ raw: string; userId: string }> {
  const hash = hashToken(rawToken);

  return prisma
    .$transaction(async (tx) => {
      const existing = await tx.refreshToken.findUnique({
        where: { token: hash },
      });

      if (!existing) {
        throw new TokenError("INVALID_TOKEN");
      }

      // reuse detected

      if (existing.used) {
        const userId = existing.userId;
        throw Object.assign(new TokenError("TOKEN_REUSE_DETECTED"), { userId });
      }

      if (existing.expiresAt < new Date()) {
        throw new TokenError("TOKEN_EXPIRED");
      }

      const raw = generateRawToken();

      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { used: true },
      });

      await tx.refreshToken.create({
        data: {
          token: hashToken(raw),
          userId: existing.userId,
          expiresAt: tokenExpiry(),
        },
      });

      return { raw, userId: existing.userId };
    })
    .catch(async (err) => {
      if (err instanceof TokenError && err.code === "TOKEN_REUSE_DETECTED") {
        await prisma.refreshToken.deleteMany({
          where: { userId: (err as any).userId },
        });
      }
      throw err;
    });
}

export async function revokeAllUserRefreshTokens(userId: string) {
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      used: false
    },
    data: {
      used: true
    }
  });
}

// revoke on logout

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const hash = hashToken(rawToken);
  await prisma.refreshToken
    .deleteMany({
      where: { token: hash },
    })
    .catch(() => {});
}
