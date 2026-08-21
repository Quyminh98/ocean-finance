-- DropForeignKey
ALTER TABLE "ad_expenses" DROP CONSTRAINT "ad_expenses_assignment_id_snapshot_fkey";

-- DropForeignKey
ALTER TABLE "ad_expenses" DROP CONSTRAINT "ad_expenses_employee_id_snapshot_fkey";

-- DropForeignKey
ALTER TABLE "ad_expenses" DROP CONSTRAINT "ad_expenses_page_id_fkey";

-- DropIndex
DROP INDEX "ad_expenses_page_month_unique";

-- AlterTable
ALTER TABLE "ad_expenses" DROP COLUMN "assignment_id_snapshot",
DROP COLUMN "employee_id_snapshot",
DROP COLUMN "page_id",
ADD COLUMN     "employee_id" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ad_expenses_employee_month_unique" ON "ad_expenses"("employee_id", "expense_month") WHERE (deleted_at IS NULL);

-- AddForeignKey
ALTER TABLE "ad_expenses" ADD CONSTRAINT "ad_expenses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
