"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/rbac";
import { CreateRevenueSchema, UpdateRevenueSchema } from "@/server/validators/revenue.schema";
import { createRevenue, updateRevenue, softDeleteRevenue, RevenueError } from "@/server/services/revenue.service";
import { PageError } from "@/server/services/page.service";
import { parseMonthKey } from "@/lib/month";

function monthKeyToDate(monthKey: string): Date {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) throw new RevenueError("Tháng không hợp lệ.", "INVALID_MONTH");
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

export type CreateRevenueState = ActionErrorState | { status: "success"; revenueId: string; wasUpdate: boolean };

export async function createRevenueAction(input: unknown): Promise<CreateRevenueState> {
  const admin = await requireAdmin();

  const parsed = CreateRevenueSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    const result = await createRevenue(
      {
        pageId: parsed.data.pageId,
        revenueMonth: monthKeyToDate(parsed.data.revenueMonth),
        amount: parsed.data.amount,
        note: parsed.data.note,
      },
      admin.id,
      await auditMeta(),
    );
    revalidatePath("/admin/revenue");
    revalidatePath(`/admin/pages/${parsed.data.pageId}`);
    return { status: "success", revenueId: result.revenueId, wasUpdate: result.wasUpdate };
  } catch (error) {
    if (error instanceof RevenueError || error instanceof PageError) return { status: "error", error: error.message };
    throw error;
  }
}

export type UpdateRevenueState = ActionErrorState | { status: "success" };

export async function updateRevenueAction(revenueId: string, input: unknown): Promise<UpdateRevenueState> {
  const admin = await requireAdmin();

  const parsed = UpdateRevenueSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await updateRevenue(
      revenueId,
      {
        pageId: parsed.data.pageId,
        revenueMonth: monthKeyToDate(parsed.data.revenueMonth),
        amount: parsed.data.amount,
        note: parsed.data.note,
      },
      admin.id,
      await auditMeta(),
    );
    revalidatePath("/admin/revenue");
    revalidatePath(`/admin/pages/${parsed.data.pageId}`);
    return { status: "success" };
  } catch (error) {
    if (error instanceof RevenueError || error instanceof PageError) return { status: "error", error: error.message };
    throw error;
  }
}

export type DeleteRevenueState = { status: "error"; error: string } | { status: "success" };

export async function deleteRevenueAction(revenueId: string, pageId: string): Promise<DeleteRevenueState> {
  const admin = await requireAdmin();

  try {
    await softDeleteRevenue(revenueId, admin.id, await auditMeta());
    revalidatePath("/admin/revenue");
    revalidatePath(`/admin/pages/${pageId}`);
    return { status: "success" };
  } catch (error) {
    if (error instanceof RevenueError) return { status: "error", error: error.message };
    throw error;
  }
}
