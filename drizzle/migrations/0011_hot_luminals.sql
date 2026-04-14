ALTER TABLE "clinic_users"
ADD COLUMN IF NOT EXISTS "role" varchar(32) NOT NULL DEFAULT 'clinic_staff';

UPDATE "clinic_users" cu
SET "role" = ranked.assigned_role
FROM (
  SELECT
    id,
    CASE
      WHEN row_number() OVER (PARTITION BY clinic_id ORDER BY created_at ASC, id ASC) = 1
        THEN 'clinic_owner'
      ELSE 'clinic_staff'
    END AS assigned_role
  FROM "clinic_users"
) AS ranked
WHERE cu.id = ranked.id
  AND (cu.role IS NULL OR cu.role NOT IN ('clinic_owner', 'clinic_staff'));

UPDATE "clinic_users"
SET "role" = 'clinic_staff'
WHERE "role" IS NULL;

ALTER TABLE "clinic_users"
ALTER COLUMN "role" SET DEFAULT 'clinic_staff';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clinic_users_role_check'
  ) THEN
    ALTER TABLE "clinic_users"
    ADD CONSTRAINT "clinic_users_role_check"
    CHECK ("role" IN ('clinic_owner', 'clinic_staff'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "clinic_users_clinic_id_idx"
ON "clinic_users" ("clinic_id");

CREATE INDEX IF NOT EXISTS "clinic_users_clinic_id_role_idx"
ON "clinic_users" ("clinic_id", "role");
