-- Page purchase moves from per-day (`purchase_date`) to per-calendar-month
-- (`purchase_month`, always normalized to the 1st of the month) — same
-- treatment as AdExpense in migration 20260817140000_ads_expense_monthly,
-- applied here to both `pages` and `page_purchase_expenses` (user request
-- 2026-08-18). Any pre-existing values are truncated to the 1st of their
-- month so the column is consistent going forward.

ALTER TABLE "pages" RENAME COLUMN "purchase_date" TO "purchase_month";
UPDATE "pages" SET "purchase_month" = date_trunc('month', "purchase_month")::date;

ALTER TABLE "page_purchase_expenses" RENAME COLUMN "purchase_date" TO "purchase_month";
UPDATE "page_purchase_expenses" SET "purchase_month" = date_trunc('month', "purchase_month")::date;
