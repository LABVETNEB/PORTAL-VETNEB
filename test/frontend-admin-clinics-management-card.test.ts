import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_CLINICS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("admin clinics management card is client-side and imports admin APIs", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("createAdminClinicWithUser"));
  assert.ok(source.includes("getAdminClinics"));
  assert.ok(source.includes("updateAdminClinic"));
  assert.ok(source.includes("updateAdminClinicUserCredentials"));
  assert.ok(source.includes("changeAdminClinicUserRole"));
  assert.ok(source.includes('import { Input } from "@/components/ui/input";'));
  assert.ok(source.includes('import { Button } from "@/components/ui/button";'));
  assert.ok(source.includes('import { Badge } from "@/components/ui/badge";'));
});

test("admin clinics management card contains alta clínica form fields", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  assert.ok(source.includes("Nombre clínica"));
  assert.ok(source.includes("Email contacto"));
  assert.ok(source.includes("Teléfono"));
  assert.ok(source.includes("Usuario de acceso"));
  assert.ok(source.includes("Contraseña inicial"));
  assert.ok(source.includes("Rol inicial"));
  assert.ok(source.includes("Crear clínica"));
  assert.ok(source.includes('value={createForm.role}'));
  assert.ok(source.includes('<option value="clinic_owner">Owner clínica</option>'));
  assert.ok(source.includes('<option value="clinic_staff">Staff clínica</option>'));
});

test("admin clinics management card lists clinics users and editable actions", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  assert.ok(source.includes('<Card id="admin-clinics"'));
  assert.ok(source.includes("<TableHead>Clínica</TableHead>"));
  assert.ok(source.includes("<TableHead>Contacto</TableHead>"));
  assert.ok(source.includes("<TableHead>Usuario</TableHead>"));
  assert.ok(source.includes("<TableHead>Rol</TableHead>"));
  assert.ok(source.includes("Guardar clínica"));
  assert.ok(source.includes("Guardar acceso"));
  assert.ok(source.includes("Cambiar rol"));
  assert.ok(source.includes("formatDateTime(clinic.createdAt)"));
  assert.ok(source.includes("formatDateTime(clinic.updatedAt)"));
});

test("admin clinics management card confirms credential replacement and avoids hashes", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  assert.ok(source.includes("window.confirm("));
  assert.ok(source.includes("La contraseña se reemplaza; no se puede consultar la actual."));
  assert.ok(source.includes("Nueva contraseña"));
  assert.equal(source.includes("passwordHash"), false);
  assert.equal(source.includes("password_hash"), false);
  assert.equal(source.includes("hash"), false);
  assert.equal(source.includes("contraseña actual"), false);
});
