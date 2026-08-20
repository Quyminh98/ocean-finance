import { z } from "zod";
import { moneyInputSchema, moneySchema, dateSchema, monthInputSchema } from "@/server/validators/common.schema";

const nameSchema = z.string().trim().min(1, { error: "Vui lòng nhập tên Page." }).max(200);

const facebookUrlSchema = z
  .string()
  .trim()
  .pipe(z.url({ error: "Facebook URL không hợp lệ." }));

// References PageStatusOption (Cài đặt → "Loại trạng thái Page" — user
// request 2026-08-18, replaces the earlier free-text status + per-Page
// color). Array — a Page can carry multiple status tags at once (user
// request 2026-08-18, "chọn nhiều trạng thái được"); empty = "chưa đặt".
// See page-status-option.schema.ts for the color preset list. Client-side
// shape stays a plain (untransformed) array — the form always supplies one,
// even if empty — same input/output-parity reasoning as notesInputSchema.
export const statusIdsInputSchema = z.array(z.uuid());

// Server-side counterpart — also accepts the field being omitted entirely
// (e.g. a future MCP caller), collapsing to an empty array.
export const statusIdsSchema = statusIdsInputSchema.optional().transform((value) => value ?? []);

// Client-side (RHF) shape — untransformed, so the resolver's input/output
// types match exactly (RHF's handleSubmit calls back with this same shape).
const notesInputSchema = z.string().trim().max(2000).optional();

// Server-side counterpart — collapses a blank string to `undefined` so an
// empty notes field is persisted as `null`, not `""`.
const notesSchema = notesInputSchema.transform((value) => (value ? value : undefined));

const uuidSchema = z.uuid({ error: "Vui lòng chọn nhân viên." });

// Sentinel for "no employee assigned yet" in the Create Page <Select> — Base
// UI's Select needs a defined item value, so "" can't represent "unset".
// Employee assignment is optional at creation (user request) — an unassigned
// Page can have one attached later via "Gán nhân viên" on Page Detail.
export const NO_EMPLOYEE_SENTINEL = "unassigned";

const assignEmployeeIdInputSchema = z.union([z.literal(NO_EMPLOYEE_SENTINEL), uuidSchema]);

// Server-side counterpart — collapses the sentinel to `undefined`.
const assignEmployeeIdSchema = assignEmployeeIdInputSchema.transform((value) =>
  value === NO_EMPLOYEE_SENTINEL ? undefined : value,
);

// "Người chi" — only meaningful (and only shown in the UI) when purchasePrice
// > 0; the service layer enforces the real requirement, so the schema itself
// just accepts "unset" via an empty string, same sentinel pattern as
// `assignEmployeeIdInputSchema` above. Captured once at Create Page — never
// asked again in AssignEmployeeSchema below (Page.paidByAdminId is reused).
const paidByAdminIdBaseSchema = z.uuid({ error: "Vui lòng chọn người chi." });
const paidByAdminIdInputSchema = z.union([z.literal(""), paidByAdminIdBaseSchema]);
const paidByAdminIdSchema = paidByAdminIdInputSchema.transform((value) => (value ? value : undefined));

// SYSTEM = no purchase price (Admin form hides price/payer, User self-service
// only creates this type). BKT = existing paid-purchase flow, Admin-only.
export const PAGE_TYPES = ["SYSTEM", "BKT"] as const;
export type PageTypeValue = (typeof PAGE_TYPES)[number];
const pageTypeSchema = z.enum(PAGE_TYPES, { error: "Vui lòng chọn loại Page." });

export const CreatePageSchema = z.object({
  name: nameSchema,
  facebookUrl: facebookUrlSchema,
  pageType: pageTypeSchema,
  purchasePrice: moneySchema,
  purchaseMonth: monthInputSchema,
  assignEmployeeId: assignEmployeeIdSchema,
  paidByAdminId: paidByAdminIdSchema,
  statusIds: statusIdsSchema,
  notes: notesSchema,
});

// Client-side (RHF) counterpart — money kept as a validated string, never
// routed through BigInt across the Server Action RPC boundary (same reasoning
// as employee.schema.ts).
export const CreatePageClientSchema = z.object({
  name: nameSchema,
  facebookUrl: facebookUrlSchema,
  pageType: pageTypeSchema,
  purchasePrice: moneyInputSchema,
  purchaseMonth: monthInputSchema,
  assignEmployeeId: assignEmployeeIdInputSchema,
  paidByAdminId: paidByAdminIdInputSchema,
  statusIds: statusIdsInputSchema,
  notes: notesInputSchema,
});

export type CreatePageFormValues = z.infer<typeof CreatePageClientSchema>;

// User self-service — always pageType=SYSTEM, no price/payer/employee picker
// (spec 2026-08-18 "User tự thêm page hệ thống vào account do mình quản lý").
export const CreateSystemPageSelfSchema = z.object({
  name: nameSchema,
  facebookUrl: facebookUrlSchema,
  statusIds: statusIdsSchema,
  notes: notesSchema,
});

export const CreateSystemPageSelfClientSchema = z.object({
  name: nameSchema,
  facebookUrl: facebookUrlSchema,
  statusIds: statusIdsInputSchema,
  notes: notesInputSchema,
});

export type CreateSystemPageSelfFormValues = z.infer<typeof CreateSystemPageSelfClientSchema>;

export const UpdatePageSchema = z.object({
  name: nameSchema,
  facebookUrl: facebookUrlSchema,
  statusIds: statusIdsSchema,
  notes: notesSchema,
});

export const UpdatePageClientSchema = z.object({
  name: nameSchema,
  facebookUrl: facebookUrlSchema,
  statusIds: statusIdsInputSchema,
  notes: notesInputSchema,
});

export type UpdatePageFormValues = z.infer<typeof UpdatePageClientSchema>;

// Employee-scoped "chỉ có thể edit được trạng thái" (user request
// 2026-08-18) — same statusIds shape as UpdatePageSchema above, just without
// name/facebookUrl/notes (those stay Admin-only).
export const UpdatePageStatusSchema = z.object({
  statusIds: statusIdsSchema,
});

export const UpdatePageStatusClientSchema = z.object({
  statusIds: statusIdsInputSchema,
});

export type UpdatePageStatusFormValues = z.infer<typeof UpdatePageStatusClientSchema>;

export const TransferPageSchema = z.object({
  newEmployeeId: uuidSchema,
  effectiveDate: dateSchema,
  note: notesSchema,
});

export const TransferPageClientSchema = z.object({
  newEmployeeId: uuidSchema,
  effectiveDate: dateSchema,
  note: notesInputSchema,
});

export type TransferPageFormValues = z.infer<typeof TransferPageClientSchema>;

// First-time assignment for a Page that currently has no active
// PageAssignment at all — distinct from Transfer, which requires an existing
// active assignment to close first.
export const AssignEmployeeSchema = z.object({
  employeeId: uuidSchema,
  effectiveDate: dateSchema,
  note: notesSchema,
});

export const AssignEmployeeClientSchema = z.object({
  employeeId: uuidSchema,
  effectiveDate: dateSchema,
  note: notesInputSchema,
});

export type AssignEmployeeFormValues = z.infer<typeof AssignEmployeeClientSchema>;
