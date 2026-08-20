"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/rbac";
import { CreateEmployeeReceiptSchema, UpdateEmployeeReceiptSchema } from "@/server/validators/employee-receipt.schema";
import {
  createEmployeeReceipt,
  updateEmployeeReceipt,
  softDeleteEmployeeReceipt,
  EmployeeReceiptError,
} from "@/server/services/employee-receipt.service";
import { parseMonthKey } from "@/lib/month";

function monthKeyToDate(monthKey: string): Date {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) throw new EmployeeReceiptError("Tháng không hợp lệ.", "INVALID_MONTH");
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

export type CreateEmployeeReceiptState = ActionErrorState | { status: "success"; employeeReceiptId: string; wasUpdate: boolean };

export async function createEmployeeReceiptAction(input: unknown): Promise<CreateEmployeeReceiptState> {
  const admin = await requireAdmin();

  const parsed = CreateEmployeeReceiptSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    const result = await createEmployeeReceipt(
      {
        employeeId: parsed.data.employeeId,
        receiptMonth: monthKeyToDate(parsed.data.receiptMonth),
        amount: parsed.data.amount,
        note: parsed.data.note,
      },
      admin.id,
      await auditMeta(),
    );
    revalidatePath("/admin/employee-receipts");
    return { status: "success", employeeReceiptId: result.employeeReceiptId, wasUpdate: result.wasUpdate };
  } catch (error) {
    if (error instanceof EmployeeReceiptError) return { status: "error", error: error.message };
    throw error;
  }
}

export type UpdateEmployeeReceiptState = ActionErrorState | { status: "success" };

export async function updateEmployeeReceiptAction(employeeReceiptId: string, input: unknown): Promise<UpdateEmployeeReceiptState> {
  const admin = await requireAdmin();

  const parsed = UpdateEmployeeReceiptSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await updateEmployeeReceipt(
      employeeReceiptId,
      {
        employeeId: parsed.data.employeeId,
        receiptMonth: monthKeyToDate(parsed.data.receiptMonth),
        amount: parsed.data.amount,
        note: parsed.data.note,
      },
      admin.id,
      await auditMeta(),
    );
    revalidatePath("/admin/employee-receipts");
    return { status: "success" };
  } catch (error) {
    if (error instanceof EmployeeReceiptError) return { status: "error", error: error.message };
    throw error;
  }
}

export type DeleteEmployeeReceiptState = { status: "error"; error: string } | { status: "success" };

export async function deleteEmployeeReceiptAction(employeeReceiptId: string): Promise<DeleteEmployeeReceiptState> {
  const admin = await requireAdmin();

  try {
    await softDeleteEmployeeReceipt(employeeReceiptId, admin.id, await auditMeta());
    revalidatePath("/admin/employee-receipts");
    return { status: "success" };
  } catch (error) {
    if (error instanceof EmployeeReceiptError) return { status: "error", error: error.message };
    throw error;
  }
}
