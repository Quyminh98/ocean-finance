-- CreateTable
CREATE TABLE "employee_receipts" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "receipt_month" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "note" TEXT,
    "created_by_admin_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "employee_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- At most one active (deleted_at IS NULL) record per employee+month — same
-- upsert-overwrite pattern as revenues/ad_expenses.
CREATE UNIQUE INDEX "employee_receipts_employee_month_unique" ON "employee_receipts"("employee_id", "receipt_month") WHERE "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "employee_receipts" ADD CONSTRAINT "employee_receipts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_receipts" ADD CONSTRAINT "employee_receipts_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
