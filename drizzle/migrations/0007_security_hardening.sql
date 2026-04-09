BEGIN;

ALTER TABLE clinic_users
ADD COLUMN IF NOT EXISTS role varchar(20);

UPDATE clinic_users
SET role = lower(trim(role))
WHERE role IS NOT NULL;

UPDATE clinic_users
SET role = 'lab'
WHERE role IS NULL OR role NOT IN ('admin', 'lab');

ALTER TABLE clinic_users
ALTER COLUMN role SET DEFAULT 'lab';

ALTER TABLE clinic_users
ALTER COLUMN role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clinic_users_role_check'
  ) THEN
    ALTER TABLE clinic_users
    ADD CONSTRAINT clinic_users_role_check
    CHECK (role IN ('admin', 'lab'));
  END IF;
END
$$;

ALTER TABLE payment_transactions
ADD COLUMN IF NOT EXISTS idempotency_key varchar(128);

UPDATE payment_transactions
SET status = 'cancelled',
    updated_at = now()
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           row_number() OVER (
             PARTITION BY payment_link_id
             ORDER BY created_at DESC, id DESC
           ) AS rn
    FROM payment_transactions
    WHERE status = 'pending'
  ) ranked
  WHERE ranked.rn > 1
);

CREATE INDEX IF NOT EXISTS payment_transactions_idempotency_key_idx
ON payment_transactions(idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_pending_one_per_link_uidx
ON payment_transactions(payment_link_id)
WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_link_idempotency_uidx
ON payment_transactions(payment_link_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_approved_one_per_link_uidx
ON payment_transactions(payment_link_id)
WHERE status = 'approved';

COMMIT;
