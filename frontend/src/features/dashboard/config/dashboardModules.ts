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
 * Operational default for a bare admin dashboard landing. This is deliberately
 * explicit rather than derived from `ADMIN_MODULE_IDS[0]`: catalog order is a
 * navigation/hub concern and must not silently change the entry workspace.
 */
export const DEFAULT_ADMIN_MODULE: AdminModule = "admin";

/** The non-module navigation destination that exposes the admin hub. */
export const ADMIN_HOME_NAV_ITEM = {
  id: "home",
  label: "Inicio",
  shortLabel: "Inicio",
} as const;

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

/**
 * Admin module navigation labels in canonical order (B06).
 *
 * The admin label table used to exist only as two private literals inside
 * presentation components: `ADMIN_NAV_ITEMS` in `DashboardHorizontalNav` (full
 * labels) and `ADMIN_MOBILE_TITLES` in `DashboardTopbar` (context titles). The
 * B06 workspace app bar needs a searchable label for every admin module, and
 * adding a THIRD private copy is exactly the H1 duplication this catalog
 * exists to prevent — so the table is declared here, once, in
 * `ADMIN_MODULE_IDS` order, and the app bar derives its search corpus from it.
 *
 * Mirrors {@link CLINIC_MODULE_NAV_LABELS} in shape so both roles feed the same
 * search grammar. B06 does NOT migrate the two existing literals: retiring the
 * horizontal nav is B08 and the mobile context title is B09, and rewriting them
 * here would move chrome that later blocks own.
 */
export const ADMIN_MODULE_NAV_LABELS: readonly {
  moduleId: AdminModule;
  label: string;
  shortLabel: string;
}[] = [
  { moduleId: "admin", label: "Resumen", shortLabel: "Resumen" },
  { moduleId: "admin-report-upload", label: "Informes", shortLabel: "Informes" },
  { moduleId: "admin-health", label: "Estado", shortLabel: "Estado" },
  { moduleId: "admin-clinics", label: "Clínicas", shortLabel: "Clínicas" },
  { moduleId: "admin-particular-tokens", label: "Tokens", shortLabel: "Tokens" },
  { moduleId: "admin-pricing", label: "Precios", shortLabel: "Precios" },
  { moduleId: "admin-sessions", label: "Sesiones", shortLabel: "Sesiones" },
  { moduleId: "admin-users-roles", label: "Usuarios", shortLabel: "Usuarios" },
  { moduleId: "audit-log", label: "Auditoría", shortLabel: "Auditoría" },
  { moduleId: "admin-maintenance", label: "Mantenimiento", shortLabel: "Manten." },
];

/**
 * Admin modules promoted to the PRIMARY slots of the mobile bottom navigation
 * (B09), in the order they are painted after the "Inicio" entry.
 *
 * This is a product cut, not a derivation: the shipped mobile bar surfaces
 * Clínicas / Auditoría / Sesiones, which is NOT the head of
 * {@link ADMIN_MODULE_IDS}. Before B09 that cut lived as a private
 * `FIXED_DESTINATIONS` literal inside `AdminMobileBottomNav` — with its own
 * label and icon copies — so the bar could drift from the registry it serves.
 * It is declared HERE, once, as data: the labels still come from
 * {@link ADMIN_MODULE_NAV_LABELS} and the glyphs from `ADMIN_MODULE_ICONS`.
 *
 * Every module outside this cut stays reachable through the destination
 * overflow, which lists the WHOLE catalog rather than the remainder.
 *
 * @see docs/implementation/dashboard-b09-mobile-navigation-unification.md
 */
export const ADMIN_MOBILE_PRIMARY_MODULE_IDS: readonly AdminModule[] = [
  "admin-clinics",
  "audit-log",
  "admin-sessions",
];
