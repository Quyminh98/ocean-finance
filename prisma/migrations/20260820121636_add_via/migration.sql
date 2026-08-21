-- CreateTable
CREATE TABLE "vias" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "facebook_url" TEXT NOT NULL,
    "holder_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vias_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "vias" ADD CONSTRAINT "vias_holder_user_id_fkey" FOREIGN KEY ("holder_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
