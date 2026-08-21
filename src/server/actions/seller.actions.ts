"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/rbac";
import { CreateSellerSchema, UpdateSellerSchema } from "@/server/validators/seller.schema";
import { createSeller, updateSeller, deleteSeller, SellerError } from "@/server/services/seller.service";

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

export type CreateSellerState = ActionErrorState | { status: "success"; sellerId: string };

export async function createSellerAction(input: unknown): Promise<CreateSellerState> {
  const admin = await requireAdmin();

  const parsed = CreateSellerSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    const result = await createSeller(parsed.data, admin.id, await auditMeta());
    revalidatePath("/admin/settings/sellers");
    revalidatePath("/admin/pages/new");
    return { status: "success", sellerId: result.sellerId };
  } catch (error) {
    if (error instanceof SellerError) return { status: "error", error: error.message };
    throw error;
  }
}

export type UpdateSellerState = ActionErrorState | { status: "success" };

export async function updateSellerAction(sellerId: string, input: unknown): Promise<UpdateSellerState> {
  const admin = await requireAdmin();

  const parsed = UpdateSellerSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await updateSeller(sellerId, parsed.data, admin.id, await auditMeta());
    revalidatePath("/admin/settings/sellers");
    revalidatePath("/admin/pages");
    return { status: "success" };
  } catch (error) {
    if (error instanceof SellerError) return { status: "error", error: error.message };
    throw error;
  }
}

export type DeleteSellerState = { status: "error"; error: string } | { status: "success" };

export async function deleteSellerAction(sellerId: string): Promise<DeleteSellerState> {
  const admin = await requireAdmin();

  try {
    await deleteSeller(sellerId, admin.id, await auditMeta());
    revalidatePath("/admin/settings/sellers");
    revalidatePath("/admin/pages");
    return { status: "success" };
  } catch (error) {
    if (error instanceof SellerError) return { status: "error", error: error.message };
    throw error;
  }
}
