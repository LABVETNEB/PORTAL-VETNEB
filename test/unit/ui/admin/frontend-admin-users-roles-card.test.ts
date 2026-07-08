import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_USERS_ROLES_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("admin users roles card is client-side and imports required dependencies", () => {
  const source = read(ADMIN_USERS_ROLES_CARD_PATH);

  assert.ok(source.includes('"use client";'));
  for (const hook of [
    "useEffect",
    "useLayoutEffect",
    "useMemo",
    "useRef",
    "useState",
    "useTransition",
  ]) {
    assert.ok(source.includes(hook), `missing react hook import: ${hook}`);
  }
  assert.ok(source.includes('from "react";'));
  assert.ok(source.includes('import { Badge } from "@/components/ui/badge";'));
  assert.ok(source.includes('import { Button } from "@/components/ui/button";'));
  assert.ok(source.includes("changeAdminClinicUserRole"));
  assert.ok(source.includes("getAdminUsersRoles"));
  assert.ok(
    source.includes(
      'import { useAdaptiveItemsPerPage } from "@/hooks/useAdaptiveItemsPerPage";',
    ),
  );
  assert.ok(source.includes('import { formatDateTime } from "@/lib/utils";'));
});

test("admin users roles card keeps typed role contracts and adaptive pagination size", () => {
  const source = read(ADMIN_USERS_ROLES_CARD_PATH);

  assert.ok(source.includes("AdminRoleUserRole"));
  assert.ok(source.includes("AdminRoleUserSummary"));
  assert.ok(source.includes("AdminRoleUserType"));
  assert.ok(source.includes("AdminUsersRolesSnapshot"));
  assert.ok(source.includes("ClinicUserRole"));
  assert.ok(source.includes("const USERS_ROLES_FALLBACK_ROWS = 9;"));
  assert.ok(source.includes("const USERS_ROLES_SUPERSET_CAP = 36;"));
});

test("admin users roles card keeps user type role and clinic formatters", () => {
  const source = read(ADMIN_USERS_ROLES_CARD_PATH);

  assert.ok(source.includes("function formatUserType(value: AdminRoleUserType)"));
  assert.ok(source.includes('return value === "admin" ? "Admin" : "Clínica";'));
  assert.ok(source.includes("function formatRole(value: AdminRoleUserRole)"));
  assert.ok(source.includes('if (value === "admin") return "Admin";'));
  assert.ok(source.includes('if (value === "clinic_owner") return "Owner clínica";'));
  assert.ok(source.includes('return "Staff clínica";'));
  assert.ok(source.includes("function formatClinic(user: AdminRoleUserSummary)"));
  assert.ok(source.includes('if (user.userType === "admin") return "—";'));
  assert.ok(source.includes("user.clinicName ? `${user.clinicName} #${user.clinicId}` : `#${user.clinicId}`"));
});

test("admin users roles card keeps variants and role toggle helpers", () => {
  const source = read(ADMIN_USERS_ROLES_CARD_PATH);

  assert.ok(source.includes("function getUserTypeVariant("));
  assert.ok(source.includes('return value === "admin" ? "default" : "secondary";'));
  assert.ok(source.includes("function getRoleVariant("));
  assert.ok(source.includes('if (value === "admin") return "default";'));
  assert.ok(source.includes('if (value === "clinic_owner") return "secondary";'));
  assert.ok(source.includes('return "outline";'));
  assert.ok(source.includes("function getNextClinicRole(role: ClinicUserRole): ClinicUserRole"));
  assert.ok(source.includes('return role === "clinic_owner" ? "clinic_staff" : "clinic_owner";'));
  assert.ok(source.includes("function getUserKey(user: AdminRoleUserSummary)"));
  assert.ok(source.includes("return `${user.userType}-${user.userId}`;"));
});

test("admin users roles card keeps role change error mapping", () => {
  const source = read(ADMIN_USERS_ROLES_CARD_PATH);

  assert.ok(source.includes("function formatRoleChangeError(error: unknown)"));
  assert.ok(source.includes("No se pudo cambiar el rol del usuario."));
  assert.ok(source.includes('message.includes("último clinic_owner")'));
  assert.ok(source.includes('message.includes("ultimo clinic_owner")'));
  assert.ok(source.includes('message.includes("last clinic_owner")'));
  assert.ok(source.includes("No se puede degradar el último Owner clínica."));
  assert.ok(source.includes('message.includes("Usuario de clínica no encontrado")'));
  assert.ok(source.includes("El usuario de clínica ya no existe o no está disponible."));
  assert.ok(source.includes('message.includes("role inválido")'));
  assert.ok(source.includes('message.includes("rol inválido")'));
  assert.ok(source.includes("Solo se permiten Owner clínica y Staff clínica."));
});

