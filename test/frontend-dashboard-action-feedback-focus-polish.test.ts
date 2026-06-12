import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const BUTTON_PATH = "frontend/src/components/ui/button.tsx";
const GLOBALS_CSS_PATH = "frontend/src/app/globals.css";
const ADMIN_CLINICS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx";
const ADMIN_FAILED_LOGINS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx";
const ADMIN_SESSIONS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx";
const ADMIN_SCHEMA_HEALTH_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminSchemaHealthStatusCard.tsx";
const ADMIN_USERS_ROLES_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx";
const ADMIN_MAINTENANCE_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx";
const ADMIN_PRICING_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx";
const ADMIN_PARTICULAR_TOKENS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx";
const UPLOAD_REPORT_MODAL_PATH =
  "frontend/src/components/dashboard/UploadReportModal.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

// ── Button base ──────────────────────────────────────────────────────────────

test("PR-4 button base class includes active:scale-[0.98] for press feedback", () => {
  const source = read(BUTTON_PATH);
  assert.ok(
    source.includes("active:scale-[0.98]"),
    "button.tsx must include active:scale-[0.98] in base variant",
  );
});

test("PR-4 button base class transitions include transform", () => {
  const source = read(BUTTON_PATH);
  assert.ok(
    source.includes("transition-[background-color,border-color,box-shadow,color,transform]"),
    "button.tsx must animate transform in transition property",
  );
});

test("PR-4 button base class keeps focus-visible and disabled contracts unchanged", () => {
  const source = read(BUTTON_PATH);
  assert.ok(source.includes("focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"));
  assert.ok(source.includes("disabled:pointer-events-none disabled:opacity-55"));
});

// ── globals.css ──────────────────────────────────────────────────────────────

test("PR-4 globals.css has dashboard-action-feedback-focus-polish section delimiters", () => {
  const source = read(GLOBALS_CSS_PATH);
  assert.ok(
    source.includes("/* dashboard-action-feedback-focus-polish:start */"),
    "globals.css must have dashboard-action-feedback-focus-polish:start",
  );
  assert.ok(
    source.includes("/* dashboard-action-feedback-focus-polish:end */"),
    "globals.css must have dashboard-action-feedback-focus-polish:end",
  );
});

test("PR-4 globals.css aria-busy button gets cursor-wait", () => {
  const source = read(GLOBALS_CSS_PATH);
  assert.ok(
    source.includes('button[aria-busy="true"]'),
    "globals.css must target button[aria-busy=true]",
  );
  assert.ok(
    source.includes("cursor: wait;"),
    "globals.css must apply cursor: wait to aria-busy buttons",
  );
});

test("PR-4 globals.css defines dashboard-option-row for listbox focus", () => {
  const source = read(GLOBALS_CSS_PATH);
  assert.ok(
    source.includes(".dashboard-option-row"),
    "globals.css must define .dashboard-option-row",
  );
  assert.ok(source.includes("focus-visible:ring-2"));
});

// ── aria-busy on loading admin buttons ──────────────────────────────────────

test("PR-4 AdminClinicsManagementCard Actualizar button has aria-busy when loading", () => {
  const source = read(ADMIN_CLINICS_CARD_PATH);
  assert.ok(source.includes("aria-busy={isPending ? true : undefined}"));
  assert.ok(source.includes('import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, RefreshCw, Search } from "lucide-react";'));
});

test("PR-4 AdminFailedLoginAlertsReadOnlyCard Actualizar button has aria-busy and spinner", () => {
  const source = read(ADMIN_FAILED_LOGINS_CARD_PATH);
  assert.ok(source.includes("aria-busy={isPending ? true : undefined}"));
  assert.ok(source.includes('import { Loader2 } from "lucide-react";'));
  assert.ok(source.includes('isPending ? "Actualizando..." : "Actualizar"'));
});

test("PR-4 AdminSessionsReadOnlyCard Actualizar button has aria-busy and spinner", () => {
  const source = read(ADMIN_SESSIONS_CARD_PATH);
  assert.ok(source.includes("aria-busy={isPending ? true : undefined}"));
  assert.ok(source.includes('import { Loader2 } from "lucide-react";'));
  assert.ok(source.includes('"Revocando..."'));
  assert.ok(source.includes('"Revocar"'));
});

test("PR-4 AdminSessionsReadOnlyCard Revocar button has aria-busy for revocation state", () => {
  const source = read(ADMIN_SESSIONS_CARD_PATH);
  assert.ok(source.includes("aria-busy={isRevoking ? true : undefined}"));
  assert.ok(source.includes("disabled={isRevoking || isCurrentAdminSession}"));
});

test("PR-4 AdminSchemaHealthStatusCard Reintentar button has aria-busy and spinner", () => {
  const source = read(ADMIN_SCHEMA_HEALTH_CARD_PATH);
  assert.ok(source.includes("aria-busy={isPending ? true : undefined}"));
  assert.ok(source.includes('import { Loader2 } from "lucide-react";'));
});

