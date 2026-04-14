BEGIN;

ALTER TABLE clinic_public_search
  ADD COLUMN IF NOT EXISTS has_required_public_fields boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_search_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_quality_score integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS clinic_public_search_is_search_eligible_idx
ON clinic_public_search(is_search_eligible);

CREATE INDEX IF NOT EXISTS clinic_public_search_profile_quality_score_idx
ON clinic_public_search(profile_quality_score DESC);

DROP INDEX IF EXISTS clinic_public_search_vector_idx;

CREATE INDEX IF NOT EXISTS clinic_public_search_weighted_vector_idx
ON clinic_public_search
USING gin (
  (
    setweight(to_tsvector('simple', immutable_unaccent(COALESCE(display_name, ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(COALESCE(specialty_text, ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(COALESCE(locality, ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(COALESCE(country, ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(COALESCE(services_text, ''))), 'B') ||
    setweight(to_tsvector('simple', immutable_unaccent(COALESCE(about_text, ''))), 'C')
  )
);

WITH normalized AS (
  SELECT
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
    CASE
      WHEN COALESCE(length(trim(display_name)), 0) >= 2 THEN true
      ELSE false
    END AS has_display_name,
    CASE
      WHEN COALESCE(length(trim(specialty_text)), 0) >= 3 THEN true
      ELSE false
    END AS has_specialty,
    CASE
      WHEN COALESCE(length(trim(locality)), 0) >= 2 THEN true
      ELSE false
    END AS has_locality,
    CASE
      WHEN COALESCE(length(trim(country)), 0) >= 2 THEN true
      ELSE false
    END AS has_country,
    CASE
      WHEN avatar_storage_path IS NOT NULL THEN true
      WHEN COALESCE(length(trim(about_text)), 0) >= 40 THEN true
      WHEN COALESCE(length(trim(services_text)), 0) >= 20 THEN true
      WHEN COALESCE(length(trim(email)), 0) >= 5 THEN true
      WHEN COALESCE(length(trim(phone)), 0) >= 5 THEN true
      ELSE false
    END AS has_quality_supplement,
    (
      CASE WHEN COALESCE(length(trim(display_name)), 0) >= 2 THEN 15 ELSE 0 END +
      CASE
        WHEN COALESCE(length(trim(specialty_text)), 0) >= 12 THEN 25
        WHEN COALESCE(length(trim(specialty_text)), 0) >= 3 THEN 18
        ELSE 0
      END +
      CASE WHEN COALESCE(length(trim(locality)), 0) >= 2 THEN 15 ELSE 0 END +
      CASE WHEN COALESCE(length(trim(country)), 0) >= 2 THEN 15 ELSE 0 END +
      CASE
        WHEN COALESCE(length(trim(about_text)), 0) >= 120 THEN 12
        WHEN COALESCE(length(trim(about_text)), 0) >= 40 THEN 8
        ELSE 0
      END +
      CASE
        WHEN COALESCE(length(trim(services_text)), 0) >= 60 THEN 12
        WHEN COALESCE(length(trim(services_text)), 0) >= 20 THEN 8
        ELSE 0
      END +
      CASE WHEN COALESCE(length(trim(email)), 0) >= 5 THEN 5 ELSE 0 END +
      CASE WHEN COALESCE(length(trim(phone)), 0) >= 5 THEN 5 ELSE 0 END +
      CASE WHEN avatar_storage_path IS NOT NULL THEN 5 ELSE 0 END
    )::int AS profile_quality_score
  FROM clinic_public_search
)
UPDATE clinic_public_search cps
SET
  has_required_public_fields = (
    normalized.has_display_name AND
    normalized.has_specialty AND
    normalized.has_locality AND
    normalized.has_country
  ),
  is_search_eligible = (
    normalized.is_public AND
    normalized.has_display_name AND
    normalized.has_specialty AND
    normalized.has_locality AND
    normalized.has_country AND
    normalized.has_quality_supplement AND
    normalized.profile_quality_score >= 75
  ),
  profile_quality_score = normalized.profile_quality_score
FROM normalized
WHERE normalized.clinic_id = cps.clinic_id;

COMMIT;
