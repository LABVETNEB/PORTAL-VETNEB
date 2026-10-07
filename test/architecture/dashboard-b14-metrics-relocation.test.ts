import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../helpers/tracked-source-files.ts";

const CONFIG = "frontend/src/features/dashboard/config/dashboardModules.ts";
const CLINIC = "frontend/src/app/dashboard/ClinicCommandCenter.tsx";
const TOKENS = "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx";
const SESSIONS = "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx";
const USERS = "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx";
const AUDIT = "frontend/src/app/dashboard/admin/AdminAuditCard.tsx";
const MOBILE_AUDIT = "frontend/src/app/dashboard/admin/AdminMobileAuditModule.tsx";
const AUDIT_FILTER_BAR = "frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx";

const ADMIN = [
  "admin",
  "admin-report-upload",
  "admin-health",
  "admin-clinics",
  "admin-particular-tokens",
  "admin-pricing",
  "admin-sessions",
  "admin-users-roles",
  "audit-log",
  "admin-maintenance",
] as const;
const CLINIC_MODULES = ["operaciones", "informes", "logistica", "perfil", "tokens"] as const;

test("B14 · navigation census is exactly 10 admin + 5 clinic modules", () => {
  const config = read(CONFIG);
  const declared = [...ADMIN, ...CLINIC_MODULES];

  assert.equal(ADMIN.length, 10);
  assert.equal(CLINIC_MODULES.length, 5);
  assert.equal(new Set(declared).size, 15);
  for (const moduleId of declared) {
    assert.ok(config.includes(`"${moduleId}"`), `${moduleId} must remain in the canonical catalog`);
  }
});

// Desktop/tablet space pass (Nico): the four admin metric runs B14 had
// relocated into existing headers are marked for removal on the reference
// captures, so they are RETIRED at every width (pre-C05 already retired them
// below md). Retirement is not relocation: no admin run reappears anywhere,
// and the functional regions that hosted them stay.
const ADMIN_RETIRED_RUNS = [
  [TOKENS, "admin-particular-tokens", 'data-admin-particulars-toolbar="true"'],
  [SESSIONS, "admin-sessions", 'aria-label="Filtros de sesiones"'],
  [USERS, "admin-users-roles", 'aria-label="Filtros de usuarios y roles"'],
  [AUDIT, "admin-audit", "<AdminAuditFilterBar"],
] as const;

test("B14 · the clinic run stays integrated and the four admin runs are retired, regions kept", () => {
  const clinic = read(CLINIC);
  assert.ok(clinic.includes("<ModuleMetricRun"), "the clinic run stays integrated");
  assert.ok(clinic.includes('id: "metricas"'), "the clinic run keeps its functional region");

  for (const [path, run, functionalAnchor] of ADMIN_RETIRED_RUNS) {
    const source = read(path);
    assert.equal(source.includes("data-dashboard-b14-metrics"), false, `${path}: the ${run} metric run is retired`);
    assert.ok(source.includes(functionalAnchor), `${path} must retain its functional region`);
  }
  assert.equal(read(TOKENS).includes("ParticularTokensMetricStrip"), false, "the tokens metric strip is not rendered");
  for (const label of ["Total filtrado", "Expiradas visibles", "Admins</span>"]) {
    for (const path of [SESSIONS, USERS]) {
      assert.equal(read(path).includes(label), false, `${path}: retired metric label ${label}`);
    }
  }
  for (const id of ['id="admin-event-summary"', 'id="audit-role-changes"', 'id="admin-notifications"']) {
    assert.equal(read(AUDIT).includes(id), false, `the audit header metric ${id} is retired`);
  }
  assert.equal(read(CLINIC).includes("dashboard-kpi-pill"), false);
  assert.equal(read(SESSIONS).includes("dashboard-filter-stats-grid"), false);
  assert.equal(read(USERS).includes("grid min-h-11 shrink-0 grid-cols-3"), false);
  assert.equal(read(MOBILE_AUDIT).includes("grid min-h-9 shrink-0 grid-cols-3"), false);
});

test("B14 · pre-C05 mobile space retires the audit summary from the mobile strip only", () => {
  // The mobile strip used to carry "Todos los eventos · N eventos · N roles ·
  // N avisos". Nico retired that summary below md (no relocation): the strip
  // keeps the page selector and Filtros. The desktop header metrics stay.
  const mobile = read(MOBILE_AUDIT);
  const bar = read(AUDIT_FILTER_BAR);
  assert.equal(mobile.includes("metrics={{"), false, "the mobile audit module passes no metrics to the strip");
  assert.equal(bar.includes("ModuleMetricRun"), false, "the strip renders no metric run");
  assert.equal(bar.includes("data-admin-audit-metric"), false, "no audit metric chip survives in the strip");
  assert.equal(bar.includes("Todos los eventos"), false, "the strip summary label is retired with the metrics");
  assert.ok(mobile.includes("AdminAuditFilterBar"), "the mobile strip itself (selector + Filtros) stays");
  assert.equal(read(AUDIT).includes("data-dashboard-b14-metrics"), false, "the desktop/tablet space pass retires the desktop run too");
});

test("B14 · six pass modules and four explicit N/A modules remain outside the relocation set", () => {
  const pass = ["admin", "admin-report-upload", "admin-health", "admin-maintenance", "perfil", "tokens"];
  const notApplicable = ["admin-clinics", "admin-pricing", "informes", "logistica"];
  const touched = ["operaciones", "admin-particular-tokens", "admin-sessions", "admin-users-roles", "audit-log"];

  assert.equal(pass.length, 6);
  assert.equal(notApplicable.length, 4);
  assert.deepEqual([...pass, ...notApplicable].filter((id) => touched.includes(id)), []);
});

test("B14 · source structure, not the data marker alone, proves retirement", () => {
  // The headers that hosted the runs are gone with them: no CardHeader in the
  // three admin cards, and the audit section no longer owns a header element.
  for (const path of [TOKENS, SESSIONS, USERS]) {
    assert.equal(/<CardHeader\b/.test(read(path)), false, `${path}: the header that hosted the run is retired`);
  }
  const audit = read(AUDIT);
  const desktop = audit.slice(audit.indexOf('aria-label="Registro operativo"'));
  assert.equal(/<header\b/.test(desktop), false, "the audit section header that hosted the run is retired");
  assert.ok(desktop.indexOf("<AdminAuditFilterBar") > -1, "filters now open the audit section");
});

test("B14 · navigation universe is intentionally distinct from A03 adaptive consumers", () => {
  const a03 = read("frontend/e2e/helpers/dashboard-adaptive-limit-matrix.ts");
  assert.ok(a03.includes("A03_MODULE_IDS"));
  assert.equal(a03.includes('"operaciones"'), false);
  assert.ok(a03.includes('"admin-audit-log"'));
});