test("PR-4 AdminUsersRolesReadOnlyCard Actualizar button has aria-busy and spinner", () => {
  const source = read(ADMIN_USERS_ROLES_CARD_PATH);
  assert.ok(source.includes("aria-busy={isPending ? true : undefined}"));
  assert.ok(source.includes('import { Loader2 } from "lucide-react";'));
  assert.ok(source.includes('"Actualizando..."'));
});

test("PR-4 AdminMaintenanceDryRunCard Analizar button has aria-busy and spinner", () => {
  const source = read(ADMIN_MAINTENANCE_CARD_PATH);
  assert.ok(source.includes("aria-busy={isPending ? true : undefined}"));
  assert.ok(source.includes('import { Loader2 } from "lucide-react";'));
  assert.ok(source.includes('"Analizando..."'));
});

test("PR-4 AdminPricingEditorCard Actualizar button has aria-busy and spinner", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);
  assert.ok(source.includes("aria-busy={isLoading ? true : undefined}"));
  assert.ok(source.includes('import { Loader2 } from "lucide-react";'));
  assert.ok(source.includes('"Actualizando..."'));
});

// ── focus-visible on option row buttons ──────────────────────────────────────

test("PR-4 AdminParticularTokensCard clinic option buttons use dashboard-option-row", () => {
  const source = read(ADMIN_PARTICULAR_TOKENS_CARD_PATH);
  assert.ok(
    source.includes("dashboard-option-row"),
    "AdminParticularTokensCard clinic option buttons must include dashboard-option-row class",
  );
  assert.ok(source.includes('role="option"'));
  assert.ok(source.includes("aria-selected={"));
});

test("PR-4 UploadReportModal clinic option buttons use dashboard-option-row", () => {
  const source = read(UPLOAD_REPORT_MODAL_PATH);
  assert.ok(
    source.includes("dashboard-option-row"),
    "UploadReportModal clinic option buttons must include dashboard-option-row class",
  );
  assert.ok(source.includes('role="option"'));
  assert.ok(source.includes("aria-selected={"));
});

// ── Loader2 animated spinner semantic ────────────────────────────────────────

test("PR-4 spinner elements are aria-hidden to not pollute screen reader flow", () => {
  const cards = [
    ADMIN_CLINICS_CARD_PATH,
    ADMIN_FAILED_LOGINS_CARD_PATH,
    ADMIN_SESSIONS_CARD_PATH,
    ADMIN_SCHEMA_HEALTH_CARD_PATH,
    ADMIN_USERS_ROLES_CARD_PATH,
    ADMIN_MAINTENANCE_CARD_PATH,
    ADMIN_PRICING_CARD_PATH,
  ];

  for (const cardPath of cards) {
    const source = read(cardPath);
    assert.ok(
      source.includes('<Loader2 className="animate-spin" aria-hidden="true" />'),
      `${cardPath} spinner must be aria-hidden`,
    );
  }
});

// ── No logic changes ──────────────────────────────────────────────────────────

test("PR-4 loading admin cards keep their real API call handlers", () => {
  assert.ok(read(ADMIN_CLINICS_CARD_PATH).includes("getAdminClinics"));
  assert.ok(read(ADMIN_FAILED_LOGINS_CARD_PATH).includes("getAdminFailedLoginAlerts"));
  assert.ok(read(ADMIN_SESSIONS_CARD_PATH).includes("getAdminSessions"));
  assert.ok(read(ADMIN_SESSIONS_CARD_PATH).includes("revokeAdminSession"));
  assert.ok(read(ADMIN_SCHEMA_HEALTH_CARD_PATH).includes("getAdminSchemaHealth"));
  assert.ok(read(ADMIN_USERS_ROLES_CARD_PATH).includes("getAdminUsersRoles"));
  assert.ok(read(ADMIN_MAINTENANCE_CARD_PATH).includes("getAdminMaintenancePurgeDryRun"));
  assert.ok(read(ADMIN_PRICING_CARD_PATH).includes("getAdminPricing"));
});

// ── Scope guard ───────────────────────────────────────────────────────────────

test("PR-4 action feedback polish stays within allowed file scope", () => {
  const changedFiles = execFileSync("git", ["diff", "--name-only"], {
    encoding: "utf8",
  })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  const blockedPrefixes = [
    "server/",
    "drizzle/",
    "shared/",
    "frontend/src/app/api/",
    "frontend/src/middleware",
    "frontend/src/app/histopatologia-veterinaria/",
  ];

  const blockedExactFiles = [
    "package.json",
    "pnpm-lock.yaml",
    "frontend/package.json",
    "frontend/pnpm-lock.yaml",
    "frontend/next-env.d.ts",
    "frontend/tsconfig.json",
    "frontend/src/app/layout.tsx",
    "frontend/src/lib/auth.ts",
    "frontend/src/lib/seo.ts",
    "frontend/src/middleware.ts",
  ];

  for (const file of changedFiles) {
    assert.equal(
      blockedPrefixes.some((prefix) => file.startsWith(prefix)),
      false,
      `PR-4 must not touch blocked prefix: ${file}`,
    );
    assert.equal(
      blockedExactFiles.includes(file),
      false,
      `PR-4 must not modify blocked file: ${file}`,
    );
  }
});
