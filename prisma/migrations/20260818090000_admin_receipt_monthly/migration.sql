-- Admin Receipt tracking moves from day-level to month-level, mirroring
-- the same rename already done for Revenue (20260818070000_revenue_monthly)
-- and Page purchase (20260818010000_page_purchase_monthly) — user request
-- 2026-08-18. Unlike Revenue/AdExpense, AdminReceipt has no Page dimension
-- and no per-month uniqueness rule (multiple receipts/month were already
-- allowed at day precision — spec §9 "Có thể có nhiều khoản nhận trong một
-- tháng" — so this migration does NOT add a unique index, only changes
-- precision).
-- Written by hand + applied via `prisma migrate resolve --applied` (shadow
-- DB of `prisma dev` still fails to replay 20260816172220_init from scratch
-- in this environment — same workaround as every prior hand-written
-- migration).

ALTER TABLE "admin_receipts" RENAME COLUMN "receipt_date" TO "receipt_month";
UPDATE "admin_receipts" SET "receipt_month" = date_trunc('month', "receipt_month")::date;
