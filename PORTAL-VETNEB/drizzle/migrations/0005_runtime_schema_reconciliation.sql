-- 0005_runtime_schema_reconciliation.sql
-- FORMALIZA LOS FIXES MANUALES APLICADOS EN ENTORNOS DE DESARROLLO

BEGIN;

-- =========================
-- CLINIC_USERS
-- =========================

ALTER TABLE clinic_users
ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;

-- =========================
-- ACTIVE_SESSIONS
-- =========================

ALTER TABLE active_sessions
ADD COLUMN IF NOT EXISTS token_hash varchar(64);

-- SI EXISTE token, DEJARLO NULLABLE PARA COMPATIBILIDAD CON EL NUEVO FLUJO
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'active_sessions'
      AND column_name = 'token'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE active_sessions
    ALTER COLUMN token DROP NOT NULL;
  END IF;
END
$$;

-- LIMPIAR SESIONES LEGACY SIN token_hash
DELETE FROM active_sessions
WHERE token_hash IS NULL;

-- ASEGURAR NOT NULL EN token_hash DESPUES DE LIMPIEZA
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'active_sessions'
      AND column_name = 'token_hash'
  ) THEN
    ALTER TABLE active_sessions
    ALTER COLUMN token_hash SET NOT NULL;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS active_sessions_token_hash_uidx
ON active_sessions(token_hash);

-- =========================
-- REPORTS
-- =========================

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS storage_path varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS reports_storage_path_uidx
ON reports(storage_path);

COMMIT;
