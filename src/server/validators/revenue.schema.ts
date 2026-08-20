import { z } from "zod";
import { moneyInputSchema, moneySchema, monthInputSchema } from "@/server/validators/common.schema";

const pageIdSchema = z.uuid({ error: "Vui lòng chọn Page." });

// Client-side (RHF) shape — untransformed, matches server counterpart minus `.transform()`.
const noteInputSchema = z.string().trim().max(2000).optional();
const noteSchema = noteInputSchema.transform((value) => (value ? value : undefined));

export const CreateRevenueSchema = z.object({
  pageId: pageIdSchema,
  revenueMonth: monthInputSchema,
  amount: moneySchema,
  note: noteSchema,
});

export const CreateRevenueClientSchema = z.object({
  pageId: pageIdSchema,
  revenueMonth: monthInputSchema,
  amount: moneyInputSchema,
  note: noteInputSchema,
});

export type CreateRevenueFormValues = z.infer<typeof CreateRevenueClientSchema>;

// Update carries the same fields — Page/month are editable and re-resolve the
// owner snapshot (schema.md "Khi update page_id hoặc revenue_month...").
export const UpdateRevenueSchema = CreateRevenueSchema;
export const UpdateRevenueClientSchema = CreateRevenueClientSchema;
export type UpdateRevenueFormValues = z.infer<typeof UpdateRevenueClientSchema>;
