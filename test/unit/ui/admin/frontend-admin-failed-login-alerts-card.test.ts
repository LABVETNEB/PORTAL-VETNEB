import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx";
const ADMIN_MOBILE_COMMAND_MODULE_PATH =
  "frontend/src/app/dashboard/admin/AdminMobileCommandModule.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("admin failed login alerts card is client-side and imports required dependencies", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import { Badge } from "@/components/ui/badge";'));
  assert.ok(source.includes('import { Button } from "@/components/ui/button";'));
  assert.ok(source.includes('import { PublicExternalControl } from "@/components/public/PublicRouteControl";'));
  assert.ok(source.includes("buildAdminFailedLoginAlertsCsvUrl"));
  assert.ok(source.includes("getAdminFailedLoginAlerts"));
  assert.ok(source.includes('import { formatDateTime } from "@/lib/utils";'));
  assert.ok(source.includes('import { AdminMobileOpsPager } from "./AdminMobileOpsPager";'));
});

test("admin failed login alerts card keeps PAGE_SIZE only as fallback, not as the direct limit", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("const FAILED_LOGIN_FALLBACK_ROWS = 5;"));
  assert.ok(source.includes("fallbackItems: FAILED_LOGIN_FALLBACK_ROWS,"));
  assert.equal(source.includes("const PAGE_SIZE = 5;"), false);
  assert.equal(source.includes("limit: PAGE_SIZE"), false);
});

test("admin failed login alerts card bounds the re-fetch limit at 25", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("const FAILED_LOGIN_LIMIT_CAP = 25;"));
  assert.ok(source.includes("maxItems: FAILED_LOGIN_LIMIT_CAP,"));
});

test("admin failed login alerts card derives the effective limit from the adaptive hook", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(
    source.includes(
      'import { useDashboardCanvasCapacity } from "@/hooks/useDashboardCanvasCapacity";',
    ),
  );
  assert.ok(source.includes("useDashboardCanvasCapacity({"));
  assert.ok(source.includes("const effectiveLimit = rowsPerPage;"));
  assert.ok(source.includes("limit: effectiveLimit,"));
  assert.ok(source.includes("[effectiveLimit, offset, reason, surface]"));
});

test("admin failed login alerts card measures a real rows container per presentation", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("canvasNode: mobileBodyNode,"));
  assert.ok(source.includes("canvasNode: desktopBodyNode,"));
  assert.ok(source.includes('data-dashboard-canvas-reserve="table-head-dense"'));
  assert.ok(source.includes('data-dashboard-row-pitch="regular"'));
  assert.equal(source.includes("setDesktopRowNode"), false);
  assert.equal(source.includes("setMobileRowNode"), false);
  assert.ok(source.includes("ref={setDesktopBodyNode}"));
  assert.ok(source.includes("ref={setMobileBodyNode}"));
});

test("admin failed login alerts card recomputes offset when the limit changes and clamps to total", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(
    source.includes(
      "let nextOffset = Math.floor(currentOffset / effectiveLimit) * effectiveLimit;",
    ),
  );
  assert.ok(source.includes("const total = snapshotRef.current?.total;"));
  assert.ok(
    source.includes(
      "(Math.ceil(total / effectiveLimit) - 1) * effectiveLimit,",
    ),
  );
  assert.ok(source.includes("nextOffset = Math.min(nextOffset, lastValidOffset);"));
});

test("admin failed login alerts card guards concurrent fetches with a request id", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("const latestRequestRef = useRef(0);"));
  assert.ok(source.includes("const requestId = latestRequestRef.current + 1;"));
  assert.ok(source.includes("latestRequestRef.current = requestId;"));
  assert.ok(source.includes("if (requestId !== latestRequestRef.current) return;"));
});

test("admin failed login alerts card pages by the effective limit, not a fixed size", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("const page = Math.floor(offset / effectiveLimit) + 1;"));
  assert.ok(
    source.includes(
      "Math.max(1, Math.ceil(snapshot.total / effectiveLimit))",
    ),
  );
  assert.ok(source.includes("setOffset(Math.max(offset - effectiveLimit, 0));"));
  assert.ok(source.includes("setOffset(offset + effectiveLimit);"));
});

test("admin failed login alerts card no longer uses matchMedia or a mobile page size", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.equal(source.includes("matchMedia"), false);
  assert.equal(source.includes("MOBILE_PAGE_SIZE"), false);
  assert.equal(source.includes("FAILED_LOGIN_PAGE_SIZE"), false);
  assert.equal(source.includes("isDesktopViewport"), false);
  assert.equal(source.includes("isMobileViewport"), false);
});

