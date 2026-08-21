"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/rbac";
import { CreatePayoutSchema, UpdatePayoutSchema } from "@/server/validators/payout.schema";
import { createPayout, updatePayout, deletePayout, PayoutError } from "@/server/services/payout.service";

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

export type CreatePayoutState = ActionErrorState | { status: "success"; payoutId: string };

export async function createPayoutAction(input: unknown): Promise<CreatePayoutState> {
  const admin = await requireAdmin();

  const parsed = CreatePayoutSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    const result = await createPayout(parsed.data, admin.id, await auditMeta());
    revalidatePath("/admin/settings/payouts");
    revalidatePath("/admin/pages/new");
    return { status: "success", payoutId: result.payoutId };
  } catch (error) {
    if (error instanceof PayoutError) return { status: "error", error: error.message };
    throw error;
  }
}

export type UpdatePayoutState = ActionErrorState | { status: "success" };

export async function updatePayoutAction(payoutId: string, input: unknown): Promise<UpdatePayoutState> {
  const admin = await requireAdmin();

  const parsed = UpdatePayoutSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await updatePayout(payoutId, parsed.data, admin.id, await auditMeta());
    revalidatePath("/admin/settings/payouts");
    revalidatePath("/admin/pages");
    revalidatePath("/user/pages");
    return { status: "success" };
  } catch (error) {
    if (error instanceof PayoutError) return { status: "error", error: error.message };
    throw error;
  }
}

export type DeletePayoutState = { status: "error"; error: string } | { status: "success" };

export async function deletePayoutAction(payoutId: string): Promise<DeletePayoutState> {
  const admin = await requireAdmin();

  try {
    await deletePayout(payoutId, admin.id, await auditMeta());
    revalidatePath("/admin/settings/payouts");
    revalidatePath("/admin/pages");
    revalidatePath("/user/pages");
    return { status: "success" };
  } catch (error) {
    if (error instanceof PayoutError) return { status: "error", error: error.message };
    throw error;
  }
}
