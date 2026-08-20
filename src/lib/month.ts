/** Parses a "YYYY-MM" key into the normalized 1st-of-month Date (UTC) — matches `AdExpense.expenseMonth` storage. */
export function parseMonthKey(month: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return new Date(Date.UTC(year, monthIndex, 1));
}

/** [gte, lt) Date range for a "YYYY-MM" month key — for filtering DATE columns like `revenueDate`/`expenseDate`. */
export function monthDateRange(month: string): { gte: Date; lt: Date } | null {
  const start = parseMonthKey(month);
  if (!start) return null;
  return { gte: start, lt: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)) };
}

/** Shifts a "YYYY-MM" key by `delta` months (negative = past). */
export function shiftMonthKey(month: string, delta: number): string {
  const start = parseMonthKey(month);
  if (!start) throw new Error(`Invalid month key: ${month}`);
  const shifted = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}