test("admin failed login alerts card collapses the mobile duality into a single runtime", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);
  const commandModule = read(ADMIN_MOBILE_COMMAND_MODULE_PATH);

  // Desktop Card precedes the mobile section in the DOM (unscoped `.first()`
  // desktop locators must resolve against the desktop node).
  const desktopIndex = source.indexOf('id="failed-login-alerts"');
  const mobileIndex = source.indexOf('data-admin-mobile-status-item="true"');
  assert.ok(desktopIndex >= 0);
  assert.ok(mobileIndex > desktopIndex);
  assert.ok(source.includes("hidden min-h-0 flex-1 flex-col overflow-hidden md:flex"));
  assert.ok(source.includes("md:hidden"));
  assert.ok(source.includes('ariaLabel="Paginación de intentos fallidos"'));

  // The presentation prop is a static per-mount signal, never matchMedia.
  assert.ok(source.includes('presentation?: "responsive" | "mobile";'));
  assert.ok(source.includes('presentation = "responsive",'));

  // The command module keeps no failed-login data source of its own.
  assert.equal(commandModule.includes("getAdminFailedLoginAlerts"), false);
  assert.equal(commandModule.includes("FAILED_LOGIN_PAGE_SIZE"), false);
  assert.equal(commandModule.includes("matchMedia"), false);
  assert.equal(commandModule.includes("AdminMobileFailedLoginSection"), false);
  assert.ok(
    commandModule.includes(
      '<AdminFailedLoginAlertsReadOnlyCard presentation="mobile" />',
    ),
  );
});

test("admin failed login alerts card keeps surface reason and nullable formatters", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("function formatSurface(value: AdminFailedLoginAlertSurface)"));
  assert.ok(source.includes('if (value === "admin") return "Admin";'));
  assert.ok(source.includes('if (value === "clinic") return "Clínica";'));
  assert.ok(source.includes('return "Particular";'));
  assert.ok(source.includes("function formatReason(value: AdminFailedLoginAlertReason)"));
  assert.ok(source.includes('if (value === "missing_credentials") return "Credenciales faltantes";'));
  assert.ok(source.includes('if (value === "invalid_credentials") return "Credenciales inválidas";'));
  assert.ok(source.includes('return "Bloqueo temporal";'));
  assert.ok(source.includes("function formatNullable(value: string | null)"));
  assert.ok(source.includes('return value && value.trim() ? value : "—";'));
});

test("admin failed login alerts card keeps badge variants for surfaces and reasons", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("function getSurfaceVariant("));
  assert.ok(source.includes('if (value === "admin") return "default";'));
  assert.ok(source.includes('if (value === "clinic") return "secondary";'));
  assert.ok(source.includes('return "outline";'));
  assert.ok(source.includes("function getReasonVariant("));
  assert.ok(source.includes('if (value === "rate_limited") return "secondary";'));
  assert.ok(source.includes('if (value === "invalid_credentials") return "secondary";'));
});

test("admin failed login alerts card keeps state for filters pagination and errors", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("useState<AdminFailedLoginAlertsSnapshot | null>(null);"));
  assert.ok(source.includes("const [surface, setSurface] = useState<"));
  assert.ok(source.includes("AdminFailedLoginAlertSurface | \"all\""));
  assert.ok(source.includes("const [reason, setReason] = useState<AdminFailedLoginAlertReason | \"all\">("));
  assert.ok(source.includes("const [offset, setOffset] = useState(0);"));
  assert.ok(source.includes("const [error, setError] = useState<string | null>(null);"));
  assert.ok(source.includes("const [isPending, startTransition] = useTransition();"));
});

test("admin failed login alerts card builds API query and CSV URL from filters", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("const query = useMemo("));
  assert.ok(source.includes('...(surface !== "all" ? { surface } : {})'));
  assert.ok(source.includes('...(reason !== "all" ? { reason } : {})'));
  assert.ok(source.includes("const csvUrl = useMemo("));
  assert.ok(source.includes("buildAdminFailedLoginAlertsCsvUrl({"));
  assert.ok(source.includes("[reason, surface]"));
});

