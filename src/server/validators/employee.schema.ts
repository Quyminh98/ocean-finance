import { z } from "zod";
import { moneyInputSchema, moneySchema } from "@/server/validators/common.schema";

const nameSchema = z.string().trim().min(1, { error: "Vui lòng nhập tên." }).max(200);

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Email không hợp lệ." }));

const statusSchema = z.enum(["ACTIVE", "INACTIVE"], { error: "Trạng thái không hợp lệ." });

const passwordSchema = z.string().min(8, { error: "Mật khẩu tối thiểu 8 ký tự." });

// No salary fields here (spec §14.2) — a new employee has no SalaryHistory
// until Admin sets one via "Đổi lương" on the Employee Detail page.
// `password` set by the Admin creating the account (user request 2026-08-19)
// — replaces the earlier auto-generated temp password for the Web UI flow.
// The MCP `create_employee` tool still omits it and gets an auto-generated
// one back (an AI agent has no business inventing a login password for a
// human), so this stays optional at the service layer — see employee.service.ts.
export const CreateEmployeeSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  status: statusSchema,
  password: passwordSchema,
});

export const CreateEmployeeClientSchema = CreateEmployeeSchema.extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  error: "Mật khẩu xác nhận không khớp.",
  path: ["confirmPassword"],
});

export type CreateEmployeeFormValues = z.infer<typeof CreateEmployeeClientSchema>;

export const UpdateEmployeeSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  status: statusSchema,
});

export type UpdateEmployeeFormValues = z.infer<typeof UpdateEmployeeSchema>;

const paidByAdminIdSchema = z.uuid({ error: "Vui lòng chọn người chi." });

// No `effectiveFrom` field (user request 2026-08-18) — every salary change
// takes effect immediately as of today; the server stamps that date itself
// (`currentDateKey()`, employee.actions.ts) rather than trusting client input.
export const SetEmployeeSalarySchema = z.object({
  monthlySalary: moneySchema,
  paidByAdminId: paidByAdminIdSchema,
});

export const SetEmployeeSalaryClientSchema = z.object({
  monthlySalary: moneyInputSchema,
  paidByAdminId: paidByAdminIdSchema,
});

export type SetEmployeeSalaryFormValues = z.infer<typeof SetEmployeeSalaryClientSchema>;
