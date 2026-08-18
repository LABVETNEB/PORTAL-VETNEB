import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const ADMIN_CLINICS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx";
const ADMIN_AUDIT_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminAuditCard.tsx";
const API_CLIENT_PATH = "frontend/src/lib/api.ts";

const SIDEBAR_SECTIONS = [
  {
    label: "Subir informe",
    href: '?module=admin-report-upload',
    anchor: 'id="admin-report-upload"',
  },
  {
    label: "Estado",
    href: '?module=admin-health',
    anchor: 'id="admin-health"',
  },
  {
    label: "Clínicas",
    href: '?module=admin-clinics',
    anchor: 'id="admin-clinics"',
  },
  {
    label: "Tokens particulares",
    href: '?module=admin-particular-tokens',
    anchor: 'id="admin-particular-tokens"',
  },
  {
    label: "Precios",
    href: '?module=admin-pricing',
    anchor: 'id="admin-pricing"',
  },
  {
    label: "Sesiones",
    href: '?module=admin-sessions',
    anchor: 'id="admin-sessions"',
  },
  {
    label: "Roles clínica",
    href: '?module=admin-users-roles',
    anchor: 'id="admin-users-roles"',
  },
  {
    label: "Auditoría",
    href: '?module=audit-log',
    anchor: 'id="audit-log"',
  },
  {
    label: "Mantenimiento",
    href: '?module=admin-maintenance',
    anchor: 'id="admin-maintenance"',
  },
] as const;

test("admin dashboard module sections keep visible anchors mapped", () => {
  const pageSource = read(ADMIN_PAGE_PATH);
  const clinicsCardSource = read(ADMIN_CLINICS_CARD_PATH);
  const auditCardSource = read(ADMIN_AUDIT_CARD_PATH);

  for (const section of SIDEBAR_SECTIONS) {
    const isRenderedInPage = pageSource.includes(section.anchor);
    const isRenderedInClinicsCard =
      section.anchor === 'id="admin-clinics"' &&
      clinicsCardSource.includes(section.anchor);
    const isRenderedInAuditCard =
      section.anchor === 'id="audit-log"' &&
      auditCardSource.includes(section.anchor);

    assert.equal(
      isRenderedInPage || isRenderedInClinicsCard || isRenderedInAuditCard,
      true,
      `anchor ${section.anchor} must be rendered in admin surfaces`,
    );
  }
});

test("admin dashboard visible sections keep operational API endpoints", () => {
  const apiSource = read(API_CLIENT_PATH);

  for (const marker of [
    "uploadAdminReport(",
    '"/api/admin/reports/upload"',
    "getAdminSystemHealth(",
    '"/api/admin/system/health"',
    "getAdminClinics(",
    "createAdminClinicWithUser(",
    "updateAdminClinic(",
    "deleteAdminClinic(",
    "`/api/admin/clinics/${clinicId}`",
    "getAdminParticularTokens(",
    "createAdminParticularToken(",
    "linkAdminParticularTokenReport(",
    "revokeAdminParticularToken(",
    "`/api/admin/particular-tokens/${tokenId}/revoke`",
    "getAdminPricing(",
    "updateAdminPricingItem(",
    '"/api/admin/pricing"',
    "getAdminSessions(",
    "revokeAdminSession(",
    "`/api/admin/sessions/${sessionType}/${sessionId}/revoke`",
    "getAdminUsersRoles(",
    "changeAdminClinicUserRole(",
    "updateAdminClinicUserCredentials(",
    "/api/admin/audit-log",
    "getAdminMaintenancePurgeDryRun(",
    '"/api/admin/system/maintenance/purge-dry-run"',
  ]) {
    assert.ok(
      apiSource.includes(marker),
      `api client must include marker ${marker}`,
    );
  }
});

test("admin UI copy avoids demo/smoke/smock operational language", () => {
  const adminDir = resolve(process.cwd(), "frontend/src/app/dashboard/admin");
  const files = readdirSync(adminDir).filter((name) => name.endsWith(".tsx"));
  const forbidden = [/demo/i, /\bsmock\b/i, /staging-smoke/i];
  const allow = [/smoke test/i];

  for (const fileName of files) {
    const source = read(`frontend/src/app/dashboard/admin/${fileName}`);
    const lines = source.split("\n");

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const isAllowed = allow.some((pattern) => pattern.test(line));

      if (isAllowed) {
        return;
      }

      for (const pattern of forbidden) {
        assert.equal(
          pattern.test(line),
          false,
          `${fileName}:${lineNumber} must not include ${pattern}`,
        );
      }
    });
  }
});
