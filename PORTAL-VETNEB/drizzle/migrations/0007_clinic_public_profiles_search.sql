BEGIN;

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION immutable_unaccent(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT public.unaccent('public.unaccent', COALESCE(input, ''));
$$;

CREATE TABLE IF NOT EXISTS clinic_public_profiles (
  clinic_id integer PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
  display_name varchar(255),
  avatar_storage_path varchar(512),
  about_text text,
  specialty_text text,
  services_text text,
  email varchar(255),
  phone varchar(50),
  locality varchar(255),
  country varchar(255),
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinic_public_profiles_is_public_idx
ON clinic_public_profiles(is_public);

CREATE INDEX IF NOT EXISTS clinic_public_profiles_country_idx
ON clinic_public_profiles(country);

CREATE INDEX IF NOT EXISTS clinic_public_profiles_locality_idx
ON clinic_public_profiles(locality);

CREATE TABLE IF NOT EXISTS clinic_public_search (
  clinic_id integer PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
  display_name varchar(255) NOT NULL,
  avatar_storage_path varchar(512),
  about_text text,
  specialty_text text,
  services_text text,
  email varchar(255),
  phone varchar(50),
  locality varchar(255),
  country varchar(255),
  is_public boolean NOT NULL DEFAULT false,
  search_text text NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinic_public_search_is_public_idx
ON clinic_public_search(is_public);

CREATE INDEX IF NOT EXISTS clinic_public_search_updated_at_idx
ON clinic_public_search(updated_at DESC);

CREATE INDEX IF NOT EXISTS clinic_public_search_vector_idx
ON clinic_public_search
USING gin (to_tsvector('simple', immutable_unaccent(search_text)));

CREATE INDEX IF NOT EXISTS clinic_public_search_text_trgm_idx
ON clinic_public_search
USING gin (immutable_unaccent(search_text) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS clinic_public_search_locality_trgm_idx
ON clinic_public_search
USING gin (immutable_unaccent(locality) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS clinic_public_search_country_trgm_idx
ON clinic_public_search
USING gin (immutable_unaccent(country) gin_trgm_ops);

INSERT INTO clinic_public_search (
  clinic_id,
  display_name,
  avatar_storage_path,
  about_text,
  specialty_text,
  services_text,
  email,
  phone,
  locality,
  country,
  is_public,
  search_text,
  updated_at
)
SELECT
  c.id,
  c.name,
  NULL,
  NULL,
  NULL,
  NULL,
  c.contact_email,
  c.contact_phone,
  NULL,
  NULL,
  false,
  trim(
    concat_ws(' ', c.name, c.contact_email, c.contact_phone)
  ),
  now()
FROM clinics c
ON CONFLICT (clinic_id) DO NOTHING;

COMMIT;
