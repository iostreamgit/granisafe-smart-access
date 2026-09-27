-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "access_attempt_id" UUID,
    "punch_type" TEXT NOT NULL,
    "punched_at" TIMESTAMPTZ(3) NOT NULL,
    "is_late" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_records_employee_id_punched_at_idx" ON "attendance_records"("employee_id", "punched_at");

-- CreateIndex
CREATE INDEX "attendance_records_company_id_punched_at_idx" ON "attendance_records"("company_id", "punched_at");

-- CreateIndex
CREATE INDEX "attendance_records_punched_at_idx" ON "attendance_records"("punched_at");

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
