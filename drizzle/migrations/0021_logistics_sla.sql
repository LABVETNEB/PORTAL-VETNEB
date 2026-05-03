CREATE TABLE IF NOT EXISTS "sla_policies" (
  "id" serial PRIMARY KEY NOT NULL,
  "clinic_id" integer,
  "name" varchar(255) NOT NULL,
  "scope" varchar(32) DEFAULT 'global' NOT NULL,
  "target_type" varchar(64) NOT NULL,
  "due_minutes" integer NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "sla_policies_due_minutes_positive_chk" CHECK ("due_minutes" > 0)
);

CREATE TABLE IF NOT EXISTS "sla_instances" (
  "id" serial PRIMARY KEY NOT NULL,
  "clinic_id" integer NOT NULL,
  "policy_id" integer,
  "target_type" varchar(64) NOT NULL,
  "target_id" integer NOT NULL,
  "status" varchar(32) DEFAULT 'active' NOT NULL,
  "started_at" timestamp NOT NULL,
  "due_at" timestamp NOT NULL,
  "paused_at" timestamp,
  "breached_at" timestamp,
  "resolved_at" timestamp,
  "canceled_at" timestamp,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "sla_instances_due_after_started_chk" CHECK ("due_at" > "started_at")
);

CREATE INDEX IF NOT EXISTS "sla_policies_clinic_id_idx" ON "sla_policies" ("clinic_id");
CREATE INDEX IF NOT EXISTS "sla_policies_scope_target_type_idx" ON "sla_policies" ("scope", "target_type");
CREATE INDEX IF NOT EXISTS "sla_policies_clinic_target_type_idx" ON "sla_policies" ("clinic_id", "target_type");
CREATE INDEX IF NOT EXISTS "sla_policies_active_idx" ON "sla_policies" ("is_active");

CREATE INDEX IF NOT EXISTS "sla_instances_clinic_id_idx" ON "sla_instances" ("clinic_id");
CREATE INDEX IF NOT EXISTS "sla_instances_clinic_status_idx" ON "sla_instances" ("clinic_id", "status");
CREATE INDEX IF NOT EXISTS "sla_instances_clinic_due_at_idx" ON "sla_instances" ("clinic_id", "due_at");
CREATE INDEX IF NOT EXISTS "sla_instances_clinic_target_idx" ON "sla_instances" ("clinic_id", "target_type", "target_id");
CREATE INDEX IF NOT EXISTS "sla_instances_policy_id_idx" ON "sla_instances" ("policy_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sla_policies_clinic_id_clinics_id_fk'
  ) THEN
    ALTER TABLE "sla_policies"
      ADD CONSTRAINT "sla_policies_clinic_id_clinics_id_fk"
      FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sla_instances_clinic_id_clinics_id_fk'
  ) THEN
    ALTER TABLE "sla_instances"
      ADD CONSTRAINT "sla_instances_clinic_id_clinics_id_fk"
      FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sla_instances_policy_id_sla_policies_id_fk'
  ) THEN
    ALTER TABLE "sla_instances"
      ADD CONSTRAINT "sla_instances_policy_id_sla_policies_id_fk"
      FOREIGN KEY ("policy_id") REFERENCES "sla_policies"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
