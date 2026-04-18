import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import postgres from "postgres";

const repoRoot = process.cwd();
const envPath = path.join(repoRoot, ".env");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
} else {
  dotenv.config({ override: true });
}

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("Falta SUPABASE_DB_URL o DATABASE_URL en .env");
  process.exit(1);
}

const sql = postgres(dbUrl, { prepare: false });

async function columnExists(tx, columnName) {
  const rows = await tx`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_access_tokens'
      AND column_name = ${columnName}
    LIMIT 1;
  `;

  return rows.length > 0;
}

async function main() {
  console.log("== RECONCILIAR report_access_tokens ==");

  await sql.begin(async (tx) => {
    await tx`
      CREATE TABLE IF NOT EXISTS public.report_access_tokens (
        id serial PRIMARY KEY,
        clinic_id integer NOT NULL,
        report_id integer NOT NULL,
        created_by_clinic_user_id integer,
        created_by_admin_user_id integer,
        revoked_by_clinic_user_id integer,
        revoked_by_admin_user_id integer,
        token_hash varchar(64) NOT NULL,
        token_last4 varchar(4),
        access_count integer NOT NULL DEFAULT 0,
        last_access_at timestamp,
        expires_at timestamp,
        revoked_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `;

    await tx`
      ALTER TABLE public.report_access_tokens
        ADD COLUMN IF NOT EXISTS created_by_clinic_user_id integer,
        ADD COLUMN IF NOT EXISTS created_by_admin_user_id integer,
        ADD COLUMN IF NOT EXISTS revoked_by_clinic_user_id integer,
        ADD COLUMN IF NOT EXISTS revoked_by_admin_user_id integer,
        ADD COLUMN IF NOT EXISTS token_hash varchar(64),
        ADD COLUMN IF NOT EXISTS token_last4 varchar(4),
        ADD COLUMN IF NOT EXISTS access_count integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_access_at timestamp,
        ADD COLUMN IF NOT EXISTS expires_at timestamp,
        ADD COLUMN IF NOT EXISTS revoked_at timestamp,
        ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
    `;

    const hasLegacyToken = await columnExists(tx, "token");
    const hasLegacyIsActive = await columnExists(tx, "is_active");
    const hasLegacyCreatedBy = await columnExists(tx, "created_by");
    const hasLegacyCreatedByType = await columnExists(tx, "created_by_type");

    if (hasLegacyToken) {
      await tx`
        ALTER TABLE public.report_access_tokens
        ALTER COLUMN token DROP NOT NULL;
      `;
    }

    if (hasLegacyCreatedByType) {
      await tx`
        ALTER TABLE public.report_access_tokens
        ALTER COLUMN created_by_type DROP NOT NULL;
      `;
    }

    if (hasLegacyCreatedBy && hasLegacyCreatedByType) {
      await tx`
        UPDATE public.report_access_tokens
        SET created_by_clinic_user_id = created_by
        WHERE created_by_clinic_user_id IS NULL
          AND created_by IS NOT NULL
          AND created_by_type = 'clinic_user';
      `;

      await tx`
        UPDATE public.report_access_tokens
        SET created_by_admin_user_id = created_by
        WHERE created_by_admin_user_id IS NULL
          AND created_by IS NOT NULL
          AND created_by_type = 'admin_user';
      `;
    }

    if (hasLegacyIsActive) {
      await tx`
        UPDATE public.report_access_tokens
        SET revoked_at = COALESCE(revoked_at, updated_at, created_at, now())
        WHERE is_active = false
          AND revoked_at IS NULL;
      `;

      await tx`
        UPDATE public.report_access_tokens
        SET is_active = false
        WHERE revoked_at IS NOT NULL;
      `;
    }

    if (hasLegacyToken) {
      await tx`
        UPDATE public.report_access_tokens
        SET token_last4 = RIGHT(token, 4)
        WHERE token_last4 IS NULL
          AND token IS NOT NULL;
      `;
    }

    await tx`
      UPDATE public.report_access_tokens
      SET token_last4 = RIGHT(token_hash, 4)
      WHERE token_last4 IS NULL
        AND token_hash IS NOT NULL;
    `;

    await tx`
      ALTER TABLE public.report_access_tokens
        ALTER COLUMN clinic_id SET NOT NULL,
        ALTER COLUMN report_id SET NOT NULL,
        ALTER COLUMN token_hash SET NOT NULL,
        ALTER COLUMN token_last4 SET NOT NULL,
        ALTER COLUMN access_count SET NOT NULL,
        ALTER COLUMN access_count SET DEFAULT 0,
        ALTER COLUMN created_at SET NOT NULL,
        ALTER COLUMN created_at SET DEFAULT now(),
        ALTER COLUMN updated_at SET NOT NULL,
        ALTER COLUMN updated_at SET DEFAULT now();
    `;

    await tx`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'rat_clinic_fk'
        ) THEN
          ALTER TABLE public.report_access_tokens
          ADD CONSTRAINT rat_clinic_fk
          FOREIGN KEY (clinic_id)
          REFERENCES public.clinics(id)
          ON DELETE CASCADE;
        END IF;
      END $$;
    `;

    await tx`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'rat_report_fk'
        ) THEN
          ALTER TABLE public.report_access_tokens
          ADD CONSTRAINT rat_report_fk
          FOREIGN KEY (report_id)
          REFERENCES public.reports(id)
          ON DELETE CASCADE;
        END IF;
      END $$;
    `;

    await tx`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'rat_created_clinic_fk'
        ) THEN
          ALTER TABLE public.report_access_tokens
          ADD CONSTRAINT rat_created_clinic_fk
          FOREIGN KEY (created_by_clinic_user_id)
          REFERENCES public.clinic_users(id)
          ON DELETE SET NULL;
        END IF;
      END $$;
    `;

    await tx`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'rat_created_admin_fk'
        ) THEN
          ALTER TABLE public.report_access_tokens
          ADD CONSTRAINT rat_created_admin_fk
          FOREIGN KEY (created_by_admin_user_id)
          REFERENCES public.admin_users(id)
          ON DELETE SET NULL;
        END IF;
      END $$;
    `;

    await tx`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'rat_revoked_clinic_fk'
        ) THEN
          ALTER TABLE public.report_access_tokens
          ADD CONSTRAINT rat_revoked_clinic_fk
          FOREIGN KEY (revoked_by_clinic_user_id)
          REFERENCES public.clinic_users(id)
          ON DELETE SET NULL;
        END IF;
      END $$;
    `;

    await tx`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'rat_revoked_admin_fk'
        ) THEN
          ALTER TABLE public.report_access_tokens
          ADD CONSTRAINT rat_revoked_admin_fk
          FOREIGN KEY (revoked_by_admin_user_id)
          REFERENCES public.admin_users(id)
          ON DELETE SET NULL;
        END IF;
      END $$;
    `;

    await tx`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'rat_token_hash_unique'
        ) THEN
          ALTER TABLE public.report_access_tokens
          ADD CONSTRAINT rat_token_hash_unique UNIQUE (token_hash);
        END IF;
      END $$;
    `;

    await tx`
      CREATE INDEX IF NOT EXISTS report_access_tokens_token_hash_idx
      ON public.report_access_tokens (token_hash);
    `;

    await tx`
      CREATE INDEX IF NOT EXISTS report_access_tokens_clinic_id_idx
      ON public.report_access_tokens (clinic_id);
    `;

    await tx`
      CREATE INDEX IF NOT EXISTS report_access_tokens_report_id_idx
      ON public.report_access_tokens (report_id);
    `;

    await tx`
      CREATE INDEX IF NOT EXISTS report_access_tokens_clinic_report_created_at_idx
      ON public.report_access_tokens (clinic_id, report_id, created_at);
    `;

    await tx`
      CREATE INDEX IF NOT EXISTS report_access_tokens_expires_at_idx
      ON public.report_access_tokens (expires_at);
    `;

    await tx`
      CREATE INDEX IF NOT EXISTS report_access_tokens_revoked_at_idx
      ON public.report_access_tokens (revoked_at);
    `;
  });

  const columns = await sql`
    SELECT
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_access_tokens'
    ORDER BY ordinal_position;
  `;

  console.log("");
  console.log("Columnas actuales de report_access_tokens:");
  console.table(columns);

  console.log("");
  console.log("Reconciliación completada OK");
}

main()
  .catch((error) => {
    console.error("");
    console.error("Fallo la reconciliación de report_access_tokens");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });