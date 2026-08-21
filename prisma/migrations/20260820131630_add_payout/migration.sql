-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('ACTIVE', 'ISSUE');

-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "payout_id" UUID;

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL,
    "bank_name" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
