-- Revenue.revenue_date (per-day) -> Revenue.revenue_month (per-month), same
-- rule as AdExpense (migration 20260817140000_ads_expense_monthly): user
-- request 2026-08-18 "Đổi ngày ghi nhận thành tháng ghi nhận", confirmed via
-- AskUserQuestion that a Page allows at most one ACTIVE Revenue row per month
-- — re-entering for the same Page+month overwrites amount/note instead of
-- adding a row (service-layer upsert in revenue.service.ts).
--
-- Note: earlier the same day (2026-08-18), context/schema.md's Changelog
-- explicitly recorded "Revenue KHÔNG đổi — vẫn theo ngày như cũ" as part of
-- the Page-purchase-monthly change. This migration supersedes that note —
-- see the new Changelog entry appended below it.
--
-- Written by hand + applied via `prisma migrate resolve --applied` (shadow DB
-- of `prisma dev` still fails to replay 20260816172220_init from scratch in
-- this environment — same workaround as every prior hand-written migration).

ALTER TABLE "revenues" RENAME COLUMN "revenue_date" TO "revenue_month";

-- Normalize existing rows to the 1st of their month (no data loss — just
-- truncates day-of-month, matching how ad_expenses/page_purchase_expenses
-- were normalized in their own monthly migrations).
UPDATE "revenues" SET "revenue_month" = date_trunc('month', "revenue_month")::date;

CREATE UNIQUE INDEX "revenues_page_month_unique" ON "revenues"("page_id", "revenue_month") WHERE ("deleted_at" IS NULL);
