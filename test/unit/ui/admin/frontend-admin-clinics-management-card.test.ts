import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_CLINICS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx";

const ADMIN_CLINICS_DRAWER_PATH =
  "frontend/src/app/dashboard/admin/ClinicEditDrawer.tsx";

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
  // Edit actions are delegated to the drawer component
  const drawerSource = read(ADMIN_CLINICS_DRAWER_PATH);

  // B12 module-card removal added a marker attribute, which pushed the JSX
  // attributes onto separate lines; the identity (id) and the B12 audit
  // marker must both still be present on the same <Card>.
  assert.match(
    source,
    /<Card\s+id="admin-clinics"\s+data-dashboard-b12-module-card="true"/,
  );
  assert.ok(source.includes("<TableHead>Clínica</TableHead>"));
  assert.ok(source.includes("<TableHead>Contacto</TableHead>"));
  assert.ok(source.includes("<TableHead>Usuario</TableHead>"));
  // Edit actions live in the drawer (split from inline table editing in PR3C)
  assert.ok(drawerSource.includes("Guardar clínica"));
  assert.ok(drawerSource.includes("Guardar acceso"));
  assert.ok(drawerSource.includes("Eliminar clínica"));
  assert.ok(drawerSource.includes("Vas a eliminar definitivamente la clínica"));
  assert.ok(source.includes("confirmClinicName"));
  assert.ok(source.includes("formatDateTime(clinic.createdAt)"));
  assert.ok(source.includes("formatDateTime(clinic.updatedAt)"));
  assert.equal(source.includes("Cambiar rol"), false);
  assert.equal(source.includes("handleChangeRole"), false);
  assert.equal(source.includes("ShieldCheck"), false);
});

test("admin clinics management card hides admin-entered passwords by default and avoids hashes", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);
  const drawerSource = read(ADMIN_CLINICS_DRAWER_PATH);

  assert.ok(drawerSource.includes("window.confirm("));
  assert.ok(drawerSource.includes("Se reemplazará la contraseña de acceso de esta clínica. ¿Confirmás el cambio?"));
  assert.ok(source.includes("La contraseña anterior no se puede consultar. Para recuperación,"));
  assert.ok(drawerSource.includes("Nueva contraseña"));
  assert.ok(
    source.includes(
      "const [isCreatePasswordVisible, setIsCreatePasswordVisible] = useState(false)",
    ),
  );
  assert.ok(
    source.includes(
      'type={isCreatePasswordVisible ? "text" : "password"}',
    ),
  );
  assert.ok(
    drawerSource.includes(
      "const [visiblePasswordUserIds, setVisiblePasswordUserIds] = useState<",
    ),
  );
  assert.ok(
    drawerSource.includes('type={isPasswordVisible ? "text" : "password"}'),
  );
  assert.equal(source.includes('type="text"'), false);
  assert.equal(drawerSource.includes('type="text"'), false);
  assert.equal(source.includes("passwordHash"), false);
  assert.equal(drawerSource.includes("passwordHash"), false);
  assert.equal(source.includes("password_hash"), false);
  assert.equal(drawerSource.includes("password_hash"), false);
  assert.equal(source.includes("hash"), false);
  assert.equal(drawerSource.includes("hash"), false);
  assert.equal(source.includes("contraseña actual"), false);
  assert.equal(drawerSource.includes("contraseña actual"), false);
});

test("admin clinic password reveal controls require explicit accessible interaction", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);
  const drawerSource = read(ADMIN_CLINICS_DRAWER_PATH);

  assert.ok(source.includes('type="button"'));
  assert.ok(
    source.includes(
      'aria-label={isCreatePasswordVisible ? "Ocultar contraseña inicial" : "Mostrar contraseña inicial"}',
    ),
  );
  assert.ok(source.includes("aria-pressed={isCreatePasswordVisible}"));
  assert.ok(source.includes('aria-controls="create-clinic-password"'));
  assert.ok(
    source.includes(
      "onClick={() => setIsCreatePasswordVisible((current) => !current)}",
    ),
  );

  assert.ok(drawerSource.includes('type="button"'));
  assert.ok(
    drawerSource.includes(
      'aria-label={isPasswordVisible ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"}',
    ),
  );
  assert.ok(drawerSource.includes("aria-pressed={isPasswordVisible}"));
  assert.ok(drawerSource.includes("aria-controls={passwordInputId}"));
  assert.ok(
    drawerSource.includes(
      "onClick={() => togglePasswordVisibility(user.userId)}",
    ),
  );
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
  assert.ok(source.includes("offset"));
  assert.ok(source.includes("setOffset"));
  assert.ok(source.includes("totalClinics"));
  assert.ok(source.includes("hasPrev"));
  assert.ok(source.includes("hasNext"));
  assert.ok(source.includes("snapshot?.total"));
  assert.ok(source.includes("CLINICS_FALLBACK_ROWS"));
});

