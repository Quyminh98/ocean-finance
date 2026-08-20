import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/server/auth/jwt";

// Optimistic RBAC gate: decodes the session cookie only (no DB call — see
// CLAUDE.md "RBAC server-side bắt buộc"). This is the first line of
// defense; every Server Action/Route Handler still re-checks via
// requireAdmin()/requireUser() (src/server/auth/rbac.ts) against the DB,
// since Proxy can't be the only guard (deactivated accounts, edge cases).
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  const isAdminRoute = pathname.startsWith("/admin");
  const isUserRoute = pathname.startsWith("/user");
  const isLoginRoute = pathname === "/login";

  if (!session) {
    if (isAdminRoute || isUserRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  if (isLoginRoute) {
    return NextResponse.redirect(new URL(session.role === "ADMIN" ? "/admin/dashboard" : "/user/dashboard", request.url));
  }
  if (isAdminRoute && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/user/dashboard", request.url));
  }
  if (isUserRoute && session.role !== "USER") {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
