-- Adds `paid_by_admin_id` to `salary_history` — same "người chi" concept
-- already applied to ad_expenses/page_purchase_expenses/admin_expenses
-- (migration 20260817220000_add_paid_by_admin_id), user request 2026-08-17.
-- Nullable first, backfilled from created_by_admin_id (1 existing row in dev
-- DB at the time), then tightened to NOT NULL + FK (same convention:
-- ON DELETE RESTRICT ON UPDATE CASCADE).

ALTER TABLE "salary_history" ADD COLUMN "paid_by_admin_id" UUID;
UPDATE "salary_history" SET "paid_by_admin_id" = "created_by_admin_id" WHERE "paid_by_admin_id" IS NULL;
ALTER TABLE "salary_history" ALTER COLUMN "paid_by_admin_id" SET NOT NULL;
ALTER TABLE "salary_history" ADD CONSTRAINT "salary_history_paid_by_admin_id_fkey" FOREIGN KEY ("paid_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
