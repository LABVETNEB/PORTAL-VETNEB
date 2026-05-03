CREATE TABLE IF NOT EXISTS "field_visits" (
  "id" serial PRIMARY KEY NOT NULL,
  "clinic_id" integer NOT NULL,
  "source_type" varchar(40) DEFAULT 'manual' NOT NULL,
  "source_id" integer,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "criticality" varchar(32),
  "service_duration_min" integer DEFAULT 0 NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "visit_locations" (
  "id" serial PRIMARY KEY NOT NULL,
  "field_visit_id" integer NOT NULL,
  "address_raw" text NOT NULL,
  "address_normalized" text,
  "locality" varchar(255),
  "country" varchar(255),
  "lat" real,
  "lng" real,
  "geo_quality" varchar(32) DEFAULT 'missing' NOT NULL,
  "geocode_source" varchar(100),
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "field_visits_clinic_id_idx" ON "field_visits" ("clinic_id");
CREATE INDEX IF NOT EXISTS "field_visits_clinic_status_idx" ON "field_visits" ("clinic_id", "status");
CREATE INDEX IF NOT EXISTS "field_visits_clinic_priority_created_at_idx" ON "field_visits" ("clinic_id", "priority", "created_at");
CREATE INDEX IF NOT EXISTS "field_visits_clinic_source_idx" ON "field_visits" ("clinic_id", "source_type", "source_id");
CREATE INDEX IF NOT EXISTS "field_visits_created_at_idx" ON "field_visits" ("created_at");

CREATE INDEX IF NOT EXISTS "visit_locations_field_visit_id_idx" ON "visit_locations" ("field_visit_id");
CREATE INDEX IF NOT EXISTS "visit_locations_geo_quality_idx" ON "visit_locations" ("geo_quality");
CREATE INDEX IF NOT EXISTS "visit_locations_locality_country_idx" ON "visit_locations" ("locality", "country");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'field_visits_clinic_id_clinics_id_fk'
  ) THEN
    ALTER TABLE "field_visits"
      ADD CONSTRAINT "field_visits_clinic_id_clinics_id_fk"
      FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'visit_locations_field_visit_id_field_visits_id_fk'
  ) THEN
    ALTER TABLE "visit_locations"
      ADD CONSTRAINT "visit_locations_field_visit_id_field_visits_id_fk"
      FOREIGN KEY ("field_visit_id") REFERENCES "field_visits"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
