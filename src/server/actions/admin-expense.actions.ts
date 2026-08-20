"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/rbac";
import { CreateAdminExpenseSchema, UpdateAdminExpenseSchema } from "@/server/validators/admin-expense.schema";
import {
  createAdminExpense,
  updateAdminExpense,
  softDeleteAdminExpense,
  restoreAdminExpense,
  AdminExpenseError,
} from "@/server/services/admin-expense.service";

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

export type CreateAdminExpenseState = ActionErrorState | { status: "success"; adminExpenseId: string };

export async function createAdminExpenseAction(input: unknown): Promise<CreateAdminExpenseState> {
  const admin = await requireAdmin();

  const parsed = CreateAdminExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    const result = await createAdminExpense(
      {
        expenseDate: new Date(parsed.data.expenseDate),
        amount: parsed.data.amount,
        description: parsed.data.description,
        note: parsed.data.note,
        paidByAdminId: parsed.data.paidByAdminId,
      },
      admin.id,
      await auditMeta(),
    );
    revalidatePath("/admin/expenses");
    return { status: "success", adminExpenseId: result.adminExpenseId };
  } catch (error) {
    if (error instanceof AdminExpenseError) return { status: "error", error: error.message };
    throw error;
  }
}

export type UpdateAdminExpenseState = ActionErrorState | { status: "success" };

export async function updateAdminExpenseAction(adminExpenseId: string, input: unknown): Promise<UpdateAdminExpenseState> {
  const admin = await requireAdmin();

  const parsed = UpdateAdminExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await updateAdminExpense(
      adminExpenseId,
      {
        expenseDate: new Date(parsed.data.expenseDate),
        amount: parsed.data.amount,
        description: parsed.data.description,
        note: parsed.data.note,
        paidByAdminId: parsed.data.paidByAdminId,
      },
      admin.id,
      await auditMeta(),
    );
    revalidatePath("/admin/expenses");
    return { status: "success" };
  } catch (error) {
    if (error instanceof AdminExpenseError) return { status: "error", error: error.message };
    throw error;
  }
}

export type MutateAdminExpenseState = { status: "error"; error: string } | { status: "success" };

export async function deleteAdminExpenseAction(adminExpenseId: string): Promise<MutateAdminExpenseState> {
  const admin = await requireAdmin();

  try {
    await softDeleteAdminExpense(adminExpenseId, admin.id, await auditMeta());
    revalidatePath("/admin/expenses");
    return { status: "success" };
  } catch (error) {
    if (error instanceof AdminExpenseError) return { status: "error", error: error.message };
    throw error;
  }
}

export async function restoreAdminExpenseAction(adminExpenseId: string): Promise<MutateAdminExpenseState> {
  const admin = await requireAdmin();

  try {
    await restoreAdminExpense(adminExpenseId, admin.id, await auditMeta());
    revalidatePath("/admin/expenses");
    return { status: "success" };
  } catch (error) {
    if (error instanceof AdminExpenseError) return { status: "error", error: error.message };
    throw error;
  }
}
