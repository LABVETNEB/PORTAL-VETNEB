DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_status_history'
      AND column_name = 'status'
  ) THEN
    EXECUTE 'ALTER TABLE "report_status_history" ALTER COLUMN "status" DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_status_history'
      AND column_name = 'changed_by_type'
  ) THEN
    EXECUTE 'ALTER TABLE "report_status_history" ALTER COLUMN "changed_by_type" DROP NOT NULL';
  END IF;
END $$;