import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile } from "../helpers/tracked-source-files.ts";

const ADMIN = "frontend/src/app/dashboard/admin";
const PATHS = {
  users: `${ADMIN}/AdminUsersRolesReadOnlyCard.tsx`,
  usersDetail: `${ADMIN}/AdminUserRoleDetailDialog.tsx`,
  sessions: `${ADMIN}/AdminSessionsReadOnlyCard.tsx`,
  failed: `${ADMIN}/AdminFailedLoginAlertsReadOnlyCard.tsx`,
  failedDetail: `${ADMIN}/AdminFailedLoginDetailDialog.tsx`,
} as const;
type Sources = Record<keyof typeof PATHS, string>;

const read = (): Sources =>
  Object.fromEntries(Object.entries(PATHS).map(([key, path]) => [key, readSourceFile(path)])) as Sources;

function c19Violations(s: Sources): string[] {
  const violations: string[] = [];
  const need = (key: keyof Sources, pattern: RegExp | string, why: string) => {
    const ok = typeof pattern === "string" ? s[key].includes(pattern) : pattern.test(s[key]);
    if (!ok) violations.push(`${key}: ${why}`);
  };
  const forbid = (key: keyof Sources, pattern: RegExp | string, why: string) => {
    const hit = typeof pattern === "string" ? s[key].includes(pattern) : pattern.test(s[key]);
    if (hit) violations.push(`${key}: ${why}`);
  };

  // Shared C01/C03 grammar of the three read-only collections; the measured canvases stay the owners.
  for (const key of ["users", "sessions", "failed"] as const) {
    need(key, /<CollectionWorkspace\s+ref=\{setDesktopBodyNode\}(?:\s+data-admin-sesiones-list-body="true")?\s+data-dashboard-adaptive-rows-canvas="true"\s+data-dashboard-row-pitch="compact"\s+data-dashboard-canvas-reserve="table-head-dense"/, "the measured desktop canvas is the CollectionWorkspace with its dense head reserve");
    need(key, /<CollectionHeader>\s*<ContentListItem as="tr">/, "the header row is a C01 header item");
    need(key, '<ContentList as="tbody">', "desktop rows are the C01 list");
    need(key, /<ContentListItem\s+as="tr"\s+key=\{/, "desktop rows are C01 items");
    need(key, /<ContentListItem\s+as="article"\s+key=\{/, "mobile rows are C01 items");
    need(key, /<CollectionState\s+variant="loading"/, "loading goes through C03");
    need(key, /<CollectionState\s+variant="empty"/, "empty goes through C03");
    need(key, "<AdminMobileOpsPager", "the mobile pager is unchanged");
    forbid(key, /<(?:TableHeader|TableBody|TableRow|EmptyState|LoadingState)\b/, "legacy table sections and state adapters replaced by C01/C03");
    forbid(key, /<(?:CollectionPager|SuperSearchField|ActiveFilterChips|AdvancedFilterSheet|SelectionToolbar|BulkActionMenu)\b|useCollectionSelection|aria-sort/, "C19 adds no pager/search geometry, filters, sorting or selection without a server capability");
  }
  need("users", '<ContentList as="div" className="contents divide-y divide-vetneb-line/70">', "the mobile list keeps its row dividers (pitch)");
  need("sessions", '<ContentList as="div" className="contents divide-y divide-vetneb-line/70">', "the mobile list keeps its row dividers (pitch)");
  need("failed", '<ContentList as="div" className="contents divide-y divide-vetneb-line/60">', "the mobile list keeps its row dividers (pitch)");

  // Usuarios: server window, filters and the audited role change are untouched.
  need("users", "const effectiveLimit = rowsPerPage;", "server limit owner unchanged");
  need("users", "limit: effectiveLimit,\n      offset,", "limit/offset request unchanged");
  need("users", "...(debouncedSearch ? { search: debouncedSearch } : {}),", "debounced search request unchanged");
  need("users", "await changeAdminClinicUserRole(user.userId, nextRole);", "role change operation preserved");
  need("users", "window.confirm(", "role change keeps its confirmation");
  need("users", 'aria-label="Paginación de usuarios y roles"', "the labelled desktop pager stays");
  need("users", 'aria-label="Tabla de usuarios y roles administrativos"', "the table keeps its accessible name");

  // Sesiones: revocation guard of the current admin session and the error alert grammar.
  need("sessions", "const isCurrentAdminSession =", "current admin session is detected");
  if ((s.sessions.match(/disabled=\{isRevoking \|\| isCurrentAdminSession\}/g) ?? []).length !== 2) {
    violations.push("sessions: the current admin session can never be revoked, on desktop and mobile");
  }
  need("sessions", "void handleRevokeSession(session)", "revocation operation preserved");
  need("sessions", '<div className="clinical-alert-error mx-3 sm:mx-4" role="alert">', "the desktop load error keeps the alert the A02 matrix detects");
  need("sessions", 'aria-label="Paginación de sesiones"', "the labelled desktop pager stays");
  forbid("sessions", /sessionToken|tokenHash|cookie/i, "no session secret reaches the surface");

  // Intentos fallidos: filters, CSV export and the touch pager reservation are untouched.
  need("failed", "buildAdminFailedLoginAlertsCsvUrl(", "CSV export preserved");
  need("failed", "style={DASHBOARD_TOUCH_PAGER_RESERVATION}", "pager reservation unchanged");
  need("failed", '"No se pudieron cargar los intentos fallidos."', "load failure copy preserved");

  // Detail dialogs: C13 composition of the same safe, read-only fields.
  need("usersDetail", /<DetailsPane label=\{`Detalle del usuario \$\{user\.userId\}`\}>[\s\S]*?<DetailsMetadata/, "detail composes C13");
  for (const field of ["user.username", "clinicLabel", "clinicMetadata", "userTypeLabel", "roleLabel", "user.createdAt", "user.updatedAt"]) {
    need("usersDetail", `${field}`, `field kept: ${field}`);
  }
  forbid("usersDetail", /<dl\b|handleChangeClinicRole|onChange|<input|<select/, "read-only C13 surface replaces the ad hoc list");
  need("failedDetail", /<DetailsPane label=\{`Detalle del intento fallido \$\{alert\.id\}`\}>[\s\S]*?<DetailsMetadata/, "detail composes C13");
  for (const field of ["surfaceLabel", "alert.createdAt", "alert.username", "reasonLabel", "alert.ipAddress", "alert.userAgent"]) {
    need("failedDetail", field, `safe field kept: ${field}`);
  }
  forbid("failedDetail", /<dl\b|password|cookie=|sessionId/i, "no credential or session field and no ad hoc list");
  return violations;
}

test("C19 migrates Usuarios, Sesiones and Intentos fallidos to the shared primitives without moving operations or geometry", () => {
  assert.deepEqual(c19Violations(read()), []);
});

test("C19 guard rejects reverting each module to its pre-C19 grammar", () => {
  const sources = read();
  const mutants: ReadonlyArray<readonly [keyof Sources, string, string]> = [
    ["users", "<CollectionWorkspace\n          ref={setDesktopBodyNode}", "<div\n          ref={setDesktopBodyNode}"],
    ["users", '<ContentList as="div" className="contents divide-y divide-vetneb-line/70">', '<ContentList as="div">'],
    ["users", "const effectiveLimit = rowsPerPage;", "const effectiveLimit = 9;"],
    ["users", "window.confirm(", "Boolean("],
    ["sessions", "disabled={isRevoking || isCurrentAdminSession}\n                            aria-busy", "disabled={isRevoking}\n                            aria-busy"],
    ["sessions", '<CollectionState\n              variant="empty"\n              title="Sin sesiones"\n              description=', '<EmptyState\n              title="Sin sesiones"\n              description='],
    ["sessions", '<div className="clinical-alert-error mx-3 sm:mx-4" role="alert">', '<div role="alert">'],
    ["failed", "<CollectionHeader>", "<TableHeader>"],
    ["failed", '<ContentList as="div" className="contents divide-y divide-vetneb-line/60">', '<ContentList as="div">'],
    ["failed", "style={DASHBOARD_TOUCH_PAGER_RESERVATION}", "style={undefined}"],
    ["usersDetail", "<DetailsPane", "<section"],
    ["failedDetail", "value: alert.userAgent", "value: null"],
  ];
  for (const [key, anchor, replacement] of mutants) {
    const at = sources[key].indexOf(anchor);
    assert.ok(at >= 0 && at === sources[key].lastIndexOf(anchor), `unique ${key} anchor: ${anchor}`);
    const mutated = sources[key].replace(anchor, () => replacement);
    assert.notEqual(mutated, sources[key]);
    assert.notDeepEqual(c19Violations({ ...sources, [key]: mutated }), [], `mutation must be rejected: ${key} ${anchor}`);
  }
});