test("admin users roles card keeps state for filters pagination role mutation and feedback", () => {
  const source = read(ADMIN_USERS_ROLES_CARD_PATH);

  assert.ok(source.includes("const [snapshot, setSnapshot] = useState<AdminUsersRolesSnapshot | null>(null);"));
  assert.ok(source.includes("const [userType, setUserType] = useState<AdminRoleUserType | \"all\">(\"all\");"));
  assert.ok(source.includes("const [role, setRole] = useState<AdminRoleUserRole | \"all\">(\"all\");"));
  assert.ok(source.includes("const [offset, setOffset] = useState(0);"));
  assert.ok(source.includes("const [error, setError] = useState<string | null>(null);"));
  assert.ok(source.includes("const [roleChangeMessage, setRoleChangeMessage] = useState<string | null>(null);"));
  assert.ok(source.includes("const [changingUserKey, setChangingUserKey] = useState<string | null>(null);"));
  assert.ok(source.includes("const [changedUserKey, setChangedUserKey] = useState<string | null>(null);"));
  assert.ok(source.includes("const [isPending, startTransition] = useTransition();"));
});

test("admin users roles card builds query and disables actions during mutations", () => {
  const source = read(ADMIN_USERS_ROLES_CARD_PATH);

  assert.ok(source.includes("const query = useMemo("));
  assert.ok(source.includes('...(userType !== "all" ? { userType } : {})'));
  assert.ok(source.includes('...(role !== "all" ? { role } : {})'));
  assert.ok(source.includes("limit: effectiveLimit"));
  assert.equal(source.includes("limit: PAGE_SIZE"), false);
  assert.ok(source.includes("useAdaptiveItemsPerPage"));
  assert.ok(source.includes("const effectiveLimit = rowsPerPage;"));
  assert.ok(source.includes("offset"));
  assert.ok(source.includes("[debouncedSearch, effectiveLimit, offset, role, userType]"));
  assert.ok(source.includes("const isMutatingRole = changingUserKey !== null;"));
  assert.ok(source.includes("const disableUserActions = isPending || isMutatingRole;"));
});

test("admin users roles card loads users roles and resets feedback", () => {
  const source = read(ADMIN_USERS_ROLES_CARD_PATH);

  assert.ok(source.includes("function loadUsersRoles()"));
  assert.ok(source.includes("const result = await getAdminUsersRoles(query);"));
  assert.ok(source.includes("setSnapshot(result);"));
  assert.ok(source.includes('"No se pudieron cargar usuarios y roles."'));
  assert.ok(source.includes("function resetFiltersFeedback()"));
  assert.ok(source.includes("setRoleChangeMessage(null);"));
  assert.ok(source.includes("setChangedUserKey(null);"));
  assert.ok(source.includes("useEffect(() => {"));
  assert.ok(source.includes("loadUsersRoles();"));
});

test("admin users roles card changes clinic roles only after confirmation", () => {
  const source = read(ADMIN_USERS_ROLES_CARD_PATH);

  assert.ok(source.includes("async function handleChangeClinicRole("));
  assert.ok(source.includes("if (disableUserActions) {"));
  assert.ok(source.includes("const nextRole = getNextClinicRole(user.role);"));
  assert.ok(source.includes("const confirmed = window.confirm("));
  assert.ok(source.includes("¿Cambiar el rol de"));
  assert.ok(source.includes("if (!confirmed) {"));
  assert.ok(source.includes("const result = await changeAdminClinicUserRole(user.userId, nextRole);"));
  assert.ok(source.includes("current.users.map((entry) =>"));
  assert.ok(source.includes("entry.userType === \"clinic\" && entry.userId === result.user.userId"));
  assert.ok(source.includes("setRoleChangeMessage("));
  assert.ok(source.includes("setError(formatRoleChangeError(err));"));
  assert.ok(source.includes("setChangingUserKey(null);"));
});

