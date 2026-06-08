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
  assert.ok(source.includes("deleteAdminClinic"));
  assert.ok(source.includes("updateAdminClinicUserCredentials"));
  assert.ok(source.includes("BACKEND_CONNECTION_ERROR_MESSAGE"));
  assert.ok(source.includes('import { Input } from "@/components/ui/input";'));
  assert.ok(source.includes('import { Button } from "@/components/ui/button";'));
  assert.equal(source.includes('import { Badge } from "@/components/ui/badge";'), false);
});

test("admin clinics management card contains alta clínica form fields without roles", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  assert.ok(source.includes("Nombre clínica"));
  assert.ok(source.includes("Email contacto"));
  assert.ok(source.includes("Teléfono"));
  assert.ok(source.includes("Usuario de acceso"));
  assert.ok(source.includes("Contraseña inicial"));
  assert.ok(source.includes("Crear clínica"));
  assert.equal(source.includes("Rol inicial"), false);
  assert.equal(source.includes("<TableHead>Rol</TableHead>"), false);
  assert.equal(source.includes("Owner clínica"), false);
  assert.equal(source.includes("Staff clínica"), false);
  assert.equal(source.includes("createForm.role"), false);
});

test("admin clinics management card lists clinics users and editable actions without role actions", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  assert.ok(source.includes('<Card id="admin-clinics"'));
  assert.ok(source.includes("<TableHead>Clínica</TableHead>"));
  assert.ok(source.includes("<TableHead>Contacto</TableHead>"));
  assert.ok(source.includes("<TableHead>Usuario</TableHead>"));
  assert.ok(source.includes("Guardar clínica"));
  assert.ok(source.includes("Guardar acceso"));
  assert.ok(source.includes("Eliminar clínica"));
  assert.ok(
    source.includes(
      "Vas a eliminar definitivamente la clínica",
    ),
  );
  assert.ok(source.includes("confirmClinicName"));
  assert.ok(source.includes("formatDateTime(clinic.createdAt)"));
  assert.ok(source.includes("formatDateTime(clinic.updatedAt)"));
  assert.equal(source.includes("Cambiar rol"), false);
  assert.equal(source.includes("handleChangeRole"), false);
  assert.equal(source.includes("ShieldCheck"), false);
});

test("admin clinics management card keeps admin-entered passwords visible and avoids hashes", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  assert.ok(source.includes("window.confirm("));
  assert.ok(source.includes("Se reemplazará la contraseña de acceso de esta clínica. ¿Confirmás el cambio?"));
  assert.ok(source.includes("La contraseña anterior no se puede consultar. Para recuperación,"));
  assert.ok(source.includes("Nueva contraseña"));
  assert.equal(source.includes('type="password"'), false);
  assert.ok(source.includes('type="text"'));
  assert.equal(source.includes("passwordHash"), false);
  assert.equal(source.includes("password_hash"), false);
  assert.equal(source.includes("hash"), false);
  assert.equal(source.includes("contraseña actual"), false);
});

test("admin clinics management card maps fetch failures to an operational backend message", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  assert.ok(source.includes("formatAdminClinicsError"));
  assert.ok(source.includes("BACKEND_CONNECTION_ERROR_MESSAGE"));
  assert.ok(source.includes('includes("failed to fetch")'));
});

test("admin clinics management card renders a search input and forwards query to server API", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  assert.ok(source.includes('placeholder="Buscar clínica por nombre, email o usuario..."'));
  assert.ok(source.includes('aria-label="Buscar clínicas"'));
  assert.ok(source.includes("searchQuery"));
  assert.ok(source.includes("setSearchQuery"));
  // search is forwarded to getAdminClinics — no client-side double filtering
  assert.ok(source.includes("search:") || source.includes("search,"));
  assert.equal(source.includes("filteredRows"), false);
});

test("admin clinics management card renders server-side pagination controls using snapshot total", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  assert.ok(source.includes('aria-label="Página anterior"'));
  assert.ok(source.includes('aria-label="Página siguiente"'));
  assert.ok(source.includes("currentOffset"));
  assert.ok(source.includes("setCurrentOffset"));
  assert.ok(source.includes("totalClinics"));
  assert.ok(source.includes("hasPrev"));
  assert.ok(source.includes("hasNext"));
  assert.ok(source.includes("snapshot?.total"));
  assert.ok(source.includes("PAGE_SIZE"));
});

test("admin clinics management card shows no-results state when search finds no matches", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  assert.ok(source.includes("No hay clínicas que coincidan"));
  assert.ok(source.includes("searchQuery.trim()"));
});

test("admin clinics management card resets to page 0 when search changes", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  // useEffect depends on searchQuery and calls loadClinics with offset 0
  assert.ok(source.includes("searchQuery]"));
  assert.ok(source.includes("loadClinics(0"));
});

test("admin clinics management card does not double-filter rows client-side", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  assert.equal(source.includes("filteredRows"), false);
  // rows (unfiltered by client) drive the table
  assert.ok(source.includes("rows.map("));
  assert.ok(source.includes("rows.length"));
});
