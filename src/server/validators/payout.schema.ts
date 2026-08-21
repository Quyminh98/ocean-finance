import { z } from "zod";

// "Tên payout" — the identifying label shown in PayoutPicker and everywhere a Page's payout is
// displayed (user request 2026-08-21) — distinct from bankName, the underlying bank account detail.
const nameSchema = z
  .string()
  .trim()
  .min(1, { error: "Vui lòng nhập tên payout." })
  .max(100, { error: "Tên payout tối đa 100 ký tự." });

const bankNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Vui lòng nhập tên bank." })
  .max(100, { error: "Tên bank tối đa 100 ký tự." });

// Fixed 2-value status (user request 2026-08-20) — not a user-defined
// picklist like PageStatusColor, no separate options table.
export const PAYOUT_STATUSES = ["ACTIVE", "ISSUE"] as const;
export type PayoutStatusValue = (typeof PAYOUT_STATUSES)[number];
const payoutStatusSchema = z.enum(PAYOUT_STATUSES, { error: "Trạng thái không hợp lệ." });

// Client-side (RHF) shape — untransformed, so the resolver's input/output
// types match exactly (same input/output-parity reasoning as page.schema.ts's notesInputSchema).
const noteInputSchema = z.string().trim().max(2000).optional();

// Server-side counterpart — collapses a blank string to `undefined` so an
// empty note is persisted as `null`, not `""`.
const noteSchema = noteInputSchema.transform((value) => (value ? value : undefined));

export const CreatePayoutSchema = z.object({ name: nameSchema, bankName: bankNameSchema, status: payoutStatusSchema, note: noteSchema });
export const CreatePayoutClientSchema = z.object({
  name: nameSchema,
  bankName: bankNameSchema,
  status: payoutStatusSchema,
  note: noteInputSchema,
});
export type CreatePayoutFormValues = z.infer<typeof CreatePayoutClientSchema>;

export const UpdatePayoutSchema = CreatePayoutSchema;
export const UpdatePayoutClientSchema = CreatePayoutClientSchema;
export type UpdatePayoutFormValues = z.infer<typeof UpdatePayoutClientSchema>;
