import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { signSession, verifySession, SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS, type SessionPayload } from "./jwt";

export type { SessionPayload };

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + SESSION_MAX_AGE_MS),
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** Optimistic read: decodes the cookie only, no DB round-trip. Memoized per request. */
export const getSessionPayload = cache(async (): Promise<SessionPayload | null> => {
  const cookieStore = await cookies();
  return verifySession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
});
