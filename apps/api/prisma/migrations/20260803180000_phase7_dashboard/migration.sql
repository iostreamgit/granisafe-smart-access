-- CreateTable
CREATE TABLE "camera_status" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "access_point_code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "last_heartbeat_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "camera_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "camera_status_company_id_last_heartbeat_at_idx" ON "camera_status"("company_id", "last_heartbeat_at");

-- CreateIndex
CREATE UNIQUE INDEX "camera_status_company_id_access_point_code_key" ON "camera_status"("company_id", "access_point_code");

-- AddForeignKey
ALTER TABLE "camera_status" ADD CONSTRAINT "camera_status_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
