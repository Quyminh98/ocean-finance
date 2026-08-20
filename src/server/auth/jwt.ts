import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { Role } from "@/generated/prisma/client";

// Pure JWT helpers with no Next.js request-scope imports (no `next/headers`,
// no `server-only`) so they can run both in Server Components/Actions
// (via session.ts) and in proxy.ts, which reads/writes cookies through
// `NextRequest`/`NextResponse` instead of the `cookies()` API.

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type SessionPayload = {
  userId: string;
  role: Role;
};

function getEncodedSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set — required to sign session cookies.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload & JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + SESSION_DURATION_MS) / 1000))
    .sign(getEncodedSecret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getEncodedSecret(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string" || typeof payload.role !== "string") return null;
    return { userId: payload.userId, role: payload.role as Role };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_MS = SESSION_DURATION_MS;
