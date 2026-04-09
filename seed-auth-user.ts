import { hashPassword } from "./server/lib/auth-security.ts";
import { upsertClinicUser, db } from "./server/db.ts";
import { adminUsers, clinics } from "./drizzle/schema.ts";
import { asc, eq } from "drizzle-orm";

async function main() {
  const clinicRows = await db.select().from(clinics).orderBy(asc(clinics.id)).limit(1);

  if (clinicRows.length === 0) {
    throw new Error("No existe ninguna clínica en public.clinics");
  }

  const clinic = clinicRows[0];
  const passwordHash = await hashPassword("admin123");

  const clinicUser = await upsertClinicUser({
    clinicId: clinic.id,
    username: "admin",
    passwordHash,
    authProId: null,
  });

  const existingAdmin = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, "admin@vetneb.com"))
    .limit(1);

  if (existingAdmin.length === 0) {
    await db.insert(adminUsers).values({
      email: "admin@vetneb.com",
      fullName: "Admin Vetneb",
      isActive: true,
    });
  } else {
    await db
      .update(adminUsers)
      .set({
        fullName: "Admin Vetneb",
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.email, "admin@vetneb.com"));
  }

  console.log("OK");
  console.log({
    clinicId: clinic.id,
    username: "admin",
    password: "admin123",
    adminEmail: "admin@vetneb.com",
    clinicUserId: clinicUser.id,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
