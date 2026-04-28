ALTER TABLE "clinic_users"
ADD COLUMN IF NOT EXISTS "role" varchar(32) NOT NULL DEFAULT 'clinic_staff';

CREATE INDEX IF NOT EXISTS "clinic_users_clinic_id_idx"
ON "clinic_users" ("clinic_id");

CREATE INDEX IF NOT EXISTS "clinic_users_clinic_id_role_idx"
ON "clinic_users" ("clinic_id", "role");
