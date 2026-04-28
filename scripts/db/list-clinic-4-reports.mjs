import "dotenv/config";
import postgres from "postgres";

const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Falta SUPABASE_DB_URL o DATABASE_URL en .env");
}

const sql = postgres(databaseUrl, { prepare: false });

try {
  const rows = await sql`
    select
      id,
      clinic_id,
      upload_date,
      study_type,
      patient_name,
      file_name,
      storage_path,
      created_at
    from reports
    where clinic_id = 4
    order by id asc
  `;

  console.log(JSON.stringify(rows, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
