CREATE TABLE IF NOT EXISTS "time_windows" (
  "id" serial PRIMARY KEY NOT NULL,
  "field_visit_id" integer NOT NULL,
  "window_start" timestamp NOT NULL,
  "window_end" timestamp NOT NULL,
  "timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
  "is_hard" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "time_windows_window_range_chk" CHECK ("window_start" < "window_end")
);

CREATE INDEX IF NOT EXISTS "time_windows_field_visit_id_idx" ON "time_windows" ("field_visit_id");
CREATE INDEX IF NOT EXISTS "time_windows_window_start_idx" ON "time_windows" ("window_start");
CREATE INDEX IF NOT EXISTS "time_windows_window_end_idx" ON "time_windows" ("window_end");
CREATE INDEX IF NOT EXISTS "time_windows_field_visit_window_start_idx" ON "time_windows" ("field_visit_id", "window_start");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'time_windows_field_visit_id_field_visits_id_fk'
  ) THEN
    ALTER TABLE "time_windows"
      ADD CONSTRAINT "time_windows_field_visit_id_field_visits_id_fk"
      FOREIGN KEY ("field_visit_id") REFERENCES "field_visits"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
