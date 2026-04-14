ALTER TABLE clinic_users
ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;

ALTER TABLE active_sessions
ADD COLUMN IF NOT EXISTS token_hash varchar(64);

UPDATE active_sessions
SET token_hash = encode(digest(token::text, 'sha256'), 'hex')
WHERE token_hash IS NULL AND token IS NOT NULL;

ALTER TABLE active_sessions
ALTER COLUMN token_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS active_sessions_token_hash_uidx
ON active_sessions(token_hash);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'clinic_users_clinic_id_fkey'
      AND table_name = 'clinic_users'
  ) THEN
    ALTER TABLE clinic_users
    ADD CONSTRAINT clinic_users_clinic_id_fkey
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'reports_clinic_id_fkey'
      AND table_name = 'reports'
  ) THEN
    ALTER TABLE reports
    ADD CONSTRAINT reports_clinic_id_fkey
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'active_sessions_clinic_user_id_fkey'
      AND table_name = 'active_sessions'
  ) THEN
    ALTER TABLE active_sessions
    ADD CONSTRAINT active_sessions_clinic_user_id_fkey
    FOREIGN KEY (clinic_user_id) REFERENCES clinic_users(id) ON DELETE CASCADE;
  END IF;
END
$$;
