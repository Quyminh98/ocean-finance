"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/rbac";
import { settleEmployeeProfit, ProfitSettlementError } from "@/server/services/profit-settlement.service";

async function auditMeta() {
  const requestHeaders = await headers();
  return {
    ipAddress: requestHeaders.get("x-forwarded-for"),
    userAgent: requestHeaders.get("user-agent"),
  };
}

export type SettleEmployeeProfitState = { status: "error"; error: string } | { status: "success" };

export async function settleEmployeeProfitAction(employeeId: string): Promise<SettleEmployeeProfitState> {
  const admin = await requireAdmin();

  try {
    await settleEmployeeProfit(employeeId, admin.id, await auditMeta());
    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${employeeId}`);
    revalidatePath("/user/costs");
    revalidatePath("/user/dashboard");
    return { status: "success" };
  } catch (error) {
    if (error instanceof ProfitSettlementError) return { status: "error", error: error.message };
    throw error;
  }
}
