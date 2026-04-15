ALTER TABLE "reports"
ADD COLUMN IF NOT EXISTS "current_status" varchar(32) NOT NULL DEFAULT 'uploaded';

ALTER TABLE "reports"
ADD COLUMN IF NOT EXISTS "status_changed_at" timestamp NOT NULL DEFAULT now();

ALTER TABLE "reports"
ADD COLUMN IF NOT EXISTS "status_changed_by_clinic_user_id" integer;

ALTER TABLE "reports"
ADD COLUMN IF NOT EXISTS "status_changed_by_admin_user_id" integer;

UPDATE "reports"
SET "current_status" = 'uploaded'
WHERE "current_status" IS NULL
   OR "current_status" NOT IN ('uploaded', 'processing', 'ready', 'delivered');

UPDATE "reports"
SET "status_changed_at" = COALESCE("status_changed_at", "updated_at", "created_at", now())
WHERE "status_changed_at" IS NULL;

ALTER TABLE "reports"
ALTER COLUMN "current_status" SET DEFAULT 'uploaded';

ALTER TABLE "reports"
ALTER COLUMN "status_changed_at" SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reports_current_status_check'
  ) THEN
    ALTER TABLE "reports"
    ADD CONSTRAINT "reports_current_status_check"
    CHECK ("current_status" IN ('uploaded', 'processing', 'ready', 'delivered'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reports_status_changed_by_clinic_user_id_fk'
  ) THEN
    ALTER TABLE "reports"
    ADD CONSTRAINT "reports_status_changed_by_clinic_user_id_fk"
    FOREIGN KEY ("status_changed_by_clinic_user_id")
    REFERENCES "clinic_users"("id")
    ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reports_status_changed_by_admin_user_id_fk'
  ) THEN
    ALTER TABLE "reports"
    ADD CONSTRAINT "reports_status_changed_by_admin_user_id_fk"
    FOREIGN KEY ("status_changed_by_admin_user_id")
    REFERENCES "admin_users"("id")
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "report_status_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "report_id" integer,
  "from_status" varchar(32),
  "to_status" varchar(32),
  "changed_by_clinic_user_id" integer,
  "changed_by_admin_user_id" integer,
  "note" text,
  "created_at" timestamp DEFAULT now()
);

ALTER TABLE "report_status_history"
ADD COLUMN IF NOT EXISTS "report_id" integer;

ALTER TABLE "report_status_history"
ADD COLUMN IF NOT EXISTS "from_status" varchar(32);

ALTER TABLE "report_status_history"
ADD COLUMN IF NOT EXISTS "to_status" varchar(32);

ALTER TABLE "report_status_history"
ADD COLUMN IF NOT EXISTS "changed_by_clinic_user_id" integer;

ALTER TABLE "report_status_history"
ADD COLUMN IF NOT EXISTS "changed_by_admin_user_id" integer;

ALTER TABLE "report_status_history"
ADD COLUMN IF NOT EXISTS "note" text;

ALTER TABLE "report_status_history"
ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

DO $$
DECLARE
  has_legacy_status boolean;
  has_legacy_changed_at boolean;
  has_legacy_changed_by_type boolean;
  legacy_actor_type text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_status_history'
      AND column_name = 'status'
  ) INTO has_legacy_status;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_status_history'
      AND column_name = 'changed_by_type'
  ) INTO has_legacy_changed_by_type;

  IF has_legacy_status THEN
    EXECUTE '
      UPDATE "report_status_history"
      SET "to_status" = COALESCE("to_status", "status")
      WHERE "to_status" IS NULL
    ';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_status_history'
      AND column_name = 'changed_at'
  ) INTO has_legacy_changed_at;

  IF has_legacy_changed_at THEN
    EXECUTE '
      UPDATE "report_status_history"
      SET "created_at" = COALESCE("created_at", "changed_at", now())
      WHERE "created_at" IS NULL
    ';
  ELSE
    UPDATE "report_status_history"
    SET "created_at" = now()
    WHERE "created_at" IS NULL;
  END IF;

  IF has_legacy_changed_by_type THEN
    EXECUTE '
      SELECT COALESCE(
        (
          SELECT "changed_by_type"
          FROM "report_status_history"
          WHERE "changed_by_type" IS NOT NULL
          LIMIT 1
        ),
        ''system''
      )
    ' INTO legacy_actor_type;

    EXECUTE format(
      'UPDATE "report_status_history" SET "changed_by_type" = %L WHERE "changed_by_type" IS NULL',
      legacy_actor_type
    );
  END IF;
END $$;

UPDATE "report_status_history"
SET "to_status" = 'uploaded'
WHERE "to_status" IS NULL;

