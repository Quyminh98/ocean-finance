"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/rbac";
import { CreateAdExpenseSchema, UpdateAdExpenseSchema } from "@/server/validators/ads.schema";
import { createAdExpense, updateAdExpense, softDeleteAdExpense, parseMonthKey, AdExpenseError } from "@/server/services/ads.service";

function monthKeyToDate(monthKey: string): Date {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) throw new AdExpenseError("Tháng không hợp lệ.", "INVALID_MONTH");
  return parsed;
}

async function auditMeta() {
  const requestHeaders = await headers();
  return {
    ipAddress: requestHeaders.get("x-forwarded-for"),
    userAgent: requestHeaders.get("user-agent"),
  };
}

function fieldErrorsFrom(error: { issues: { path: PropertyKey[]; message: string }[] }): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export type ActionErrorState = { status: "error"; error: string; fieldErrors?: Record<string, string> };

export type CreateAdExpenseState = ActionErrorState | { status: "success"; adExpenseId: string; wasUpdate: boolean };

export async function createAdExpenseAction(input: unknown): Promise<CreateAdExpenseState> {
  const admin = await requireAdmin();

  const parsed = CreateAdExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    const result = await createAdExpense(
      {
        employeeId: parsed.data.employeeId,
        expenseMonth: monthKeyToDate(parsed.data.expenseMonth),
        amount: parsed.data.amount,
        note: parsed.data.note,
        paidByAdminId: parsed.data.paidByAdminId,
      },
      admin.id,
      await auditMeta(),
    );
    revalidatePath("/admin/ads");
    revalidatePath(`/admin/employees/${parsed.data.employeeId}`);
    return { status: "success", adExpenseId: result.adExpenseId, wasUpdate: result.wasUpdate };
  } catch (error) {
    if (error instanceof AdExpenseError) return { status: "error", error: error.message };
    throw error;
  }
}

export type UpdateAdExpenseState = ActionErrorState | { status: "success" };

export async function updateAdExpenseAction(adExpenseId: string, input: unknown): Promise<UpdateAdExpenseState> {
  const admin = await requireAdmin();

  const parsed = UpdateAdExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await updateAdExpense(
      adExpenseId,
      {
        employeeId: parsed.data.employeeId,
        expenseMonth: monthKeyToDate(parsed.data.expenseMonth),
        amount: parsed.data.amount,
        note: parsed.data.note,
        paidByAdminId: parsed.data.paidByAdminId,
      },
      admin.id,
      await auditMeta(),
    );
    revalidatePath("/admin/ads");
    revalidatePath(`/admin/employees/${parsed.data.employeeId}`);
    return { status: "success" };
  } catch (error) {
    if (error instanceof AdExpenseError) return { status: "error", error: error.message };
    throw error;
  }
}

export type DeleteAdExpenseState = { status: "error"; error: string } | { status: "success" };

export async function deleteAdExpenseAction(adExpenseId: string, employeeId: string): Promise<DeleteAdExpenseState> {
  const admin = await requireAdmin();

  try {
    await softDeleteAdExpense(adExpenseId, admin.id, await auditMeta());
    revalidatePath("/admin/ads");
    revalidatePath(`/admin/employees/${employeeId}`);
    return { status: "success" };
  } catch (error) {
    if (error instanceof AdExpenseError) return { status: "error", error: error.message };
    throw error;
  }
}
