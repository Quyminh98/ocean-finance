-- CreateTable
CREATE TABLE "page_via_assignments" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "via_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_via_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "page_via_assignments_unique" ON "page_via_assignments"("page_id", "via_id");

-- AddForeignKey
ALTER TABLE "page_via_assignments" ADD CONSTRAINT "page_via_assignments_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_via_assignments" ADD CONSTRAINT "page_via_assignments_via_id_fkey" FOREIGN KEY ("via_id") REFERENCES "vias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
