const vndFormatter = new Intl.NumberFormat("vi-VN");

/** Formats a BIGINT-safe integer VND amount as "10.000.000 ₫". */
export function formatVnd(amount: number | bigint): string {
  return `${vndFormatter.format(Number(amount))} ₫`;
}

// Semantic money coloring (DESIGN.md "Success/Error colors reserved for
// financial trends") — revenue/tiền nhận (dương) = xanh, chi phí (âm) = đỏ,
// lợi nhuận theo dấu thực tế.
export const REVENUE_TEXT_CLASS = "text-success-green";
export const EXPENSE_TEXT_CLASS = "text-error-red";

/** Profit/lợi nhuận: green when >= 0, red when negative. */
export function profitTextClass(amount: number | bigint): string {
  return Number(amount) < 0 ? EXPENSE_TEXT_CLASS : REVENUE_TEXT_CLASS;
}