test("admin clinics management card derives cardinality from measurement, not matchMedia", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  assert.ok(source.includes("useDashboardCanvasCapacity"));
  assert.ok(source.includes("effectiveLimit"));
  assert.ok(source.includes("CLINICS_SUPERSET_CAP = 36"));
  assert.ok(source.includes("canvasNode: desktopBodyNode,"));
  assert.ok(source.includes("latestRequestRef"));
  assert.equal(source.includes("matchMedia"), false);
  assert.equal(source.includes("MOBILE_PAGE_SIZE"), false);
  assert.equal(source.includes("effectivePageSize"), false);
  assert.equal(source.includes("isMobileViewport"), false);
});

test("admin clinics management card shows no-results state when search finds no matches", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  assert.ok(source.includes("No hay clínicas que coincidan"));
  assert.ok(source.includes("searchQuery.trim()"));
});

test("admin clinics management card resets to page 0 when search changes", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  // Debounced search effect resets offset to 0 before the query re-fetches.
  assert.ok(source.includes("}, [searchQuery]);"));
  assert.ok(source.includes("setOffset(0);"));
  assert.ok(source.includes("setSubmittedSearch(searchQuery.trim());"));
});

test("admin clinics management card does not double-filter rows client-side", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  assert.equal(source.includes("filteredRows"), false);
  // rows (unfiltered by client) drive the table
  assert.ok(source.includes("rows.map("));
  assert.ok(source.includes("rows.length"));
});

test("clinic edit drawer is client-side and uses accessible dialog pattern", () => {
  const drawerSource = read(ADMIN_CLINICS_DRAWER_PATH);

  assert.ok(drawerSource.includes('"use client";'));
  // Uses Radix Dialog for focus-trap, escape-key, and ARIA
  assert.ok(drawerSource.includes("@radix-ui/react-dialog"));
  assert.ok(drawerSource.includes("Dialog.Root"));
  assert.ok(drawerSource.includes("Dialog.Content"));
  assert.ok(drawerSource.includes("Dialog.Title"));
  assert.ok(drawerSource.includes("Dialog.Close"));
  assert.ok(drawerSource.includes("aria-labelledby"));
  assert.ok(drawerSource.includes('aria-label="Cerrar panel de edición"'));
  assert.ok(drawerSource.includes("role=\"alert\""));
});

test("clinic edit drawer exports ClinicDraft and CredentialsPayload types for contract stability", () => {
  const drawerSource = read(ADMIN_CLINICS_DRAWER_PATH);

  assert.ok(drawerSource.includes("export type ClinicDraft"));
  assert.ok(drawerSource.includes("export type CredentialsPayload"));
  assert.ok(drawerSource.includes("export function ClinicEditDrawer"));
});

test("admin clinics management card renders mobile cards while preserving desktop table", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  assert.ok(
    source.includes("data-admin-mobile-core-module=\"clinics\""),
    "single collapsed runtime keeps the mobile core module landmark",
  );
  assert.ok(
    source.includes('data-admin-clinics-mobile-list="true"'),
    "mobile list landmark must exist",
  );
  assert.ok(
    source.includes('data-admin-clinic-mobile-card="true"'),
    "mobile clinic cards must exist",
  );
  assert.ok(
    source.includes('data-admin-mobile-core-item="true"'),
    "mobile clinic cards must keep the core item landmark",
  );
  assert.ok(
    source.includes('data-admin-mobile-core-pager="true"'),
    "mobile pager must keep the core pager landmark",
  );
  assert.ok(
    source.includes('dashboard-table-responsive hidden min-h-0 flex-1 md:block'),
    "desktop table must be hidden on mobile, fill its measured region and be preserved from md upward",
  );
  assert.ok(
    source.includes('aria-label={`Editar clínica ${clinic.clinicName}`}'),
    "mobile edit action must keep the accessible clinic-specific label",
  );
});

test("admin clinics management card keeps a single runtime — no separate mobile module", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);

  // Unlike Sessions/Users, Clinics never had a standalone AdminMobileClinicsModule;
  // the desktop/mobile duality already lived inside this single component, so
  // R-02 collapses cardinality here without introducing a compat shim.
  assert.ok(source.includes("export function AdminClinicsManagementCard()"));
  assert.equal(source.includes("AdminMobileClinicsModule"), false);
});
