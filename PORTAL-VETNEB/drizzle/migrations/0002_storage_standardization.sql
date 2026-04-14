DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clinics'
      AND column_name = 'drive_folder_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clinics'
      AND column_name = 'storage_folder_path'
  ) THEN
    ALTER TABLE public.clinics
      RENAME COLUMN drive_folder_id TO storage_folder_path;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reports'
      AND column_name = 'drive_file_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reports'
      AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE public.reports
      RENAME COLUMN drive_file_id TO storage_path;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'reports'
      AND constraint_name = 'reports_drive_file_id_unique'
  ) THEN
    ALTER TABLE public.reports
      RENAME CONSTRAINT reports_drive_file_id_unique TO reports_storage_path_unique;
  END IF;
END $$;

ALTER TABLE public.clinics
  ALTER COLUMN storage_folder_path TYPE varchar(255);

ALTER TABLE public.reports
  ALTER COLUMN storage_path TYPE varchar(255);
