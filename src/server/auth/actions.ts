"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "./password";
import { createSession, deleteSession, getSessionPayload } from "./session";
import { isRateLimited, recordFailedAttempt, resetRateLimit } from "./rate-limit";
import { logAction } from "@/server/audit/log-action";

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "Email không hợp lệ." })),
  password: z.string().min(1, { error: "Vui lòng nhập mật khẩu." }),
});

export type LoginState = { error: string } | undefined;

const GENERIC_ERROR = "Email hoặc mật khẩu không chính xác.";

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: GENERIC_ERROR };
  }
  const { email, password } = parsed.data;

  if (isRateLimited(email)) {
    return { error: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau vài phút." };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    recordFailedAttempt(email);
    return { error: GENERIC_ERROR };
  }
  if (user.status === "INACTIVE") {
    recordFailedAttempt(email);
    return { error: "Tài khoản đã bị vô hiệu hoá. Liên hệ Admin để được hỗ trợ." };
  }

  resetRateLimit(email);
  await createSession({ userId: user.id, role: user.role });

  const requestHeaders = await headers();
  await logAction({
    actorType: "USER",
    actorUserId: user.id,
    action: "LOGIN",
    entityType: "User",
    entityId: user.id,
    ipAddress: requestHeaders.get("x-forwarded-for"),
    userAgent: requestHeaders.get("user-agent"),
  });

  redirect(user.role === "ADMIN" ? "/admin/dashboard" : "/user/dashboard");
}

export async function logoutAction(): Promise<void> {
  const session = await getSessionPayload();
  if (session) {
    const requestHeaders = await headers();
    await logAction({
      actorType: "USER",
      actorUserId: session.userId,
      action: "LOGOUT",
      entityType: "User",
      entityId: session.userId,
      ipAddress: requestHeaders.get("x-forwarded-for"),
      userAgent: requestHeaders.get("user-agent"),
    });
  }
  await deleteSession();
  redirect("/login");
}
