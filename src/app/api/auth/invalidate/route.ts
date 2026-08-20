import { NextResponse, type NextRequest } from "next/server";
import { deleteSession } from "@/server/auth/session";

/**
 * Clears a stale session cookie (signature still valid, but the user is gone
 * or deactivated in the DB) and redirects to `/login`. Cookie mutation is
 * only legal in a Server Action or Route Handler — `requireAdmin`/`requireUser`
 * run inside Server Component layouts, so they redirect here instead of
 * calling `deleteSession()` directly (see `server/auth/rbac.ts`).
 */
export async function GET(request: NextRequest) {
  await deleteSession();
  return NextResponse.redirect(new URL("/login", request.url));
}
