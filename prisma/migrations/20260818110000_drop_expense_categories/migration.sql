-- DropForeignKey
ALTER TABLE "admin_expenses" DROP CONSTRAINT IF EXISTS "admin_expenses_category_id_fkey";

-- AlterTable
ALTER TABLE "admin_expenses" DROP COLUMN "category_id";

-- DropTable
DROP TABLE "expense_categories";

-- DropEnum
DROP TYPE "ExpenseCategoryScope";
