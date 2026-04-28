import "dotenv/config";
import postgres from "postgres";
import crypto from "node:crypto";

const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Falta SUPABASE_DB_URL o DATABASE_URL en .env");
}

const sql = postgres(databaseUrl, { prepare: false });

function hashLegacyPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

try {
  const users = await sql`
    select
      cu.id,
      cu.clinic_id,
      cu.username,
      cu.auth_pro_id,
      cu.created_at,
      c.name as clinic_name
    from clinic_users cu
    inner join clinics c on c.id = cu.clinic_id
    order by cu.id asc
  `;

  if (users.length > 0) {
    console.log("CLINIC_USERS_EXISTENTES");
    console.log(JSON.stringify(users, null, 2));
  } else {
    const clinics = await sql`
      select
        id,
        name
      from clinics
      order by id asc
      limit 1
    `;

    if (clinics.length === 0) {
      throw new Error("No existe ninguna clínica en la base");
    }

    const clinic = clinics[0];
    const username = "publicdemo";
    const password = "demo1234";
    const passwordHash = hashLegacyPassword(password);

    const inserted = await sql`
      insert into clinic_users (
        clinic_id,
        username,
        password_hash,
        auth_pro_id,
        created_at,
        updated_at,
        role
      )
      values (
        ${clinic.id},
        ${username},
        ${passwordHash},
        null,
        now(),
        now(),
        'clinic_owner'
      )
      returning
        id,
        clinic_id,
        username,
        auth_pro_id,
        created_at
    `;

    console.log("CLINIC_USER_CREADO");
    console.log(JSON.stringify({
      credentials: {
        username,
        password
      },
      clinic: {
        id: clinic.id,
        name: clinic.name
      },
      user: inserted[0]
    }, null, 2));
  }
} catch (error) {
  console.error("ERROR_LISTANDO_O_CREANDO_CLINIC_USER");
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
