import "dotenv/config";
import postgres from "postgres";

const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Falta SUPABASE_DB_URL o DATABASE_URL en .env");
}

const sql = postgres(databaseUrl, { prepare: false });

try {
  await sql.begin(async (tx) => {
    await tx.unsafe(`
      CREATE EXTENSION IF NOT EXISTS unaccent;
    `);

    await tx.unsafe(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
    `);

    await tx.unsafe(`
      CREATE OR REPLACE FUNCTION immutable_unaccent(input text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      PARALLEL SAFE
      AS $$
        SELECT public.unaccent('public.unaccent', COALESCE(input, ''));
      $$;
    `);

    await tx.unsafe(`
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
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS clinic_public_profiles_is_public_idx
      ON clinic_public_profiles(is_public);
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS clinic_public_profiles_country_idx
      ON clinic_public_profiles(country);
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS clinic_public_profiles_locality_idx
      ON clinic_public_profiles(locality);
    `);

    await tx.unsafe(`
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
    `);

    await tx.unsafe(`
      ALTER TABLE clinic_public_search
      ADD COLUMN IF NOT EXISTS has_required_public_fields boolean NOT NULL DEFAULT false;
    `);

    await tx.unsafe(`
      ALTER TABLE clinic_public_search
      ADD COLUMN IF NOT EXISTS is_search_eligible boolean NOT NULL DEFAULT false;
    `);

    await tx.unsafe(`
      ALTER TABLE clinic_public_search
      ADD COLUMN IF NOT EXISTS profile_quality_score integer NOT NULL DEFAULT 0;
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS clinic_public_search_is_public_idx
      ON clinic_public_search(is_public);
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS clinic_public_search_updated_at_idx
      ON clinic_public_search(updated_at DESC);
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS clinic_public_search_is_search_eligible_idx
      ON clinic_public_search(is_search_eligible);
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS clinic_public_search_profile_quality_score_idx
      ON clinic_public_search(profile_quality_score DESC);
    `);

    await tx.unsafe(`
      DROP INDEX IF EXISTS clinic_public_search_vector_idx;
    `);

    await tx.unsafe(`
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
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS clinic_public_search_text_trgm_idx
      ON clinic_public_search
      USING gin (immutable_unaccent(search_text) gin_trgm_ops);
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS clinic_public_search_locality_trgm_idx
      ON clinic_public_search
      USING gin (immutable_unaccent(locality) gin_trgm_ops);
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS clinic_public_search_country_trgm_idx
      ON clinic_public_search
      USING gin (immutable_unaccent(country) gin_trgm_ops);
    `);

    await tx.unsafe(`
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
        has_required_public_fields,
        is_search_eligible,
        profile_quality_score,
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
        false,
        false,
        0,
        trim(concat_ws(' ', c.name, c.contact_email, c.contact_phone)),
        now()
      FROM clinics c
      ON CONFLICT (clinic_id) DO NOTHING;
    `);

    await tx.unsafe(`
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
          )::int AS computed_profile_quality_score
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
          normalized.computed_profile_quality_score >= 75
        ),
        profile_quality_score = normalized.computed_profile_quality_score
      FROM normalized
      WHERE normalized.clinic_id = cps.clinic_id;
    `);
  });

  const checks = await sql.unsafe(`
    SELECT
      column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clinic_public_search'
      AND column_name IN (
        'has_required_public_fields',
        'is_search_eligible',
        'profile_quality_score'
      )
    ORDER BY column_name;
  `);

  const tables = await sql.unsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('clinic_public_profiles', 'clinic_public_search')
    ORDER BY table_name;
  `);

  console.log("PUBLIC_PROFILE_RECONCILIATION_OK");
  console.log(JSON.stringify({ tables, columns: checks }, null, 2));
} catch (error) {
  console.error("PUBLIC_PROFILE_RECONCILIATION_ERROR");
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