test("admin users roles card renders title counters filters and table columns", () => {
  const source = read(ADMIN_USERS_ROLES_CARD_PATH);
  const removedRoleDescription = "Permite cambiar roles de " + "usuarios";
  const removedLockoutDescription = "de clínica con confirmación explícita y bloqueo anti-" + "lockout.";

  assert.ok(source.includes("Usuarios y roles"));
  assert.equal(source.includes(removedRoleDescription), false);
  assert.equal(source.includes(removedLockoutDescription), false);
  assert.ok(source.includes("Total filtrado"));
  assert.ok(source.includes("Admins"));
  assert.ok(source.includes("Clínicas"));
  assert.ok(source.includes("Tipo usuario"));
  assert.ok(source.includes("Rol"));
  assert.ok(source.includes(">Usuario</TableHead>"));
  assert.ok(source.includes(">Tipo</TableHead>"));
  assert.ok(source.includes(">Rol</TableHead>"));
  assert.ok(source.includes(">Clínica</TableHead>"));
  assert.ok(source.includes(">Creado</TableHead>"));
  assert.ok(source.includes(">Actualizado</TableHead>"));
  assert.ok(source.includes(">Acción</TableHead>"));
});

test("admin users roles card renders rows editable clinic actions and admin non-editable state", () => {
  const source = read(ADMIN_USERS_ROLES_CARD_PATH);

  assert.ok(source.includes("users.map((user, index) => {"));
  assert.ok(source.includes("const userKey = getUserKey(user);"));
  assert.ok(source.includes("const isChanging = changingUserKey === userKey;"));
  assert.ok(source.includes("const wasChanged = changedUserKey === userKey;"));
  assert.ok(source.includes('className={wasChanged ? "bg-vetneb-teal/10" : undefined}'));
  assert.ok(source.includes("{user.username}"));
  assert.ok(source.includes("ID {user.userId}"));
  assert.ok(source.includes("Actualizado"));
  assert.ok(source.includes("<AdminUserTypeBadge userType={user.userType} />"));
  assert.ok(source.includes("<AdminRoleBadge role={user.role} />"));
  assert.ok(source.includes("formatClinic(user)"));
  assert.ok(source.includes("formatDateTime(user.createdAt)"));
  assert.ok(source.includes("formatDateTime(user.updatedAt)"));
  assert.ok(source.includes('user.userType === "clinic" ? ('));
  assert.ok(source.includes("onClick={() => void handleChangeClinicRole(user)}"));
  assert.ok(source.includes('isChanging'));
  assert.ok(source.includes("Cambiando..."));
  assert.ok(source.includes("No editable"));
});

test("admin users roles card supports desktop jump-to-page navigation", () => {
  const source = read(ADMIN_USERS_ROLES_CARD_PATH);

  assert.ok(source.includes('const [jumpPageInput, setJumpPageInput] = useState("1");'));
  assert.ok(source.includes("function goToPage(targetPage: number)"));
  assert.ok(
    source.includes(
      "const clampedPage = Math.min(Math.max(targetPage, 1), pageCount);",
    ),
  );
  assert.ok(source.includes("resetFiltersFeedback();"));
  assert.ok(
    source.includes("setOffset((clampedPage - 1) * effectiveLimit);"),
  );
  assert.ok(source.includes("function handleJumpToPage()"));
  assert.ok(
    source.includes("const parsedPage = Number.parseInt(jumpPageInput, 10);"),
  );
  assert.ok(source.includes("if (!Number.isFinite(parsedPage)) {"));
  assert.ok(source.includes("setJumpPageInput(String(page));"));
  assert.ok(source.includes('aria-label="Ir a la página"'));
  assert.ok(source.includes('if (event.key === "Enter") {'));
  assert.ok(source.includes("handleJumpToPage();"));
  assert.ok(source.includes("disabled={disableUserActions || pageCount <= 1}"));
});

test("admin users roles card keeps empty state and pagination without sensitive-field notice", () => {
  const source = read(ADMIN_USERS_ROLES_CARD_PATH);
  const removedUsersRolesEndpoint = "GET " + "/api/admin/users-roles";
  const removedPatchEndpoint = "PATCH " + "/api/admin/users-roles/clinic/:clinicUserId/role";

  assert.ok(source.includes("Cargando usuarios y roles..."));
  assert.ok(source.includes("No hay usuarios para los filtros seleccionados."));
  assert.ok(source.includes("const hasPreviousPage = offset > 0;"));
  assert.ok(source.includes("const hasNextPage = snapshot"));
  assert.ok(source.includes("Anterior"));
  assert.ok(source.includes("Siguiente"));
  assert.equal(source.includes(removedUsersRolesEndpoint), false);
  assert.equal(source.includes(removedPatchEndpoint), false);
  assert.equal(source.includes("Admin users no son editables."), false);
  assert.equal(source.includes("passwordHash"), false);
  assert.equal(source.includes("authProId"), false);
  assert.equal(source.includes("tokens no se"), false);
});
