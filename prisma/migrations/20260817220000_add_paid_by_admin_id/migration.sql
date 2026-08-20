-- Adds `paid_by_admin_id` (which Admin actually paid the money out) to the 3
-- expense tables, distinct from `created_by_admin_id` (who logged the
-- record) — user request 2026-08-17. Added nullable first, backfilled from
-- created_by_admin_id (best available signal for any pre-existing rows —
-- dev DB currently has 1 admin_expenses row and 0 in the other two tables),
-- then tightened to NOT NULL, matching the FK convention already used for
-- created_by_admin_id (ON DELETE RESTRICT ON UPDATE CASCADE).

ALTER TABLE "ad_expenses" ADD COLUMN "paid_by_admin_id" UUID;
UPDATE "ad_expenses" SET "paid_by_admin_id" = "created_by_admin_id" WHERE "paid_by_admin_id" IS NULL;
ALTER TABLE "ad_expenses" ALTER COLUMN "paid_by_admin_id" SET NOT NULL;
ALTER TABLE "ad_expenses" ADD CONSTRAINT "ad_expenses_paid_by_admin_id_fkey" FOREIGN KEY ("paid_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "page_purchase_expenses" ADD COLUMN "paid_by_admin_id" UUID;
UPDATE "page_purchase_expenses" SET "paid_by_admin_id" = "created_by_admin_id" WHERE "paid_by_admin_id" IS NULL;
ALTER TABLE "page_purchase_expenses" ALTER COLUMN "paid_by_admin_id" SET NOT NULL;
ALTER TABLE "page_purchase_expenses" ADD CONSTRAINT "page_purchase_expenses_paid_by_admin_id_fkey" FOREIGN KEY ("paid_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admin_expenses" ADD COLUMN "paid_by_admin_id" UUID;
UPDATE "admin_expenses" SET "paid_by_admin_id" = "created_by_admin_id" WHERE "paid_by_admin_id" IS NULL;
ALTER TABLE "admin_expenses" ALTER COLUMN "paid_by_admin_id" SET NOT NULL;
ALTER TABLE "admin_expenses" ADD CONSTRAINT "admin_expenses_paid_by_admin_id_fkey" FOREIGN KEY ("paid_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
