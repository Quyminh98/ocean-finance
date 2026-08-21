import { z } from "zod";
import { moneyInputSchema, moneySchema, monthInputSchema } from "@/server/validators/common.schema";

const employeeIdSchema = z.uuid({ error: "Vui lòng chọn nhân viên." });
const paidByAdminIdSchema = z.uuid({ error: "Vui lòng chọn người chi." });

// Client-side (RHF) shape — untransformed, matches server counterpart minus `.transform()`.
const noteInputSchema = z.string().trim().max(2000).optional();
const noteSchema = noteInputSchema.transform((value) => (value ? value : undefined));

export const CreateAdExpenseSchema = z.object({
  employeeId: employeeIdSchema,
  expenseMonth: monthInputSchema,
  amount: moneySchema,
  note: noteSchema,
  paidByAdminId: paidByAdminIdSchema,
});

export const CreateAdExpenseClientSchema = z.object({
  employeeId: employeeIdSchema,
  expenseMonth: monthInputSchema,
  amount: moneyInputSchema,
  note: noteInputSchema,
  paidByAdminId: paidByAdminIdSchema,
});

export type CreateAdExpenseFormValues = z.infer<typeof CreateAdExpenseClientSchema>;

// Update carries the same fields — employee/month đổi được, chỉ cần không
// đụng record active khác (user request 2026-08-20, Ads không còn qua Page).
export const UpdateAdExpenseSchema = CreateAdExpenseSchema;
export const UpdateAdExpenseClientSchema = CreateAdExpenseClientSchema;
export type UpdateAdExpenseFormValues = z.infer<typeof UpdateAdExpenseClientSchema>;
