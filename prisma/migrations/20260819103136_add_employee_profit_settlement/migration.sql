-- DropForeignKey
ALTER TABLE "pages" DROP CONSTRAINT "pages_paid_by_admin_id_fkey";

-- CreateTable
CREATE TABLE "employee_profit_settlements" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "note" TEXT,
    "created_by_admin_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "employee_profit_settlements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_paid_by_admin_id_fkey" FOREIGN KEY ("paid_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_profit_settlements" ADD CONSTRAINT "employee_profit_settlements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_profit_settlements" ADD CONSTRAINT "employee_profit_settlements_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
