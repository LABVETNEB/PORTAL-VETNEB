CREATE TABLE IF NOT EXISTS "global_search_states" (
  "id" uuid PRIMARY KEY NOT NULL,
  "surface" varchar(16) NOT NULL,
  "clinic_session_token_hash" varchar(64)
    REFERENCES "active_sessions" ("token_hash") ON DELETE CASCADE,
  "admin_session_token_hash" varchar(64)
    REFERENCES "admin_sessions" ("token_hash") ON DELETE CASCADE,
  "query_text" varchar(200) NOT NULL,
  "kinds" varchar(120),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp NOT NULL,
  CONSTRAINT "global_search_states_surface_owner_check" CHECK (
    ("surface" = 'clinic' AND "clinic_session_token_hash" IS NOT NULL AND "admin_session_token_hash" IS NULL)
    OR ("surface" = 'admin' AND "admin_session_token_hash" IS NOT NULL AND "clinic_session_token_hash" IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS "global_search_states_clinic_session_idx"
  ON "global_search_states" ("clinic_session_token_hash", "created_at");

CREATE INDEX IF NOT EXISTS "global_search_states_admin_session_idx"
  ON "global_search_states" ("admin_session_token_hash", "created_at");

CREATE INDEX IF NOT EXISTS "global_search_states_expires_at_idx"
  ON "global_search_states" ("expires_at");

-- Rollback (manual, documented in docs/implementation/global-search-drive-a-canonical-query.md):
--   DROP TABLE IF EXISTS "global_search_states";
