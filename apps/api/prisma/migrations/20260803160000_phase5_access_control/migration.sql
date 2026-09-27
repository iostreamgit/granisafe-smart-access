-- CreateTable
CREATE TABLE "ppe_policies" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ppe_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ppe_policy_items" (
    "id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "ppe_class" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "min_confidence" DECIMAL(4,3) NOT NULL DEFAULT 0.70,

    CONSTRAINT "ppe_policy_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_attempts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "policy_id" UUID,
    "policy_version" INTEGER,
    "access_point_code" TEXT NOT NULL,
    "evidence_object_key" TEXT,
    "correlation_id" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "access_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_decisions" (
    "id" UUID NOT NULL,
    "access_attempt_id" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "reasons" JSONB NOT NULL,
    "gate_simulated" BOOLEAN NOT NULL DEFAULT false,
    "gate_open_ms" INTEGER NOT NULL DEFAULT 0,
    "decided_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_detection_items" (
    "id" UUID NOT NULL,
    "access_attempt_id" UUID NOT NULL,
    "ppe_class" TEXT NOT NULL,
    "detected" BOOLEAN NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "bbox" JSONB,

    CONSTRAINT "access_detection_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ppe_policies_company_id_is_default_idx" ON "ppe_policies"("company_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "ppe_policy_items_policy_id_ppe_class_key" ON "ppe_policy_items"("policy_id", "ppe_class");

-- CreateIndex
CREATE INDEX "access_attempts_employee_id_started_at_idx" ON "access_attempts"("employee_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "access_attempts_company_id_status_started_at_idx" ON "access_attempts"("company_id", "status", "started_at" DESC);

-- CreateIndex
CREATE INDEX "access_attempts_started_at_idx" ON "access_attempts"("started_at");

-- CreateIndex
CREATE UNIQUE INDEX "access_attempts_company_id_idempotency_key_key" ON "access_attempts"("company_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "access_decisions_access_attempt_id_key" ON "access_decisions"("access_attempt_id");

-- CreateIndex
CREATE INDEX "access_detection_items_access_attempt_id_idx" ON "access_detection_items"("access_attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_access_attempt_id_key" ON "attendance_records"("access_attempt_id");

-- AddForeignKey
ALTER TABLE "ppe_policies" ADD CONSTRAINT "ppe_policies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppe_policy_items" ADD CONSTRAINT "ppe_policy_items_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "ppe_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_attempts" ADD CONSTRAINT "access_attempts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_attempts" ADD CONSTRAINT "access_attempts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_attempts" ADD CONSTRAINT "access_attempts_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "ppe_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_decisions" ADD CONSTRAINT "access_decisions_access_attempt_id_fkey" FOREIGN KEY ("access_attempt_id") REFERENCES "access_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_detection_items" ADD CONSTRAINT "access_detection_items_access_attempt_id_fkey" FOREIGN KEY ("access_attempt_id") REFERENCES "access_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_access_attempt_id_fkey" FOREIGN KEY ("access_attempt_id") REFERENCES "access_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
