-- 0029_admin_users_email_identifier.sql
-- Habilita login admin por email real sin romper username legacy.

ALTER TABLE "admin_users"
  ADD COLUMN IF NOT EXISTS "email" varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_email_lower_uidx"
  ON "admin_users" (lower("email"))
  WHERE "email" IS NOT NULL;
