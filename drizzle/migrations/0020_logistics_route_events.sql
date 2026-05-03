CREATE TABLE IF NOT EXISTS "route_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "clinic_id" integer NOT NULL,
  "route_plan_id" integer,
  "route_stop_id" integer,
  "event_type" varchar(64) NOT NULL,
  "event_time" timestamp NOT NULL,
  "payload" jsonb,
  "lat" real,
  "lng" real,
  "source" varchar(32) DEFAULT 'system' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "route_events_clinic_id_idx" ON "route_events" ("clinic_id");
CREATE INDEX IF NOT EXISTS "route_events_clinic_event_time_idx" ON "route_events" ("clinic_id", "event_time");
CREATE INDEX IF NOT EXISTS "route_events_clinic_route_plan_event_time_idx" ON "route_events" ("clinic_id", "route_plan_id", "event_time");
CREATE INDEX IF NOT EXISTS "route_events_route_stop_event_time_idx" ON "route_events" ("route_stop_id", "event_time");
CREATE INDEX IF NOT EXISTS "route_events_event_type_idx" ON "route_events" ("event_type");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'route_events_clinic_id_clinics_id_fk'
  ) THEN
    ALTER TABLE "route_events"
      ADD CONSTRAINT "route_events_clinic_id_clinics_id_fk"
      FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'route_events_route_plan_id_route_plans_id_fk'
  ) THEN
    ALTER TABLE "route_events"
      ADD CONSTRAINT "route_events_route_plan_id_route_plans_id_fk"
      FOREIGN KEY ("route_plan_id") REFERENCES "route_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'route_events_route_stop_id_route_stops_id_fk'
  ) THEN
    ALTER TABLE "route_events"
      ADD CONSTRAINT "route_events_route_stop_id_route_stops_id_fk"
      FOREIGN KEY ("route_stop_id") REFERENCES "route_stops"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