ALTER TABLE "report_status_history"
ALTER COLUMN "report_id" SET NOT NULL;

ALTER TABLE "report_status_history"
ALTER COLUMN "to_status" SET NOT NULL;

ALTER TABLE "report_status_history"
ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE "report_status_history"
ALTER COLUMN "created_at" SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_status_history_report_id_fk'
  ) THEN
    ALTER TABLE "report_status_history"
    ADD CONSTRAINT "report_status_history_report_id_fk"
    FOREIGN KEY ("report_id")
    REFERENCES "reports"("id")
    ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_status_history_changed_by_clinic_user_id_fk'
  ) THEN
    ALTER TABLE "report_status_history"
    ADD CONSTRAINT "report_status_history_changed_by_clinic_user_id_fk"
    FOREIGN KEY ("changed_by_clinic_user_id")
    REFERENCES "clinic_users"("id")
    ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_status_history_changed_by_admin_user_id_fk'
  ) THEN
    ALTER TABLE "report_status_history"
    ADD CONSTRAINT "report_status_history_changed_by_admin_user_id_fk"
    FOREIGN KEY ("changed_by_admin_user_id")
    REFERENCES "admin_users"("id")
    ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_status_history_from_status_check'
  ) THEN
    ALTER TABLE "report_status_history"
    ADD CONSTRAINT "report_status_history_from_status_check"
    CHECK (
      "from_status" IS NULL
      OR "from_status" IN ('uploaded', 'processing', 'ready', 'delivered')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_status_history_to_status_check'
  ) THEN
    ALTER TABLE "report_status_history"
    ADD CONSTRAINT "report_status_history_to_status_check"
    CHECK ("to_status" IN ('uploaded', 'processing', 'ready', 'delivered'));
  END IF;
END $$;

DO $$
DECLARE
  has_legacy_status boolean;
  has_legacy_changed_by_type boolean;
  legacy_actor_type text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_status_history'
      AND column_name = 'status'
  ) INTO has_legacy_status;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_status_history'
      AND column_name = 'changed_by_type'
  ) INTO has_legacy_changed_by_type;

  IF has_legacy_changed_by_type THEN
    EXECUTE '
      SELECT COALESCE(
        (
          SELECT "changed_by_type"
          FROM "report_status_history"
          WHERE "changed_by_type" IS NOT NULL
          LIMIT 1
        ),
        ''system''
      )
    ' INTO legacy_actor_type;
  ELSE
    legacy_actor_type := 'system';
  END IF;

  IF has_legacy_status THEN
    EXECUTE format($insert$
      INSERT INTO "report_status_history" (
        "report_id",
        "status",
        "previous_status",
        "changed_by",
        "changed_by_type",
        "notes",
        "created_at",
        "from_status",
        "to_status",
        "changed_by_clinic_user_id",
        "changed_by_admin_user_id",
        "note"
      )
      SELECT
        r."id",
        r."current_status",
        NULL,
        COALESCE(r."status_changed_by_clinic_user_id", r."status_changed_by_admin_user_id"),
        %L,
        'Historial inicial reconciliado',
        COALESCE(r."created_at", r."status_changed_at", now()),
        NULL,
        r."current_status",
        r."status_changed_by_clinic_user_id",
        r."status_changed_by_admin_user_id",
        'Historial inicial reconciliado'
      FROM "reports" r
      WHERE NOT EXISTS (
        SELECT 1
        FROM "report_status_history" h
        WHERE h."report_id" = r."id"
      )
    $insert$, legacy_actor_type);
  ELSE
    INSERT INTO "report_status_history" (
      "report_id",
      "from_status",
      "to_status",
      "changed_by_clinic_user_id",
      "changed_by_admin_user_id",
      "note",
      "created_at"
    )
    SELECT
      r."id",
      NULL,
      r."current_status",
      r."status_changed_by_clinic_user_id",
      r."status_changed_by_admin_user_id",
      'Historial inicial reconciliado',
      COALESCE(r."created_at", r."status_changed_at", now())
    FROM "reports" r
    WHERE NOT EXISTS (
      SELECT 1
      FROM "report_status_history" h
      WHERE h."report_id" = r."id"
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "reports_clinic_current_status_idx"
ON "reports" ("clinic_id", "current_status");

CREATE INDEX IF NOT EXISTS "reports_status_changed_at_idx"
ON "reports" ("status_changed_at");

CREATE INDEX IF NOT EXISTS "report_status_history_report_id_created_at_idx"
ON "report_status_history" ("report_id", "created_at");

CREATE INDEX IF NOT EXISTS "report_status_history_to_status_idx"
ON "report_status_history" ("to_status");