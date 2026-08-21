"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/server/auth/rbac";
import {
  CreatePageSchema,
  CreateSystemPageSelfSchema,
  UpdatePageSchema,
  UpdatePageStatusSchema,
  TransferPageSchema,
  AssignEmployeeSchema,
} from "@/server/validators/page.schema";
import {
  createPage,
  createSystemPageForSelf,
  updatePage,
  updatePageStatusByEmployee,
  softDeletePage,
  PageError,
} from "@/server/services/page.service";
import { transferPage, assignEmployee } from "@/server/services/assignment.service";
import { getEmployeeDetailByUserId } from "@/server/services/employee.service";
import { parseMonthKey } from "@/lib/month";

function monthKeyToDate(monthKey: string): Date {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) throw new PageError("Tháng mua không hợp lệ.", "INVALID_MONTH");
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

export type CreatePageState = ActionErrorState | { status: "success"; pageId: string };

export async function createPageAction(input: unknown): Promise<CreatePageState> {
  const admin = await requireAdmin();

  const parsed = CreatePageSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    const result = await createPage(
      {
        name: parsed.data.name,
        facebookUrl: parsed.data.facebookUrl,
        pageType: parsed.data.pageType,
        purchasePrice: parsed.data.purchasePrice,
        purchaseMonth: monthKeyToDate(parsed.data.purchaseMonth),
        assignEmployeeId: parsed.data.assignEmployeeId,
        paidByAdminId: parsed.data.paidByAdminId,
        sellerId: parsed.data.sellerId,
        payoutId: parsed.data.payoutId,
        statusIds: parsed.data.statusIds,
        notes: parsed.data.notes,
      },
      admin.id,
      await auditMeta(),
    );
    revalidatePath("/admin/pages");
    return { status: "success", pageId: result.pageId };
  } catch (error) {
    if (error instanceof PageError) return { status: "error", error: error.message };
    throw error;
  }
}

export type UpdatePageState = ActionErrorState | { status: "success" };

export async function updatePageAction(pageId: string, input: unknown): Promise<UpdatePageState> {
  const admin = await requireAdmin();

  const parsed = UpdatePageSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await updatePage(pageId, parsed.data, admin.id, await auditMeta());
    revalidatePath("/admin/pages");
    revalidatePath(`/admin/pages/${pageId}`);
    return { status: "success" };
  } catch (error) {
    if (error instanceof PageError) return { status: "error", error: error.message };
    throw error;
  }
}

export type UpdatePageStatusState = ActionErrorState | { status: "success" };

/**
 * User-role counterpart of `updatePageAction` — only touches status tags on
 * a Page the caller currently manages (spec §12, user request 2026-08-18
 * "chỉ có thể edit được trạng thái thôi"). `employeeId` is resolved from the
 * session, never trusted from the client — the RBAC boundary itself lives in
 * `updatePageStatusByEmployee` (rejects if the caller has no active
 * assignment on this Page), same defense-in-depth pattern as every other
 * employee-scoped action in this codebase.
 */
export async function updatePageStatusAction(pageId: string, input: unknown): Promise<UpdatePageStatusState> {
  const user = await requireUser();
  const profile = await getEmployeeDetailByUserId(user.id);
  if (!profile) return { status: "error", error: "Không tìm thấy hồ sơ nhân viên." };

  const parsed = UpdatePageStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await updatePageStatusByEmployee(pageId, profile.employeeId, parsed.data, user.id, await auditMeta());
    revalidatePath("/user/pages");
    return { status: "success" };
  } catch (error) {
    if (error instanceof PageError) return { status: "error", error: error.message };
    throw error;
  }
}

export type CreateSystemPageSelfState = ActionErrorState | { status: "success"; pageId: string };

/**
 * User self-service Create — always `pageType=SYSTEM`, no price/payer/employee
 * picker, auto-assigned to the caller (user request 2026-08-18). `employeeId`
 * resolved from the session, never trusted from the client — same pattern as
 * `updatePageStatusAction` above.
 */
export async function createSystemPageForSelfAction(input: unknown): Promise<CreateSystemPageSelfState> {
  const user = await requireUser();
  const profile = await getEmployeeDetailByUserId(user.id);
  if (!profile) return { status: "error", error: "Không tìm thấy hồ sơ nhân viên." };

  const parsed = CreateSystemPageSelfSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    const result = await createSystemPageForSelf(parsed.data, profile.employeeId, user.id, await auditMeta());
    revalidatePath("/user/pages");
    return { status: "success", pageId: result.pageId };
  } catch (error) {
    if (error instanceof PageError) return { status: "error", error: error.message };
    throw error;
  }
}

export type TransferPageState = ActionErrorState | { status: "success" };

export async function transferPageAction(pageId: string, input: unknown): Promise<TransferPageState> {
  const admin = await requireAdmin();

  const parsed = TransferPageSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await transferPage(
      pageId,
      {
        newEmployeeId: parsed.data.newEmployeeId,
        effectiveDate: new Date(parsed.data.effectiveDate),
        note: parsed.data.note,
      },
      admin.id,
      await auditMeta(),
    );
    revalidatePath("/admin/pages");
    revalidatePath(`/admin/pages/${pageId}`);
    return { status: "success" };
  } catch (error) {
    if (error instanceof PageError) return { status: "error", error: error.message };
    throw error;
  }
}

export type DeletePageState = { status: "error"; error: string } | { status: "success" };

export async function deletePageAction(pageId: string): Promise<DeletePageState> {
  const admin = await requireAdmin();

  try {
    await softDeletePage(pageId, admin.id, await auditMeta());
    revalidatePath("/admin/pages");
    revalidatePath(`/admin/pages/${pageId}`);
    return { status: "success" };
  } catch (error) {
    if (error instanceof PageError) return { status: "error", error: error.message };
    throw error;
  }
}

export type AssignEmployeeState = ActionErrorState | { status: "success" };

export async function assignEmployeeAction(pageId: string, input: unknown): Promise<AssignEmployeeState> {
  const admin = await requireAdmin();

  const parsed = AssignEmployeeSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await assignEmployee(
      pageId,
      {
        employeeId: parsed.data.employeeId,
        effectiveDate: new Date(parsed.data.effectiveDate),
        note: parsed.data.note,
      },
      admin.id,
      await auditMeta(),
    );
    revalidatePath("/admin/pages");
    revalidatePath(`/admin/pages/${pageId}`);
    return { status: "success" };
  } catch (error) {
    if (error instanceof PageError) return { status: "error", error: error.message };
    throw error;
  }
}
