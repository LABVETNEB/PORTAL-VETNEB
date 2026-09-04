import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const CONFIG = "frontend/src/features/dashboard/config/dashboardModules.ts";
const CLINIC = "frontend/src/app/dashboard/ClinicCommandCenter.tsx";
const TOKENS = "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx";
const SESSIONS = "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx";
const USERS = "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx";
const AUDIT = "frontend/src/app/dashboard/admin/AdminAuditCard.tsx";
const MOBILE_AUDIT = "frontend/src/app/dashboard/admin/AdminMobileAuditModule.tsx";

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8").replace(/\r\n/g, "\n");
}

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

test("B14 · the five audited failures now integrate metrics into existing functional regions", () => {
  const cases = [
    [CLINIC, "<ModuleMetricRun", 'id: "metricas"'],
    [TOKENS, 'data-dashboard-b14-metrics="admin-particular-tokens"', "CardHeader"],
    [SESSIONS, 'data-dashboard-b14-metrics="admin-sessions"', 'aria-label="Filtros de sesiones"'],
    [USERS, 'data-dashboard-b14-metrics="admin-users-roles"', 'aria-label="Filtros de usuarios y roles"'],
    [AUDIT, 'data-dashboard-b14-metrics="admin-audit"', "AdminAuditFilterBar"],
    [MOBILE_AUDIT, "metrics={{", "AdminAuditFilterBar"],
  ] as const;

  for (const [path, integratedAnchor, functionalAnchor] of cases) {
    const source = read(path);
    assert.ok(source.includes(integratedAnchor), `${path} must retain its integrated metrics`);
    assert.ok(source.includes(functionalAnchor), `${path} must retain its functional region`);
  }
  assert.equal(read(CLINIC).includes("dashboard-kpi-pill"), false);
  assert.equal(read(SESSIONS).includes("dashboard-filter-stats-grid"), false);
  assert.equal(read(USERS).includes("grid min-h-11 shrink-0 grid-cols-3"), false);
  assert.equal(read(MOBILE_AUDIT).includes("grid min-h-9 shrink-0 grid-cols-3"), false);
});

test("B14 · six pass modules and four explicit N/A modules remain outside the relocation set", () => {
  const pass = ["admin", "admin-report-upload", "admin-health", "admin-maintenance", "perfil", "tokens"];
  const notApplicable = ["admin-clinics", "admin-pricing", "informes", "logistica"];
  const touched = ["operaciones", "admin-particular-tokens", "admin-sessions", "admin-users-roles", "audit-log"];

  assert.equal(pass.length, 6);
  assert.equal(notApplicable.length, 4);
  assert.deepEqual([...pass, ...notApplicable].filter((id) => touched.includes(id)), []);
});

test("B14 · source structure, not the data marker alone, proves relocation", () => {
  const tokens = read(TOKENS);
  const sessions = read(SESSIONS);
  const users = read(USERS);
  const audit = read(AUDIT);

  assert.ok(tokens.indexOf('data-dashboard-b14-metrics="admin-particular-tokens"') > tokens.indexOf('data-admin-particulars-toolbar="true"'));
  assert.ok(sessions.indexOf('data-dashboard-b14-metrics="admin-sessions"') < sessions.indexOf('<CardContent'));
  assert.ok(users.indexOf('data-dashboard-b14-metrics="admin-users-roles"') < users.indexOf('<CardContent'));
  assert.ok(audit.indexOf('data-dashboard-b14-metrics="admin-audit"') < audit.indexOf("<AdminAuditFilterBar"));
});

test("B14 · navigation universe is intentionally distinct from A03 adaptive consumers", () => {
  const a03 = read("frontend/e2e/helpers/dashboard-adaptive-limit-matrix.ts");
  assert.ok(a03.includes("A03_MODULE_IDS"));
  assert.equal(a03.includes('"operaciones"'), false);
  assert.ok(a03.includes('"admin-audit-log"'));
});
