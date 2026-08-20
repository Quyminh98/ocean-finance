"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/rbac";
import { setUserAccountStatus, UserAccountError } from "@/server/services/user-account.service";
import type { UserStatus } from "@/generated/prisma/client";

async function auditMeta() {
  const requestHeaders = await headers();
  return {
    ipAddress: requestHeaders.get("x-forwarded-for"),
    userAgent: requestHeaders.get("user-agent"),
  };
}

export type SetUserAccountStatusState = { status: "error"; error: string } | { status: "success" } | undefined;

export async function setUserAccountStatusAction(
  userId: string,
  nextStatus: UserStatus,
): Promise<SetUserAccountStatusState> {
  const admin = await requireAdmin();

  try {
    await setUserAccountStatus(userId, nextStatus, admin.id, await auditMeta());
    revalidatePath("/admin/settings/users");
    revalidatePath("/admin/employees");
    return { status: "success" };
  } catch (error) {
    if (error instanceof UserAccountError) return { status: "error", error: error.message };
    throw error;
  }
}
