-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "department_id" UUID,
    "user_id" UUID,
    "employee_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "shift_start" TEXT,
    "late_grace_minutes" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_identifiers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "value_hash" TEXT NOT NULL,
    "display_hint" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rotated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "departments_company_id_deleted_at_idx" ON "departments"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "departments_company_id_code_key" ON "departments"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_company_id_status_idx" ON "employees"("company_id", "status");

-- CreateIndex
CREATE INDEX "employees_department_id_idx" ON "employees"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_company_id_employee_code_key" ON "employees"("company_id", "employee_code");

-- CreateIndex
CREATE INDEX "employee_identifiers_employee_id_type_is_active_idx" ON "employee_identifiers"("employee_id", "type", "is_active");

-- CreateIndex
CREATE INDEX "employee_identifiers_type_value_hash_idx" ON "employee_identifiers"("type", "value_hash");

-- CreateIndex
CREATE UNIQUE INDEX "employee_identifiers_type_value_hash_key" ON "employee_identifiers"("type", "value_hash");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_identifiers" ADD CONSTRAINT "employee_identifiers_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
