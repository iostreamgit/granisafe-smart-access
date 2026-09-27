-- Phase 8: notifications, report jobs, system settings

CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "report_jobs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "params" JSONB NOT NULL,
    "storage_key" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "report_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "system_settings" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at" DESC);
CREATE INDEX "notifications_company_id_created_at_idx" ON "notifications"("company_id", "created_at" DESC);

CREATE INDEX "report_jobs_company_id_created_at_idx" ON "report_jobs"("company_id", "created_at" DESC);
CREATE INDEX "report_jobs_requested_by_user_id_created_at_idx" ON "report_jobs"("requested_by_user_id", "created_at" DESC);

CREATE UNIQUE INDEX "system_settings_company_id_key_key" ON "system_settings"("company_id", "key");
CREATE INDEX "system_settings_company_id_idx" ON "system_settings"("company_id");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
