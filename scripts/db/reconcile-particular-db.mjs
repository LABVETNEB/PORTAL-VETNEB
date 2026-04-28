import "dotenv/config";
import postgres from "postgres";

const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Falta SUPABASE_DB_URL o DATABASE_URL en el archivo .env");
}

const sql = postgres(databaseUrl, { prepare: false });

try {
  await sql.begin(async (tx) => {
    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS particular_tokens (
        id serial PRIMARY KEY,
        clinic_id integer NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
        report_id integer REFERENCES reports(id) ON DELETE SET NULL,
        created_by_admin_id integer REFERENCES admin_users(id) ON DELETE SET NULL,
        created_by_clinic_user_id integer REFERENCES clinic_users(id) ON DELETE SET NULL,
        token_hash varchar(64) NOT NULL,
        token_last4 varchar(4) NOT NULL,
        tutor_last_name varchar(255) NOT NULL,
        pet_name varchar(255) NOT NULL,
        pet_age varchar(100) NOT NULL,
        pet_breed varchar(255) NOT NULL,
        pet_sex varchar(50) NOT NULL,
        pet_species varchar(100) NOT NULL,
        sample_location text NOT NULL,
        sample_evolution text NOT NULL,
        details_lesion text,
        extraction_date timestamp NOT NULL,
        shipping_date timestamp NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        last_login_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT particular_tokens_token_hash_unique UNIQUE(token_hash),
        CONSTRAINT particular_tokens_details_lesion_len_chk CHECK (
          details_lesion IS NULL OR char_length(details_lesion) <= 10000
        )
      );
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS particular_tokens_token_hash_idx
      ON particular_tokens(token_hash);
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS particular_tokens_clinic_id_idx
      ON particular_tokens(clinic_id);
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS particular_tokens_report_id_idx
      ON particular_tokens(report_id);
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS particular_tokens_clinic_created_at_idx
      ON particular_tokens(clinic_id, created_at DESC);
    `);

    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS particular_sessions (
        id serial PRIMARY KEY,
        particular_token_id integer NOT NULL REFERENCES particular_tokens(id) ON DELETE CASCADE,
        token_hash varchar(64) NOT NULL,
        last_access timestamp,
        expires_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT particular_sessions_token_hash_unique UNIQUE(token_hash)
      );
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS particular_sessions_token_hash_idx
      ON particular_sessions(token_hash);
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS particular_sessions_particular_token_id_idx
      ON particular_sessions(particular_token_id);
    `);
  });

  const tables = await sql.unsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('particular_tokens', 'particular_sessions')
    ORDER BY table_name;
  `);

  console.log("Reconciliacion OK");
  console.log(tables);
} catch (error) {
  console.error("Fallo la reconciliacion:", error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
