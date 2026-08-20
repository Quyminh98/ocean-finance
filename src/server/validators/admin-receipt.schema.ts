import { z } from "zod";
import { moneyInputSchema, moneySchema, monthInputSchema } from "@/server/validators/common.schema";

const sourceInputSchema = z.string().trim().min(1, { error: "Vui lòng nhập nguồn/mô tả." }).max(500);
const receivedByAdminIdSchema = z.uuid({ error: "Vui lòng chọn admin nhận." });

// Client-side (RHF) shape — untransformed, matches server counterpart minus `.transform()`.
const noteInputSchema = z.string().trim().max(2000).optional();
const noteSchema = noteInputSchema.transform((value) => (value ? value : undefined));

export const CreateAdminReceiptSchema = z.object({
  receiptMonth: monthInputSchema,
  amount: moneySchema,
  source: sourceInputSchema,
  note: noteSchema,
  receivedByAdminId: receivedByAdminIdSchema,
});

export const CreateAdminReceiptClientSchema = z.object({
  receiptMonth: monthInputSchema,
  amount: moneyInputSchema,
  source: sourceInputSchema,
  note: noteInputSchema,
  receivedByAdminId: receivedByAdminIdSchema,
});

export type CreateAdminReceiptFormValues = z.infer<typeof CreateAdminReceiptClientSchema>;

export const UpdateAdminReceiptSchema = CreateAdminReceiptSchema;
export const UpdateAdminReceiptClientSchema = CreateAdminReceiptClientSchema;
export type UpdateAdminReceiptFormValues = z.infer<typeof UpdateAdminReceiptClientSchema>;
