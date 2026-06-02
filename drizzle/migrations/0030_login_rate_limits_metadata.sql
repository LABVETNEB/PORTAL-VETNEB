ALTER TABLE "login_rate_limits"
  ADD COLUMN IF NOT EXISTS "surface" varchar(32),
  ADD COLUMN IF NOT EXISTS "identifier_hash" text,
  ADD COLUMN IF NOT EXISTS "ip_hash" text,
  ADD COLUMN IF NOT EXISTS "key_version" varchar(16);

CREATE INDEX IF NOT EXISTS "login_rate_limits_surface_identifier_idx"
  ON "login_rate_limits" ("surface", "identifier_hash");

CREATE INDEX IF NOT EXISTS "login_rate_limits_surface_identifier_ip_idx"
  ON "login_rate_limits" ("surface", "identifier_hash", "ip_hash");
