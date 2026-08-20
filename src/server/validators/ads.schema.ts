import { z } from "zod";
import { moneyInputSchema, moneySchema, monthInputSchema } from "@/server/validators/common.schema";

const pageIdSchema = z.uuid({ error: "Vui lòng chọn Page." });
const paidByAdminIdSchema = z.uuid({ error: "Vui lòng chọn người chi." });

// Client-side (RHF) shape — untransformed, matches server counterpart minus `.transform()`.
const noteInputSchema = z.string().trim().max(2000).optional();
const noteSchema = noteInputSchema.transform((value) => (value ? value : undefined));

export const CreateAdExpenseSchema = z.object({
  pageId: pageIdSchema,
  expenseMonth: monthInputSchema,
  amount: moneySchema,
  note: noteSchema,
  paidByAdminId: paidByAdminIdSchema,
});

export const CreateAdExpenseClientSchema = z.object({
  pageId: pageIdSchema,
  expenseMonth: monthInputSchema,
  amount: moneyInputSchema,
  note: noteInputSchema,
  paidByAdminId: paidByAdminIdSchema,
});

export type CreateAdExpenseFormValues = z.infer<typeof CreateAdExpenseClientSchema>;

// Update carries the same fields — Page/month are editable and re-resolve the
// owner snapshot (schema.md "Khi update page_id hoặc expense_month...").
export const UpdateAdExpenseSchema = CreateAdExpenseSchema;
export const UpdateAdExpenseClientSchema = CreateAdExpenseClientSchema;
export type UpdateAdExpenseFormValues = z.infer<typeof UpdateAdExpenseClientSchema>;
