-- Global admin workflow for every uploaded report.
-- The workflow is independent from study tracking and particular access tokens.

ALTER TABLE "reports"
  ADD COLUMN IF NOT EXISTS "workflow_stage" text NOT NULL DEFAULT 'sample_received',
  ADD COLUMN IF NOT EXISTS "special_stain_requested" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "special_stain_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "workflow_updated_at" timestamp with time zone;
