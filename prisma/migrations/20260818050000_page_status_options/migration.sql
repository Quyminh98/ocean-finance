-- Page.status free-text + statusColor -> managed picklist PageStatusOption
-- (user request 2026-08-18, confirmed via AskUserQuestion): "edit và lưu các
-- loại 1 lần để page chỉ việc chọn thôi". Admin now manages a small set of
-- (label, color) options under Cài đặt; Page just references one via
-- status_id. Confirmed answers: (1) reset to a small default set, Admin
-- reassigns existing Pages manually (no attempt to dedupe old free-text
-- values into options); (2) deleting an option in use is allowed — Pages
-- referencing it fall back to status_id = NULL via ON DELETE SET NULL.
-- Written by hand + applied via `prisma migrate resolve --applied` (shadow DB
-- of `prisma dev` still fails to replay 20260816172220_init from scratch in
-- this environment — same workaround as every prior hand-written migration).

CREATE TABLE "page_status_options" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "color" "PageStatusColor" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "page_status_options_pkey" PRIMARY KEY ("id")
);

-- Seed the 2 default options (fixed UUIDs so this migration is
-- deterministic/idempotent-safe to re-read later).
INSERT INTO "page_status_options" ("id", "label", "color", "created_at", "updated_at") VALUES
  ('e49e6297-0e4a-4050-a4b7-af730fc69406', 'Hoạt động', 'GREEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cafc8310-9d48-4a3c-88a5-16cb29ccbdf7', 'Lưu trữ', 'GRAY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "pages" ADD COLUMN "status_id" UUID;

-- Reset existing Pages onto the default set: exact matches map to their
-- corresponding new option, anything else (custom free-text labels typed
-- before this migration) falls back to "Hoạt động" — Admin reassigns
-- manually per the confirmed answer above.
UPDATE "pages" SET "status_id" = CASE "status"
  WHEN 'Lưu trữ' THEN 'cafc8310-9d48-4a3c-88a5-16cb29ccbdf7'::UUID
  ELSE 'e49e6297-0e4a-4050-a4b7-af730fc69406'::UUID
END;

ALTER TABLE "pages" ADD CONSTRAINT "pages_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "page_status_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pages" DROP COLUMN "status";
ALTER TABLE "pages" DROP COLUMN "status_color";
