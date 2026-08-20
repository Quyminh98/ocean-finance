"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/rbac";
import {
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
  SetEmployeeSalarySchema,
} from "@/server/validators/employee.schema";
import { createEmployee, updateEmployee, deactivateEmployee, EmployeeError } from "@/server/services/employee.service";
import { setEmployeeSalary } from "@/server/services/salary.service";
import { currentDateKey } from "@/lib/dates";

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

export type CreateEmployeeState = ActionErrorState | { status: "success"; employeeId: string };

export async function createEmployeeAction(input: unknown): Promise<CreateEmployeeState> {
  const admin = await requireAdmin();

  const parsed = CreateEmployeeSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    const result = await createEmployee(
      { name: parsed.data.name, email: parsed.data.email, status: parsed.data.status, password: parsed.data.password },
      admin.id,
      await auditMeta(),
    );
    revalidatePath("/admin/employees");
    return { status: "success", employeeId: result.employeeId };
  } catch (error) {
    if (error instanceof EmployeeError) return { status: "error", error: error.message };
    throw error;
  }
}

export type UpdateEmployeeState = ActionErrorState | { status: "success" };

export async function updateEmployeeAction(employeeId: string, input: unknown): Promise<UpdateEmployeeState> {
  const admin = await requireAdmin();

  const parsed = UpdateEmployeeSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await updateEmployee(employeeId, parsed.data, admin.id, await auditMeta());
    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${employeeId}`);
    return { status: "success" };
  } catch (error) {
    if (error instanceof EmployeeError) return { status: "error", error: error.message };
    throw error;
  }
}

export type DeactivateEmployeeState = ActionErrorState | { status: "success" } | undefined;

export async function deactivateEmployeeAction(employeeId: string): Promise<DeactivateEmployeeState> {
  const admin = await requireAdmin();

  try {
    await deactivateEmployee(employeeId, admin.id, await auditMeta());
    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${employeeId}`);
    return { status: "success" };
  } catch (error) {
    if (error instanceof EmployeeError) return { status: "error", error: error.message };
    throw error;
  }
}

export type SetEmployeeSalaryState = ActionErrorState | { status: "success" };

export async function setEmployeeSalaryAction(employeeId: string, input: unknown): Promise<SetEmployeeSalaryState> {
  const admin = await requireAdmin();

  const parsed = SetEmployeeSalarySchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await setEmployeeSalary(
      employeeId,
      {
        monthlySalary: parsed.data.monthlySalary,
        effectiveFrom: new Date(currentDateKey()),
        paidByAdminId: parsed.data.paidByAdminId,
      },
      admin.id,
      await auditMeta(),
    );
    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${employeeId}`);
    return { status: "success" };
  } catch (error) {
    if (error instanceof EmployeeError) return { status: "error", error: error.message };
    throw error;
  }
}
