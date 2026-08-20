-- Page.status: enum ACTIVE|ARCHIVED -> free-text label (user request
-- 2026-08-18). Adds Page.statusColor (new PageStatusColor enum, a small
-- preset palette drawn only from tokens already in globals.css/DESIGN.md —
-- no free-form hex) so Admin can pick a swatch alongside the custom label.
-- Written by hand + applied via `prisma migrate resolve --applied` because
-- `prisma migrate dev`'s shadow DB fails to replay 20260816172220_init from
-- scratch in this environment (pre-existing issue, see
-- 20260817140000_ads_expense_monthly/migration.sql for the same workaround).

-- 1. New preset-color enum + column, backfilled from the *old* status value
--    before that column changes type (ACTIVE -> GREEN, ARCHIVED -> GRAY, the
--    "keep text + default color" mapping confirmed with the user).
CREATE TYPE "PageStatusColor" AS ENUM ('GRAY', 'GREEN', 'BLUE', 'AMBER', 'RED');

ALTER TABLE "pages" ADD COLUMN "status_color" "PageStatusColor";

UPDATE "pages"
SET "status_color" = CASE "status"
  WHEN 'ACTIVE' THEN 'GREEN'
  WHEN 'ARCHIVED' THEN 'GRAY'
END::"PageStatusColor";

ALTER TABLE "pages" ALTER COLUMN "status_color" SET NOT NULL;
ALTER TABLE "pages" ALTER COLUMN "status_color" SET DEFAULT 'GREEN';

-- 2. Convert `status` from the PageStatus enum to free text, translating
--    existing values to their Vietnamese label so displayed text doesn't
--    change for any existing row.
ALTER TABLE "pages" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "pages" ALTER COLUMN "status" TYPE TEXT USING (
  CASE "status"::text
    WHEN 'ACTIVE' THEN 'Hoạt động'
    WHEN 'ARCHIVED' THEN 'Lưu trữ'
    ELSE "status"::text
  END
);
ALTER TABLE "pages" ALTER COLUMN "status" SET DEFAULT 'Hoạt động';

-- 3. Drop the now-unused enum type.
DROP TYPE "PageStatus";
