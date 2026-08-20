import { z } from "zod";

// Digit-only string shared by client and server validation. Server schemas
// additionally `.transform()` this straight to BigInt — never routed through
// `number`, so there's no floating-point risk (CLAUDE.md "Database").
export const moneyInputSchema = z
  .string()
  .trim()
  .min(1, { error: "Vui lòng nhập số tiền." })
  .regex(/^\d+$/, { error: "Số tiền phải là số nguyên, lớn hơn hoặc bằng 0." });

export const moneySchema = moneyInputSchema.transform((value) => BigInt(value));

export const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Ngày không hợp lệ." });

// "YYYY-MM" — used by AdExpense (tracked per calendar month, not per day).
export const monthInputSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/, { error: "Tháng không hợp lệ." });
