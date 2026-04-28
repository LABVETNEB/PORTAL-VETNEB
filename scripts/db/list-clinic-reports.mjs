import "dotenv/config";
import postgres from "postgres";

const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const rawClinicId = process.argv[2] ?? process.env.CLINIC_ID;
const clinicId = Number(rawClinicId);

if (!databaseUrl) {
  throw new Error("Falta SUPABASE_DB_URL o DATABASE_URL en .env");
}

if (!Number.isInteger(clinicId) || clinicId <= 0) {
  throw new Error(
    "Uso: node scripts/db/list-clinic-reports.mjs <clinicId> o define CLINIC_ID",
  );
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
    where clinic_id = ${clinicId}
    order by id asc
  `;

  console.log(JSON.stringify(rows, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}