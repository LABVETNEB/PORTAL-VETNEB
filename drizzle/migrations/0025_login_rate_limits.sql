CREATE TABLE IF NOT EXISTS "login_rate_limits" (
  "key_hash" text PRIMARY KEY NOT NULL,
  "count" integer NOT NULL,
  "reset_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "login_rate_limits_reset_at_idx"
  ON "login_rate_limits" ("reset_at");
