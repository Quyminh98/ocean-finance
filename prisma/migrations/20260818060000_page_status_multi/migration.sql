-- Page.status_id (single nullable FK -> PageStatusOption) -> many-to-many via
-- new join table page_status_assignments (user request 2026-08-18: "Trạng
-- thái có thể chọn nhiều trạng thái được"). Existing single assignments are
-- carried over 1:1 into the join table before the column is dropped, so no
-- Page loses its current status tag.
-- Written by hand + applied via `prisma migrate resolve --applied` (shadow DB
-- of `prisma dev` still fails to replay 20260816172220_init from scratch in
-- this environment — same workaround as every prior hand-written migration).

CREATE TABLE "page_status_assignments" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "status_option_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_status_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "page_status_assignments_unique" ON "page_status_assignments"("page_id", "status_option_id");

ALTER TABLE "page_status_assignments" ADD CONSTRAINT "page_status_assignments_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "page_status_assignments" ADD CONSTRAINT "page_status_assignments_status_option_id_fkey" FOREIGN KEY ("status_option_id") REFERENCES "page_status_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every Page that currently has a status_id gets exactly one row
-- in the new join table carrying that same assignment forward.
INSERT INTO "page_status_assignments" ("id", "page_id", "status_option_id", "created_at")
SELECT gen_random_uuid(), "id", "status_id", CURRENT_TIMESTAMP
FROM "pages"
WHERE "status_id" IS NOT NULL;

ALTER TABLE "pages" DROP CONSTRAINT "pages_status_id_fkey";
ALTER TABLE "pages" DROP COLUMN "status_id";
