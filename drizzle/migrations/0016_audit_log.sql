CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" serial PRIMARY KEY NOT NULL
);

ALTER TABLE "audit_log"
  ADD COLUMN IF NOT EXISTS "event" varchar(120),
  ADD COLUMN IF NOT EXISTS "actor_type" varchar(40) DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS "actor_admin_user_id" integer,
  ADD COLUMN IF NOT EXISTS "actor_clinic_user_id" integer,
  ADD COLUMN IF NOT EXISTS "actor_report_access_token_id" integer,
  ADD COLUMN IF NOT EXISTS "clinic_id" integer,
  ADD COLUMN IF NOT EXISTS "report_id" integer,
  ADD COLUMN IF NOT EXISTS "target_admin_user_id" integer,
  ADD COLUMN IF NOT EXISTS "target_clinic_user_id" integer,
  ADD COLUMN IF NOT EXISTS "target_report_access_token_id" integer,
  ADD COLUMN IF NOT EXISTS "request_id" varchar(64),
  ADD COLUMN IF NOT EXISTS "request_method" varchar(16),
  ADD COLUMN IF NOT EXISTS "request_path" text,
  ADD COLUMN IF NOT EXISTS "ip_address" varchar(64),
  ADD COLUMN IF NOT EXISTS "user_agent" text,
  ADD COLUMN IF NOT EXISTS "metadata" jsonb,
  ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

UPDATE "audit_log"
SET
  "event" = COALESCE("event", 'legacy.audit_log.row'),
  "actor_type" = COALESCE("actor_type", 'system'),
  "created_at" = COALESCE("created_at", now());

ALTER TABLE "audit_log"`r`n  ALTER COLUMN "event" TYPE varchar(120),`r`n  ALTER COLUMN "actor_type" TYPE varchar(40),`r`n  ALTER COLUMN "event" SET NOT NULL,
  ALTER COLUMN "actor_type" SET NOT NULL,
  ALTER COLUMN "created_at" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "audit_log_event_idx" ON "audit_log" ("event");
CREATE INDEX IF NOT EXISTS "audit_log_created_at_idx" ON "audit_log" ("created_at");
CREATE INDEX IF NOT EXISTS "audit_log_actor_type_idx" ON "audit_log" ("actor_type");
CREATE INDEX IF NOT EXISTS "audit_log_actor_admin_user_id_idx" ON "audit_log" ("actor_admin_user_id");
CREATE INDEX IF NOT EXISTS "audit_log_actor_clinic_user_id_idx" ON "audit_log" ("actor_clinic_user_id");
CREATE INDEX IF NOT EXISTS "audit_log_actor_report_access_token_id_idx" ON "audit_log" ("actor_report_access_token_id");
CREATE INDEX IF NOT EXISTS "audit_log_clinic_id_idx" ON "audit_log" ("clinic_id");
CREATE INDEX IF NOT EXISTS "audit_log_report_id_idx" ON "audit_log" ("report_id");
CREATE INDEX IF NOT EXISTS "audit_log_target_report_access_token_id_idx" ON "audit_log" ("target_report_access_token_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_log_actor_admin_user_id_admin_users_id_fk'
  ) THEN
    ALTER TABLE "audit_log"
      ADD CONSTRAINT "audit_log_actor_admin_user_id_admin_users_id_fk"
      FOREIGN KEY ("actor_admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_log_actor_clinic_user_id_clinic_users_id_fk'
  ) THEN
    ALTER TABLE "audit_log"
      ADD CONSTRAINT "audit_log_actor_clinic_user_id_clinic_users_id_fk"
      FOREIGN KEY ("actor_clinic_user_id") REFERENCES "clinic_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_log_actor_report_access_token_id_report_access_tokens_id_fk'
  ) THEN
    ALTER TABLE "audit_log"
      ADD CONSTRAINT "audit_log_actor_report_access_token_id_report_access_tokens_id_fk"
      FOREIGN KEY ("actor_report_access_token_id") REFERENCES "report_access_tokens"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_log_clinic_id_clinics_id_fk'
  ) THEN
    ALTER TABLE "audit_log"
      ADD CONSTRAINT "audit_log_clinic_id_clinics_id_fk"
      FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_log_report_id_reports_id_fk'
  ) THEN
    ALTER TABLE "audit_log"
      ADD CONSTRAINT "audit_log_report_id_reports_id_fk"
      FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_log_target_admin_user_id_admin_users_id_fk'
  ) THEN
    ALTER TABLE "audit_log"
      ADD CONSTRAINT "audit_log_target_admin_user_id_admin_users_id_fk"
      FOREIGN KEY ("target_admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_log_target_clinic_user_id_clinic_users_id_fk'
  ) THEN
    ALTER TABLE "audit_log"
      ADD CONSTRAINT "audit_log_target_clinic_user_id_clinic_users_id_fk"
      FOREIGN KEY ("target_clinic_user_id") REFERENCES "clinic_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_log_target_report_access_token_id_report_access_tokens_id_fk'
  ) THEN
    ALTER TABLE "audit_log"
      ADD CONSTRAINT "audit_log_target_report_access_token_id_report_access_tokens_id_fk"
      FOREIGN KEY ("target_report_access_token_id") REFERENCES "report_access_tokens"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;