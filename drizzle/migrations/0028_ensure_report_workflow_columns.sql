-- Ensure report workflow columns exist even if 0027 was already journaled.
-- Safe/idempotent for staging and production.

ALTER TABLE "reports"
  ADD COLUMN IF NOT EXISTS "workflow_stage" text NOT NULL DEFAULT 'sample_received',
  ADD COLUMN IF NOT EXISTS "special_stain_requested" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "special_stain_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "workflow_updated_at" timestamp with time zone;