test("admin failed login alerts card keeps reversible filters and load behavior", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("function clearFailedLoginAlertFilters()"));
  assert.ok(source.includes('setSurface("all");'));
  assert.ok(source.includes('setReason("all");'));
  assert.ok(source.includes("setOffset(0);"));
  assert.ok(source.includes("function loadFailedLoginAlerts()"));
  assert.ok(source.includes("const result = await getAdminFailedLoginAlerts(query);"));
  assert.ok(source.includes("setSnapshot(result);"));
  assert.ok(source.includes('"No se pudieron cargar los intentos fallidos."'));
  assert.ok(source.includes("useEffect(() => {"));
  assert.ok(source.includes("loadFailedLoginAlerts();"));
});

test("admin failed login alerts filters reset offset to zero on change", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  // Both selects plus the clear-filters handler reset the offset.
  const resetCount = source.split("setOffset(0);").length - 1;
  assert.ok(resetCount >= 3, `expected filter handlers to reset offset, got ${resetCount}`);
});

test("admin failed login alerts card renders header and actions without technical copy", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);
  const removedReadOnlyCopy = "Vista Admin read-" + "only";

  assert.ok(source.includes('id="failed-login-alerts"'));
  assert.ok(source.includes("Intentos fallidos de login"));
  assert.ok(source.includes("Limpiar filtros"));
  assert.ok(source.includes("<PublicExternalControl"));
  assert.ok(source.includes("href={csvUrl}"));
  assert.ok(source.includes('target="_self"'));
  assert.ok(source.includes("Exportar CSV"));
  assert.ok(source.includes('isPending ? "Actualizando..." : "Actualizar"'));
  assert.equal(source.includes(removedReadOnlyCopy), false);
  assert.equal(source.includes("passwords, tokens, hashes ni cookies."), false);
});

test("admin failed login alerts card renders filters table columns and rows", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  assert.ok(source.includes("Total filtrado"));
  assert.ok(source.includes("Superficie"));
  assert.ok(source.includes("Motivo"));
  assert.ok(source.includes("Página"));
  assert.ok(source.includes("<TableHead>ID</TableHead>"));
  assert.ok(source.includes("<TableHead>Superficie</TableHead>"));
  assert.ok(source.includes("<TableHead>Usuario</TableHead>"));
  assert.ok(source.includes("<TableHead>Motivo</TableHead>"));
  assert.ok(source.includes("<TableHead>IP</TableHead>"));
  assert.ok(source.includes("<TableHead>User agent</TableHead>"));
  assert.ok(source.includes("<TableHead>Fecha</TableHead>"));
  assert.ok(source.includes("snapshot.failedLoginAlerts.map((alert, index) =>"));
  assert.ok(source.includes("formatSurface(alert.surface)"));
  assert.ok(source.includes("formatReason(alert.reason)"));
  assert.ok(source.includes("formatNullable(alert.username)"));
  assert.ok(source.includes("formatNullable(alert.ipAddress)"));
  assert.ok(source.includes("formatNullable(alert.userAgent)"));
  assert.ok(source.includes("formatDateTime(alert.createdAt)"));
});

test("admin failed login alerts card keeps empty state and pagination without endpoint copy", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);
  const removedAlertsEndpoint = "GET " + "/api/admin/failed-login-alerts";
  const removedAlertsCsvEndpoint = "GET " + "/api/admin/failed-login-alerts/export.csv";
  const removedReadOnlyFilters = "read-" + "only con filtros reversibles";

  assert.ok(source.includes("isPending ?"));
  assert.ok(source.includes("LoadingState"));
  assert.ok(source.includes('"No se pudieron cargar los intentos fallidos."'));
  assert.ok(source.includes("No hay intentos fallidos para los filtros seleccionados."));
  assert.ok(source.includes("const hasPreviousPage = offset > 0;"));
  assert.ok(source.includes("const hasNextPage = snapshot"));
  assert.ok(source.includes("Anterior"));
  assert.ok(source.includes("Siguiente"));
  assert.equal(source.includes(removedAlertsEndpoint), false);
  assert.equal(source.includes(removedAlertsCsvEndpoint), false);
  assert.equal(source.includes(removedReadOnlyFilters), false);
  assert.equal(source.includes("no bloquea usuarios, no revoca sesiones y no dispara notificaciones."), false);
});

test("admin failed login alerts card does not leak secrets or widen the network surface", () => {
  const source = read(ADMIN_FAILED_LOGIN_ALERTS_CARD_PATH);

  for (const forbidden of [
    "sessionToken",
    "tokenHash",
    "password",
    "cookie",
    "fetch(",
    "console.log",
    "console.info",
    "dangerouslySetInnerHTML",
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden marker: ${forbidden}`);
  }
});
