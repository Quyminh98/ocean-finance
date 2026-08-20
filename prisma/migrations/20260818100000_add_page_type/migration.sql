-- CreateEnum
CREATE TYPE "PageType" AS ENUM ('SYSTEM', 'BKT');

-- AlterTable
-- Default BKT preserves current behavior for every existing row (all
-- existing Pages went through the paid-purchase flow).
ALTER TABLE "pages" ADD COLUMN "page_type" "PageType" NOT NULL DEFAULT 'BKT';
