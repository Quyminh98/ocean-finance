import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionPayload } from "./session";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
};

/**
 * Secure check: re-validates the session's user against the DB (catches an
 * account deactivated after the JWT was issued, since the cookie itself
 * doesn't get revoked). Memoized per request — safe to call from every
 * layout/page that needs the current actor.
 *
 * Does NOT delete the cookie itself when the DB check fails — this runs
 * inside Server Component layouts, where cookie mutation is illegal (Next.js
 * only allows it in a Server Action or Route Handler). Callers redirect to
 * `/api/auth/invalidate` instead, which clears the stale cookie properly.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const payload = await getSessionPayload();
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/invalidate");
  if (user.role !== "ADMIN") redirect("/user/dashboard");
  return user;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/invalidate");
  if (user.role !== "USER") redirect("/admin/dashboard");
  return user;
}
