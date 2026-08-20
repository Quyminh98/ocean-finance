const TIMEZONE = "Asia/Ho_Chi_Minh";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Formats a Date/ISO string as "dd/mm/yyyy" in Asia/Ho_Chi_Minh timezone. */
export function formatDate(date: Date | string): string {
  return dateFormatter.format(typeof date === "string" ? new Date(date) : date);
}

/** Formats a month value ("2026-08") as "Tháng 08/2026". */
export function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  return `Tháng ${m}/${year}`;
}

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Formats a Date/ISO string as "dd/mm/yyyy HH:mm" in Asia/Ho_Chi_Minh timezone — Audit Log timestamps (spec §29). */
export function formatDateTime(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return `${formatDate(value)} ${timeFormatter.format(value)}`;
}

/** Vietnamese relative time label ("5 phút trước", "Hôm qua"...) for Recent Activity feeds; falls back to `formatDate` past 7 days. */
export function formatRelativeTime(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return "Hôm qua";
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return formatDate(date);
}

/** Current month key ("2026-08") in Asia/Ho_Chi_Minh timezone. */
export function currentMonthKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

/** Current date key ("2026-08-18") in Asia/Ho_Chi_Minh timezone — "YYYY-MM-DD" (matches `dateSchema`). */
export function currentDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}
