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
  const clinicId = 4;
  const username = "publicdemo";
  const password = "demo1234";
  const passwordHash = hashLegacyPassword(password);

  const clinicRows = await sql`
    select id, name
    from clinics
    where id = ${clinicId}
    limit 1
  `;

  if (clinicRows.length === 0) {
    throw new Error(`No existe la clínica ${clinicId}`);
  }

  const existing = await sql`
    select id, clinic_id, username
    from clinic_users
    where username = ${username}
    limit 1
  `;

  let result;

  if (existing.length > 0) {
    const updated = await sql`
      update clinic_users
      set
        clinic_id = ${clinicId},
        password_hash = ${passwordHash},
        updated_at = now(),
        role = 'clinic_staff'
      where id = ${existing[0].id}
      returning id, clinic_id, username, updated_at
    `;

    result = {
      action: "updated",
      credentials: {
        username,
        password
      },
      clinic: clinicRows[0],
      user: updated[0]
    };
  } else {
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
        ${clinicId},
        ${username},
        ${passwordHash},
        null,
        now(),
        now(),
        'clinic_staff'
      )
      returning id, clinic_id, username, created_at, updated_at
    `;

    result = {
      action: "inserted",
      credentials: {
        username,
        password
      },
      clinic: clinicRows[0],
      user: inserted[0]
    };
  }

  console.log("CLINIC_USER_READY");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("ERROR_PREPARING_CLINIC_USER");
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
