CREATE TABLE IF NOT EXISTS "login_failed_attempts" (
  "id" serial PRIMARY KEY NOT NULL,
  "surface" varchar(32) NOT NULL,
  "username" varchar(100),
  "reason" varchar(64) NOT NULL,
  "ip_address" varchar(64),
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "login_failed_attempts_surface_created_at_idx"
  ON "login_failed_attempts" ("surface", "created_at");
CREATE INDEX IF NOT EXISTS "login_failed_attempts_ip_created_at_idx"
  ON "login_failed_attempts" ("ip_address", "created_at");
CREATE INDEX IF NOT EXISTS "login_failed_attempts_reason_created_at_idx"
  ON "login_failed_attempts" ("reason", "created_at");
