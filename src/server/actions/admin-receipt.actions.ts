"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/rbac";
import { CreateAdminReceiptSchema, UpdateAdminReceiptSchema } from "@/server/validators/admin-receipt.schema";
import { createAdminReceipt, updateAdminReceipt, softDeleteAdminReceipt, AdminReceiptError } from "@/server/services/receipt.service";
import { parseMonthKey } from "@/lib/month";

function monthKeyToDate(monthKey: string): Date {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) throw new AdminReceiptError("Tháng không hợp lệ.", "INVALID_MONTH");
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

export type CreateAdminReceiptState = ActionErrorState | { status: "success"; adminReceiptId: string };

export async function createAdminReceiptAction(input: unknown): Promise<CreateAdminReceiptState> {
  const admin = await requireAdmin();

  const parsed = CreateAdminReceiptSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    const result = await createAdminReceipt(
      {
        receiptMonth: monthKeyToDate(parsed.data.receiptMonth),
        amount: parsed.data.amount,
        source: parsed.data.source,
        note: parsed.data.note,
        receivedByAdminId: parsed.data.receivedByAdminId,
      },
      admin.id,
      await auditMeta(),
    );
    revalidatePath("/admin/receipts");
    return { status: "success", adminReceiptId: result.adminReceiptId };
  } catch (error) {
    if (error instanceof AdminReceiptError) return { status: "error", error: error.message };
    throw error;
  }
}

export type UpdateAdminReceiptState = ActionErrorState | { status: "success" };

export async function updateAdminReceiptAction(adminReceiptId: string, input: unknown): Promise<UpdateAdminReceiptState> {
  const admin = await requireAdmin();

  const parsed = UpdateAdminReceiptSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await updateAdminReceipt(
      adminReceiptId,
      {
        receiptMonth: monthKeyToDate(parsed.data.receiptMonth),
        amount: parsed.data.amount,
        source: parsed.data.source,
        note: parsed.data.note,
        receivedByAdminId: parsed.data.receivedByAdminId,
      },
      admin.id,
      await auditMeta(),
    );
    revalidatePath("/admin/receipts");
    return { status: "success" };
  } catch (error) {
    if (error instanceof AdminReceiptError) return { status: "error", error: error.message };
    throw error;
  }
}

export type MutateAdminReceiptState = { status: "error"; error: string } | { status: "success" };

export async function deleteAdminReceiptAction(adminReceiptId: string): Promise<MutateAdminReceiptState> {
  const admin = await requireAdmin();

  try {
    await softDeleteAdminReceipt(adminReceiptId, admin.id, await auditMeta());
    revalidatePath("/admin/receipts");
    return { status: "success" };
  } catch (error) {
    if (error instanceof AdminReceiptError) return { status: "error", error: error.message };
    throw error;
  }
}
