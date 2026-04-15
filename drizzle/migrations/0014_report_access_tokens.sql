CREATE TABLE IF NOT EXISTS "report_access_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "clinic_id" integer NOT NULL,
  "report_id" integer NOT NULL,
  "created_by_clinic_user_id" integer,
  "created_by_admin_user_id" integer,
  "revoked_by_clinic_user_id" integer,
  "revoked_by_admin_user_id" integer,
  "token_hash" varchar(64) NOT NULL,
  "token_last4" varchar(4) NOT NULL,
  "access_count" integer NOT NULL DEFAULT 0,
  "last_access_at" timestamp,
  "expires_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "report_access_tokens_token_hash_unique" UNIQUE("token_hash")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_access_tokens_clinic_id_clinics_id_fk'
  ) THEN
    ALTER TABLE "report_access_tokens"
    ADD CONSTRAINT "report_access_tokens_clinic_id_clinics_id_fk"
    FOREIGN KEY ("clinic_id")
    REFERENCES "clinics"("id")
    ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_access_tokens_report_id_reports_id_fk'
  ) THEN
    ALTER TABLE "report_access_tokens"
    ADD CONSTRAINT "report_access_tokens_report_id_reports_id_fk"
    FOREIGN KEY ("report_id")
    REFERENCES "reports"("id")
    ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_access_tokens_created_by_clinic_user_id_clinic_users_id_fk'
  ) THEN
    ALTER TABLE "report_access_tokens"
    ADD CONSTRAINT "report_access_tokens_created_by_clinic_user_id_clinic_users_id_fk"
    FOREIGN KEY ("created_by_clinic_user_id")
    REFERENCES "clinic_users"("id")
    ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_access_tokens_created_by_admin_user_id_admin_users_id_fk'
  ) THEN
    ALTER TABLE "report_access_tokens"
    ADD CONSTRAINT "report_access_tokens_created_by_admin_user_id_admin_users_id_fk"
    FOREIGN KEY ("created_by_admin_user_id")
    REFERENCES "admin_users"("id")
    ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_access_tokens_revoked_by_clinic_user_id_clinic_users_id_fk'
  ) THEN
    ALTER TABLE "report_access_tokens"
    ADD CONSTRAINT "report_access_tokens_revoked_by_clinic_user_id_clinic_users_id_fk"
    FOREIGN KEY ("revoked_by_clinic_user_id")
    REFERENCES "clinic_users"("id")
    ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_access_tokens_revoked_by_admin_user_id_admin_users_id_fk'
  ) THEN
    ALTER TABLE "report_access_tokens"
    ADD CONSTRAINT "report_access_tokens_revoked_by_admin_user_id_admin_users_id_fk"
    FOREIGN KEY ("revoked_by_admin_user_id")
    REFERENCES "admin_users"("id")
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "report_access_tokens_token_hash_idx"
ON "report_access_tokens" ("token_hash");

CREATE INDEX IF NOT EXISTS "report_access_tokens_clinic_id_idx"
ON "report_access_tokens" ("clinic_id");

CREATE INDEX IF NOT EXISTS "report_access_tokens_report_id_idx"
ON "report_access_tokens" ("report_id");

CREATE INDEX IF NOT EXISTS "report_access_tokens_clinic_report_created_at_idx"
ON "report_access_tokens" ("clinic_id", "report_id", "created_at");

CREATE INDEX IF NOT EXISTS "report_access_tokens_expires_at_idx"
ON "report_access_tokens" ("expires_at");

CREATE INDEX IF NOT EXISTS "report_access_tokens_revoked_at_idx"
ON "report_access_tokens" ("revoked_at");
