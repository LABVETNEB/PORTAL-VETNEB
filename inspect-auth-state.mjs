import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? "", {
  prepare: false,
});

async function main() {
  const clinics = await sql`select id, name, contact_email, contact_phone from public.clinics order by id`;
  const clinicUsers = await sql`select id, clinic_id, username, auth_pro_id, created_at, updated_at from public.clinic_users order by id`;
  const adminUsers = await sql`select id, email, full_name, is_active, created_at, updated_at from public.admin_users order by id`;

  console.log("CLINICS");
  console.table(clinics);

  console.log("CLINIC_USERS");
  console.table(clinicUsers);

  console.log("ADMIN_USERS");
  console.table(adminUsers);

  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exit(1);
});
