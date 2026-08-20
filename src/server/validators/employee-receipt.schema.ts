import { z } from "zod";
import { moneyInputSchema, moneySchema, monthInputSchema } from "@/server/validators/common.schema";

const employeeIdSchema = z.uuid({ error: "Vui lòng chọn nhân viên." });

// Client-side (RHF) shape — untransformed, matches server counterpart minus `.transform()`.
const noteInputSchema = z.string().trim().max(2000).optional();
const noteSchema = noteInputSchema.transform((value) => (value ? value : undefined));

export const CreateEmployeeReceiptSchema = z.object({
  employeeId: employeeIdSchema,
  receiptMonth: monthInputSchema,
  amount: moneySchema,
  note: noteSchema,
});

export const CreateEmployeeReceiptClientSchema = z.object({
  employeeId: employeeIdSchema,
  receiptMonth: monthInputSchema,
  amount: moneyInputSchema,
  note: noteInputSchema,
});

export type CreateEmployeeReceiptFormValues = z.infer<typeof CreateEmployeeReceiptClientSchema>;

// Update carries the same fields — employee/month are editable, reject on conflict (see service).
export const UpdateEmployeeReceiptSchema = CreateEmployeeReceiptSchema;
export const UpdateEmployeeReceiptClientSchema = CreateEmployeeReceiptClientSchema;
export type UpdateEmployeeReceiptFormValues = z.infer<typeof UpdateEmployeeReceiptClientSchema>;
