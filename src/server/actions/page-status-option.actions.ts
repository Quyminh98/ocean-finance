"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/rbac";
import { CreatePageStatusOptionSchema, UpdatePageStatusOptionSchema } from "@/server/validators/page-status-option.schema";
import {
  createPageStatusOption,
  updatePageStatusOption,
  deletePageStatusOption,
  PageStatusOptionError,
} from "@/server/services/page-status-option.service";

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

export type CreatePageStatusOptionState = ActionErrorState | { status: "success"; optionId: string };

export async function createPageStatusOptionAction(input: unknown): Promise<CreatePageStatusOptionState> {
  const admin = await requireAdmin();

  const parsed = CreatePageStatusOptionSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    const result = await createPageStatusOption(parsed.data, admin.id, await auditMeta());
    revalidatePath("/admin/settings/page-status-options");
    return { status: "success", optionId: result.optionId };
  } catch (error) {
    if (error instanceof PageStatusOptionError) return { status: "error", error: error.message };
    throw error;
  }
}

export type UpdatePageStatusOptionState = ActionErrorState | { status: "success" };

export async function updatePageStatusOptionAction(optionId: string, input: unknown): Promise<UpdatePageStatusOptionState> {
  const admin = await requireAdmin();

  const parsed = UpdatePageStatusOptionSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await updatePageStatusOption(optionId, parsed.data, admin.id, await auditMeta());
    revalidatePath("/admin/settings/page-status-options");
    revalidatePath("/admin/pages");
    return { status: "success" };
  } catch (error) {
    if (error instanceof PageStatusOptionError) return { status: "error", error: error.message };
    throw error;
  }
}

export type DeletePageStatusOptionState = { status: "error"; error: string } | { status: "success" };

export async function deletePageStatusOptionAction(optionId: string): Promise<DeletePageStatusOptionState> {
  const admin = await requireAdmin();

  try {
    await deletePageStatusOption(optionId, admin.id, await auditMeta());
    revalidatePath("/admin/settings/page-status-options");
    revalidatePath("/admin/pages");
    return { status: "success" };
  } catch (error) {
    if (error instanceof PageStatusOptionError) return { status: "error", error: error.message };
    throw error;
  }
}
