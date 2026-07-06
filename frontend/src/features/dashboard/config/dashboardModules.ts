/**
 * Dashboard · module config catalog (PR-PRES-3).
 *
 * Single source of truth for the dashboard module registry per role: canonical
 * ids, canonical order, admin aliases, the clinic operational default, pure
 * lookup/parse helpers and the clinic navigation label table.
 *
 * Before this catalog the same truth ("which modules exist, in what order, and
 * how the `?module=` value is validated") was copied literally across the admin
 * controller + admin route, the clinic controller + clinic route, and the clinic
 * rail + mobile bottom-nav (audit H1). Those surfaces now derive their view from
 * here instead of re-declaring the id list, the alias map and the parse routine.
 *
 * Boundary rule (config layer): **no React imports** — pure data, types and
 * functions only. Icons stay in the presentation components (they are React
 * components) and are mapped there by module id; this catalog only owns the
 * id/label/order data that is safe to centralize without touching JSX or CSS.
 *
 * @see docs/implementation/dashboard-module-config-catalog.md
 * @see docs/audit/dashboard-presentation-primitives-architecture-audit.md (H1)
 */

// ── Admin ───────────────────────────────────────────────────────────────────

/**
 * Canonical admin module ids in hub/order-of-record. Replaces the twin literal
 * lists previously kept in `AdminDashboardWorkspaceController` (`ADMIN_MODULE_VALUES`)
 * and `admin/page.tsx` (`VALID_ADMIN_MODULES`).
 */
export const ADMIN_MODULE_IDS = [
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

export type AdminModule = (typeof ADMIN_MODULE_IDS)[number];

/**
 * Legacy `?module=` values still honoured as redirects to a canonical id. Kept
 * identical to the previous copies in the controller and the route.
 */
export const ADMIN_MODULE_ALIASES: Partial<Record<string, AdminModule>> = {
  "admin-upload-report": "admin-report-upload",
  maintenance: "admin-maintenance",
};

/**
 * Resolve a raw `?module=` value into a canonical admin module id, applying the
 * alias table first. Returns `null` for absent/unknown values (callers decide
 * the fallback). Pure — safe on server and client.
 */
export function parseAdminModule(
  value: string | null | undefined,
): AdminModule | null {
  if (!value) return null;
  const alias = ADMIN_MODULE_ALIASES[value];
  if (alias) {
    return alias;
  }
  return (ADMIN_MODULE_IDS as readonly string[]).includes(value)
    ? (value as AdminModule)
    : null;
}

// ── Clinic ──────────────────────────────────────────────────────────────────

/**
 * Canonical clinic module ids in navigation order. Replaces the twin literal
 * lists previously kept in `ClinicDashboardWorkspaceController`
 * (`CLINIC_MODULE_VALUES`) and `app/dashboard/page.tsx` (`VALID_CLINIC_MODULES`).
 */
export const CLINIC_MODULE_IDS = [
  "operaciones",
  "informes",
  "logistica",
  "perfil",
  "tokens",
] as const;

export type ClinicModule = (typeof CLINIC_MODULE_IDS)[number];

/**
 * Operational default. The clinic dashboard has NO module hub/home: `/dashboard`
 * resolves straight into this workspace, and any legacy "back to overview"
 * intent (hub reset) also lands here instead of a landing screen.
 */
export const DEFAULT_CLINIC_MODULE: ClinicModule = "operaciones";

/**
 * Resolve a raw `?module=` value into a canonical clinic module id. Returns
 * `null` for absent/unknown values (callers fall back to
 * {@link DEFAULT_CLINIC_MODULE}). Pure — safe on server and client.
 */
export function parseClinicModule(
  value: string | null | undefined,
): ClinicModule | null {
  if (!value) return null;
  return (CLINIC_MODULE_IDS as readonly string[]).includes(value)
    ? (value as ClinicModule)
    : null;
}

/**
 * Clinic module navigation labels in canonical order. The full `label` and the
 * compact `shortLabel` were previously duplicated verbatim between the shared
 * module rail (`DashboardModuleRail`) and the mobile bottom-nav
 * (`ClinicMobileBottomNav`); both now read the strings from here and keep only
 * their own icon mapping locally.
 */
export const CLINIC_MODULE_NAV_LABELS: readonly {
  moduleId: ClinicModule;
  label: string;
  shortLabel: string;
}[] = [
  { moduleId: "operaciones", label: "Operaciones", shortLabel: "Ops" },
  { moduleId: "informes", label: "Informes", shortLabel: "Info" },
  { moduleId: "logistica", label: "Logística", shortLabel: "Log" },
  { moduleId: "perfil", label: "Perfil", shortLabel: "Perfil" },
  { moduleId: "tokens", label: "Tokens", shortLabel: "Tokens" },
];
