-- 0026_clinics_contact_columns_reconciliation.sql
-- CONTEXTO: La migración 0010 usó CREATE TABLE IF NOT EXISTS "clinics", que fue
-- un no-op en entornos donde la tabla ya existía (migración 0000). Como resultado,
-- las columnas contact_email y contact_phone nunca se añadieron a la tabla real.
-- Toda consulta que las referencia falla (listAdminClinics GET, legacy INSERT POST).
-- Este script las añade de forma segura e idempotente.

ALTER TABLE "clinics"
  ADD COLUMN IF NOT EXISTS "contact_email" varchar(255);

ALTER TABLE "clinics"
  ADD COLUMN IF NOT EXISTS "contact_phone" varchar(50);
