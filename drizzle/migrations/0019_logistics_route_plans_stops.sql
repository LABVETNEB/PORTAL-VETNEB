CREATE TABLE IF NOT EXISTS "route_plans" (
  "id" serial PRIMARY KEY NOT NULL,
  "clinic_id" integer NOT NULL,
  "service_date" timestamp NOT NULL,
  "status" varchar(32) DEFAULT 'draft' NOT NULL,
  "planning_mode" varchar(32) DEFAULT 'manual' NOT NULL,
  "objective" varchar(32) DEFAULT 'distance' NOT NULL,
  "total_planned_km" real DEFAULT 0 NOT NULL,
  "total_planned_min" integer DEFAULT 0 NOT NULL,
  "created_by_type" varchar(32) DEFAULT 'system' NOT NULL,
  "created_by_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "route_stops" (
  "id" serial PRIMARY KEY NOT NULL,
  "route_plan_id" integer NOT NULL,
  "field_visit_id" integer NOT NULL,
  "sequence" integer NOT NULL,
  "eta_start" timestamp,
  "eta_end" timestamp,
  "planned_km_from_prev" real DEFAULT 0 NOT NULL,
  "planned_min_from_prev" integer DEFAULT 0 NOT NULL,
  "actual_arrival" timestamp,
  "actual_departure" timestamp,
  "actual_km_from_prev" real,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "route_plans_clinic_id_idx" ON "route_plans" ("clinic_id");
CREATE INDEX IF NOT EXISTS "route_plans_clinic_service_date_idx" ON "route_plans" ("clinic_id", "service_date");
CREATE INDEX IF NOT EXISTS "route_plans_clinic_status_idx" ON "route_plans" ("clinic_id", "status");
CREATE INDEX IF NOT EXISTS "route_plans_clinic_planning_mode_idx" ON "route_plans" ("clinic_id", "planning_mode");

CREATE INDEX IF NOT EXISTS "route_stops_route_plan_id_idx" ON "route_stops" ("route_plan_id");
CREATE UNIQUE INDEX IF NOT EXISTS "route_stops_route_plan_sequence_idx" ON "route_stops" ("route_plan_id", "sequence");
CREATE INDEX IF NOT EXISTS "route_stops_field_visit_id_idx" ON "route_stops" ("field_visit_id");
CREATE INDEX IF NOT EXISTS "route_stops_route_plan_status_idx" ON "route_stops" ("route_plan_id", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'route_plans_clinic_id_clinics_id_fk'
  ) THEN
    ALTER TABLE "route_plans"
      ADD CONSTRAINT "route_plans_clinic_id_clinics_id_fk"
      FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'route_stops_route_plan_id_route_plans_id_fk'
  ) THEN
    ALTER TABLE "route_stops"
      ADD CONSTRAINT "route_stops_route_plan_id_route_plans_id_fk"
      FOREIGN KEY ("route_plan_id") REFERENCES "route_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'route_stops_field_visit_id_field_visits_id_fk'
  ) THEN
    ALTER TABLE "route_stops"
      ADD CONSTRAINT "route_stops_field_visit_id_field_visits_id_fk"
      FOREIGN KEY ("field_visit_id") REFERENCES "field_visits"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
