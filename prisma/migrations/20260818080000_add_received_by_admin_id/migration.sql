-- Adds `received_by_admin_id` (which Admin actually RECEIVED the money) to
-- admin_receipts, distinct from `created_by_admin_id` (who logged the
-- record) — user request 2026-08-18, same distinction as `paid_by_admin_id`
-- on the 3 expense tables (migration 20260817220000_add_paid_by_admin_id).
-- Added nullable first, backfilled from created_by_admin_id (best available
-- signal for any pre-existing rows — dev DB has 0 rows in admin_receipts at
-- the time of this migration, so this is a no-op backfill), then tightened
-- to NOT NULL, matching the FK convention already used for
-- created_by_admin_id (ON DELETE RESTRICT ON UPDATE CASCADE).
-- Written by hand + applied via `prisma migrate resolve --applied` (shadow DB
-- of `prisma dev` still fails to replay 20260816172220_init from scratch in
-- this environment — same workaround as every prior hand-written migration).

ALTER TABLE "admin_receipts" ADD COLUMN "received_by_admin_id" UUID;
UPDATE "admin_receipts" SET "received_by_admin_id" = "created_by_admin_id" WHERE "received_by_admin_id" IS NULL;
ALTER TABLE "admin_receipts" ALTER COLUMN "received_by_admin_id" SET NOT NULL;
ALTER TABLE "admin_receipts" ADD CONSTRAINT "admin_receipts_received_by_admin_id_fkey" FOREIGN KEY ("received_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
