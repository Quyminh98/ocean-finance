"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/server/auth/rbac";
import { CreateViaSchema, UpdateViaSchema } from "@/server/validators/via.schema";
import { createVia, updateVia, deleteVia, ViaError } from "@/server/services/via.service";

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

export type CreateViaState = ActionErrorState | { status: "success"; viaId: string };

/** Holder is always the caller themselves — works identically from `/user/vias` (Employee)
 * and `/admin/vias` (Admin), no role branching needed beyond which page to revalidate. */
export async function createViaAction(input: unknown): Promise<CreateViaState> {
  const user = await requireActiveUser();

  const parsed = CreateViaSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    const result = await createVia(parsed.data, user.id, await auditMeta());
    revalidatePath(user.role === "ADMIN" ? "/admin/vias" : "/user/vias");
    return { status: "success", viaId: result.viaId };
  } catch (error) {
    if (error instanceof ViaError) return { status: "error", error: error.message };
    throw error;
  }
}

export type UpdateViaState = ActionErrorState | { status: "success" };

export async function updateViaAction(viaId: string, input: unknown): Promise<UpdateViaState> {
  const user = await requireActiveUser();

  const parsed = UpdateViaSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await updateVia(viaId, parsed.data, user.id, await auditMeta());
    revalidatePath(user.role === "ADMIN" ? "/admin/vias" : "/user/vias");
    return { status: "success" };
  } catch (error) {
    if (error instanceof ViaError) return { status: "error", error: error.message };
    throw error;
  }
}

export type DeleteViaState = { status: "error"; error: string } | { status: "success" };

export async function deleteViaAction(viaId: string): Promise<DeleteViaState> {
  const user = await requireActiveUser();

  try {
    await deleteVia(viaId, user.id, await auditMeta());
    revalidatePath(user.role === "ADMIN" ? "/admin/vias" : "/user/vias");
    return { status: "success" };
  } catch (error) {
    if (error instanceof ViaError) return { status: "error", error: error.message };
    throw error;
  }
}
