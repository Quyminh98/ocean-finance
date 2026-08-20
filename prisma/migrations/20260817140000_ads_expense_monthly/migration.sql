-- AdExpense moves from per-day (`expense_date`) to per-calendar-month
-- (`expense_month`, always normalized to the 1st of the month). At most one
-- active (non-deleted) record per Page per month.
ALTER TABLE "ad_expenses" RENAME COLUMN "expense_date" TO "expense_month";

CREATE UNIQUE INDEX "ad_expenses_page_month_unique" ON "ad_expenses"("page_id", "expense_month") WHERE ("deleted_at" IS NULL);
