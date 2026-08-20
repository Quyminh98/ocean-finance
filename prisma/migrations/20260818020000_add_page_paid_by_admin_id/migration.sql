-- Adds `paid_by_admin_id` to `pages` (nullable — only meaningful when
-- purchase_price > 0) — user request 2026-08-18. Captures the designated
-- payer at Page creation time regardless of whether an employee is assigned
-- yet, so `assignEmployee()` can reuse it later instead of asking again when
-- it finally creates the deferred PagePurchaseExpense. No backfill needed:
-- dev DB has 0 rows in `pages` at the time of this migration.

ALTER TABLE "pages" ADD COLUMN "paid_by_admin_id" UUID;
ALTER TABLE "pages" ADD CONSTRAINT "pages_paid_by_admin_id_fkey" FOREIGN KEY ("paid_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
