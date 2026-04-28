import "dotenv/config";
import postgres from "postgres";

const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Falta SUPABASE_DB_URL o DATABASE_URL en .env");
}

const sql = postgres(databaseUrl, { prepare: false });

try {
  const clinics = await sql`
    select
      id,
      name,
      contact_email,
      contact_phone,
      created_at
    from clinics
    order by id asc
  `;

  if (clinics.length > 0) {
    console.log("CLINICAS_EXISTENTES");
    console.log(JSON.stringify(clinics, null, 2));
  } else {
    const inserted = await sql`
      insert into clinics (name, contact_email, contact_phone, created_at, updated_at)
      values (
        'Clinica Demo Particulares',
        'demo@vetneb.local',
        '0000000000',
        now(),
        now()
      )
      returning id, name, contact_email, contact_phone, created_at
    `;

    console.log("CLINICA_CREADA");
    console.log(JSON.stringify(inserted, null, 2));
  }
} catch (error) {
  console.error("ERROR_LISTANDO_O_CREANDO_CLINICA");
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
