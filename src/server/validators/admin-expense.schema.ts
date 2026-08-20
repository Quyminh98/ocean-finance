import { z } from "zod";
import { moneyInputSchema, moneySchema, dateSchema } from "@/server/validators/common.schema";

const descriptionInputSchema = z.string().trim().min(1, { error: "Vui lòng nhập nội dung." }).max(500);
const paidByAdminIdSchema = z.uuid({ error: "Vui lòng chọn người chi." });

// Client-side (RHF) shape — untransformed, matches server counterpart minus `.transform()`.
const noteInputSchema = z.string().trim().max(2000).optional();
const noteSchema = noteInputSchema.transform((value) => (value ? value : undefined));

export const CreateAdminExpenseSchema = z.object({
  expenseDate: dateSchema,
  amount: moneySchema,
  description: descriptionInputSchema,
  note: noteSchema,
  paidByAdminId: paidByAdminIdSchema,
});

export const CreateAdminExpenseClientSchema = z.object({
  expenseDate: dateSchema,
  amount: moneyInputSchema,
  description: descriptionInputSchema,
  note: noteInputSchema,
  paidByAdminId: paidByAdminIdSchema,
});

export type CreateAdminExpenseFormValues = z.infer<typeof CreateAdminExpenseClientSchema>;

export const UpdateAdminExpenseSchema = CreateAdminExpenseSchema;
export const UpdateAdminExpenseClientSchema = CreateAdminExpenseClientSchema;
export type UpdateAdminExpenseFormValues = z.infer<typeof UpdateAdminExpenseClientSchema>;
