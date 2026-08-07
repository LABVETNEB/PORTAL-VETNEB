/**
 * A01 · Dashboard operational contract fixture.
 *
 * Frozen, source-backed inventory of what the VETNEB dashboard *does*, not how
 * it looks: the 15 canonical modules (10 admin + 5 clinic) and the 7 super
 * searchers (S1–S7) with their query mechanism, actions, page/offset reset,
 * refresh, loading, disabled, URL persistence and responsive exposure.
 *
 * Rules of this fixture:
 * - The executable source prevails. Every operational claim carries `markers`:
 *   literal substrings that must exist in `sourcePath` (CRLF-normalized).
 * - Divergences between `docs/audit/AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md`
 *   (§7.1–§7.6, §12, §13) and the runtime are NOT normalized: they are listed in
 *   {@link DASHBOARD_OPERATIONAL_DRIFT} so the test exposes them instead of
 *   silently adopting either side.
 *
 * @see frontend/src/features/dashboard/config/dashboardModules.ts (module registry)
 * @see docs/audit/AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md
 */

export type DashboardRole = "admin" | "clinic";

export type DashboardModuleContract = {
  /** 1-based position inside the role's canonical order. */
  readonly order: number;
  readonly role: DashboardRole;
  /** Value accepted by `?module=`. */
  readonly moduleId: string;
  /** Canonical deep link. */
  readonly route: string;
  /** Root component rendered by the module workspace. */
  readonly component: string;
  readonly sourcePath: string;
};

/** Canonical admin order-of-record: `ADMIN_MODULE_IDS`. */
const ADMIN_MODULES: readonly Omit<DashboardModuleContract, "order" | "role" | "route">[] = [
  { moduleId: "admin", component: "AdminCommandCenter", sourcePath: "frontend/src/app/dashboard/admin/AdminCommandCenter.tsx" },
  { moduleId: "admin-report-upload", component: "AdminReportsCard", sourcePath: "frontend/src/app/dashboard/admin/AdminReportsCard.tsx" },
  { moduleId: "admin-health", component: "AdminSchemaHealthStatusCard", sourcePath: "frontend/src/app/dashboard/admin/AdminSchemaHealthStatusCard.tsx" },
  { moduleId: "admin-clinics", component: "AdminClinicsManagementCard", sourcePath: "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx" },
  { moduleId: "admin-particular-tokens", component: "AdminParticularTokensCard", sourcePath: "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx" },
  { moduleId: "admin-pricing", component: "AdminPricingEditorCard", sourcePath: "frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx" },
  { moduleId: "admin-sessions", component: "AdminSessionsReadOnlyCard", sourcePath: "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx" },
  { moduleId: "admin-users-roles", component: "AdminUsersRolesReadOnlyCard", sourcePath: "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx" },
  { moduleId: "audit-log", component: "AdminAuditCard", sourcePath: "frontend/src/app/dashboard/admin/AdminAuditCard.tsx" },
  { moduleId: "admin-maintenance", component: "AdminMaintenanceDryRunCard", sourcePath: "frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx" },
];

/** Canonical clinic navigation order: `CLINIC_MODULE_IDS`. */
const CLINIC_MODULES: readonly Omit<DashboardModuleContract, "order" | "role" | "route">[] = [
  { moduleId: "operaciones", component: "ClinicCommandCenter", sourcePath: "frontend/src/app/dashboard/ClinicCommandCenter.tsx" },
  { moduleId: "informes", component: "ClinicInformesWorkspaceSummary", sourcePath: "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx" },
  { moduleId: "logistica", component: "ClinicLogisticaWorkspaceSummary", sourcePath: "frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx" },
  { moduleId: "perfil", component: "ClinicPublicProfileCard", sourcePath: "frontend/src/components/dashboard/ClinicPublicProfileCard.tsx" },
  { moduleId: "tokens", component: "ClinicParticularTokensCard", sourcePath: "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx" },
];

export const ADMIN_MODULE_ROUTE_BASE = "/dashboard/admin";
export const CLINIC_MODULE_ROUTE_BASE = "/dashboard";

function withRole(
  role: DashboardRole,
  base: string,
  modules: readonly Omit<DashboardModuleContract, "order" | "role" | "route">[],
): DashboardModuleContract[] {
  return modules.map((module, index) => ({
    order: index + 1,
    role,
    moduleId: module.moduleId,
    route: `${base}?module=${module.moduleId}`,
    component: module.component,
    sourcePath: module.sourcePath,
  }));
}

/** The 15 canonical modules: 10 admin first, then the 5 clinic modules. */
export const DASHBOARD_MODULE_CONTRACTS: readonly DashboardModuleContract[] = [
  ...withRole("admin", ADMIN_MODULE_ROUTE_BASE, ADMIN_MODULES),
  ...withRole("clinic", CLINIC_MODULE_ROUTE_BASE, CLINIC_MODULES),
];

export const DASHBOARD_MODULE_TOTAL = 15;
export const DASHBOARD_ADMIN_MODULE_TOTAL = 10;
export const DASHBOARD_CLINIC_MODULE_TOTAL = 5;

/**
 * Query mechanism of a super searcher.
 * - `native-get`: real `<form method="get">`; the operation lives in the URL.
 * - `client-submit`: React `onSubmit` over already-loaded rows.
 * - `debounced-server`: `onChange` + debounce that re-queries the backend.
 */
export type SuperSearchMode = "native-get" | "client-submit" | "debounced-server";

/** Where the filter predicate actually runs. */
export type SuperSearchFiltering = "server-side" | "client-side";

/** Bar render policy (audit §7.6 — deliberately NOT unified). */
export type SuperSearchRenderPolicy =
  | "always"
  | "when-no-reports-load-error"
  | "when-tokens-loaded";

export type SuperSearchContract = {
  readonly id: string;
  readonly label: string;
  readonly role: DashboardRole;
  readonly moduleId: string;
  readonly route: string;
  readonly sourcePath: string;
  readonly mode: SuperSearchMode;
  readonly filtering: SuperSearchFiltering;
  /** Named controls submitted/read by the bar, in DOM order. */
  readonly fields: readonly string[];
  /** What runs the query. */
  readonly apply: string;
  /** What resets the draft/applied state, or `null` when the bar has no clear. */
  readonly clear: string | null;
  /** Page/offset reset performed by apply, or `null` when there is none. */
  readonly pageReset: string | null;
  /** Explicit re-fetch control, or `null`. */
  readonly refresh: string | null;
  /** Loading signal wired to the bar/table controls, or `null`. */
  readonly loading: string | null;
  /** Disabled wiring of the bar controls, or `null`. */
  readonly disabled: string | null;
  /** Filters survive as real query-string parameters. */
  readonly urlPersistence: boolean;
  /** Back/Forward returns to the previous filter state. */
  readonly backForwardRestores: boolean;
  /** Reload re-renders the same filter state. */
  readonly reloadRestores: boolean;
  /** Empty / error surface driven by the bar. */
  readonly emptyState: string;
  readonly errorState: string;
  readonly renderPolicy: SuperSearchRenderPolicy;
  /** Desktop exposure of the bar. */
  readonly desktopVisibility: string;
  /** Mobile exposure of the same fields. */
  readonly mobileAccess: string;
  /** Literal substrings that must exist in `sourcePath`. */
  readonly markers: readonly string[];
};

export const SUPER_SEARCH_CONTRACTS: readonly SuperSearchContract[] = [
  {
    id: "S1",
    label: "Auditoría",
    role: "admin",
    moduleId: "audit-log",
    route: "/dashboard/admin?module=audit-log",
    sourcePath: "frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx",
    mode: "native-get",
    filtering: "server-side",
    fields: ["module", "event", "actorType", "from", "to", "clinicId", "reportId"],
    apply: 'native GET submit ("Aplicar", type="submit") navigating to /dashboard/admin',
    clear: 'PublicRouteControl replace to /dashboard/admin?module=audit-log, rendered only when hasActiveFilters',
    pageReset: "via URL: the server component re-renders with offset 0",
    refresh: null,
    loading: null,
    disabled: null,
    urlPersistence: true,
    backForwardRestores: true,
    reloadRestores: true,
    emptyState: "server-rendered audit page with zero rows",
    errorState: "server-side load error handled by AdminAuditCard, the bar still renders",
    renderPolicy: "always",
    desktopVisibility: 'inline form from md: up ("mx-3 hidden sm:mx-4 md:grid")',
    mobileAccess: "ModuleDialog with a duplicated FilterForm (aria-label ... mobile)",
    markers: [
      'action="/dashboard/admin"',
      'method="get"',
      '<input type="hidden" name="module" value="audit-log" />',
      'name="event"',
      'name="actorType"',
      'name="from"',
      'name="to"',
      'name="clinicId"',
      'name="reportId"',
      'type="submit"',
      "Aplicar",
      'href="/dashboard/admin?module=audit-log"',
      "Limpiar",
      "hasActiveFilters ? (",
      '"mx-3 hidden sm:mx-4 md:grid',
      "<ModuleDialog",
      "md:hidden",
      '"Filtros de auditoría"',
      '"Filtros de auditoría mobile"',
    ],
  },
  {
    id: "S2",
    label: "Tokens admin",
    role: "admin",
    moduleId: "admin-particular-tokens",
    route: "/dashboard/admin?module=admin-particular-tokens",
    sourcePath: "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx",
    mode: "client-submit",
    filtering: "client-side",
    fields: ["token", "clinic", "reportId", "patient", "status", "from", "to"],
    apply: 'React onSubmit ("Aplicar") copying the draft into appliedFilters',
    clear: '"Limpiar" restores INITIAL_FILTER_STATE, rendered only when hasActiveFilters',
    pageReset: "pagedTokens.setPage(0)",
    refresh: '"Actualizar" calls loadTokens() (superset re-fetch, no filter params)',
    loading: "isLoadingTokens",
    disabled: "disabled={isLoadingTokens} on Actualizar and on the pager buttons",
    urlPersistence: false,
    backForwardRestores: false,
    reloadRestores: false,
    emptyState: "empty list message branching on hasActiveFilters",
    errorState: "errorMessage set by loadTokens, tokens reset to []",
    renderPolicy: "always",
    desktopVisibility: 'FilterBar from md: up ("hidden shrink-0 md:grid")',
    mobileAccess: "ModuleDialog variant of the same FilterBar (data-admin-filter-bar=advanced-mobile)",
    markers: [
      "onSubmit={applyAdvancedFilters}",
      "pagedTokens.setPage(0);",
      "matchesAdminParticularTokenFilters(",
      "INITIAL_FILTER_STATE",
      "hasActiveFilters ? (",
      "Aplicar",
      "Limpiar",
      "Actualizar",
      "disabled={isLoadingTokens}",
      "onClick={() => void loadTokens()}",
      "getAdminParticularTokens({",
      "TOKENS_INITIAL_ADAPTIVE_WINDOW_SIZE",
      "hidden shrink-0 md:grid",
      'data-admin-filter-bar={mobile ? "advanced-mobile" : "advanced"}',
    ],
  },
  {
    id: "S3",
    label: "Informes admin",
    role: "admin",
    moduleId: "admin-report-upload",
    route: "/dashboard/admin?module=admin-report-upload",
    sourcePath: "frontend/src/app/dashboard/admin/AdminReportsCard.tsx",
    mode: "client-submit",
    filtering: "client-side",
    fields: ["report", "clinic", "patient", "status", "study", "file", "from", "to"],
    apply: 'React onSubmit ("Aplicar") copying the draft into appliedFilters',
    clear: '"Limpiar" restores INITIAL_FILTER_STATE unconditionally',
    pageReset: "setOffset(0)",
    refresh: '"Actualizar" calls loadReports() and is disabled while isLoading or busyReportId is set',
    loading: "isLoading",
    disabled: "disabled={isLoading || busyReportId !== null} and disabled={!hasPrev || isLoading}",
    urlPersistence: false,
    backForwardRestores: false,
    reloadRestores: false,
    emptyState: "empty table branch driven by isLoading and hasActiveFilters",
    errorState: "errorMessage set by loadReports",
    renderPolicy: "always",
    desktopVisibility: 'FilterBar from md: up ("hidden shrink-0 md:grid")',
    mobileAccess: "ModuleDialog variant of the same FilterBar (data-admin-report-upload-filter-bar=advanced-mobile)",
    markers: [
      "onSubmit={applyAdvancedFilters}",
      "setOffset(0);",
      "matchesAdminReportFilters(",
      "INITIAL_FILTER_STATE",
      "Aplicar",
      "Limpiar",
      "Actualizar",
      "onClick={() => void loadReports()}",
      "disabled={isLoading || busyReportId !== null}",
      "getAdminReportWorkflow({",
      "limit: query.limit,",
      "offset: query.offset,",
      "hidden shrink-0 md:grid",
      'data-admin-report-upload-filter-bar={mobile ? "advanced-mobile" : "advanced"}',
    ],
  },
  {
    id: "S4",
    label: "Clínicas",
    role: "admin",
    moduleId: "admin-clinics",
    route: "/dashboard/admin?module=admin-clinics",
    sourcePath: "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx",
    mode: "debounced-server",
    filtering: "server-side",
    fields: ["searchQuery"],
    apply: "onChange + 300 ms debounce promoting searchQuery into submittedSearch",
    clear: null,
    pageReset: "setOffset(0) inside the same debounce timer",
    refresh: "loadClinics() re-run by the query effect and by the Actualizar button",
    loading: "isPending (startTransition)",
    disabled: "disabled={isBusy} on both search inputs and on the pager buttons",
    urlPersistence: false,
    backForwardRestores: false,
    reloadRestores: false,
    emptyState: 'empty card titled `Sin resultados para "${searchQuery}"`',
    errorState: "formatAdminClinicsError surfaced in the module alert",
    renderPolicy: "always",
    desktopVisibility: 'single search input inside "hidden items-center justify-between gap-2 md:flex"',
    mobileAccess: 'separate md:hidden search input (data-admin-mobile-core-module="clinics"), no dialog',
    markers: [
      "onChange={(e) => setSearchQuery(e.target.value)}",
      "setSubmittedSearch(searchQuery.trim());",
      "setOffset(0);",
      "}, 300);",
      "{ search: submittedSearch }",
      "getAdminClinics(query)",
      "disabled={isBusy}",
      'aria-label="Buscar clínicas"',
      "hidden items-center justify-between gap-2 md:flex",
      'data-admin-mobile-core-module="clinics"',
      "md:hidden",
    ],
  },
  {
    id: "S5",
    label: "Usuarios y roles",
    role: "admin",
    moduleId: "admin-users-roles",
    route: "/dashboard/admin?module=admin-users-roles",
    sourcePath: "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx",
    mode: "debounced-server",
    filtering: "server-side",
    fields: ["searchQuery", "userType", "role"],
    apply: "onChange: selects apply immediately, the text field after a 300 ms debounce",
    clear: null,
    pageReset: "setOffset(0) in the debounce timer AND in both select onChange handlers",
    refresh: "loadUsersRoles() re-run by the query effect and by the Actualizar button",
    loading: "isPending (startTransition)",
    disabled: "disabled={disableUserActions} on the search input and both selects",
    urlPersistence: false,
    backForwardRestores: false,
    reloadRestores: false,
    emptyState: "empty table branch of the users list",
    errorState: "load error surfaced by the card alert",
    renderPolicy: "always",
    desktopVisibility: 'plain div toolbar labelled "Filtros de usuarios y roles" (no FilterBar primitive)',
    mobileAccess: "duplicated mobile toolbar with the same three controls, no dialog",
    markers: [
      'aria-label="Filtros de usuarios y roles"',
      "setDebouncedSearch(searchQuery.trim());",
      "setOffset(0);",
      "}, 300);",
      "{ search: debouncedSearch }",
      "loadUsersRoles",
      "disabled={disableUserActions}",
      "{effectiveLimit} por página",
      'setUserType(event.target.value as AdminRoleUserType | "all")',
      'setRole(event.target.value as AdminRoleUserRole | "all")',
    ],
  },
  {
    id: "S6",
    label: "Informes clínica",
    role: "clinic",
    moduleId: "informes",
    route: "/dashboard?module=informes",
    sourcePath: "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx",
    mode: "client-submit",
    filtering: "client-side",
    fields: ["report", "patient", "status", "study", "file", "from", "to"],
    apply: 'React onSubmit ("Aplicar") copying the trimmed draft into appliedFilters',
    clear: '"Limpiar" restores INITIAL_REPORTS_FILTER_STATE unconditionally',
    pageReset: "pagedReports.setPage(0)",
    refresh: null,
    loading: null,
    disabled: null,
    urlPersistence: false,
    backForwardRestores: false,
    reloadRestores: false,
    emptyState: "empty rows branch of the paged reports table",
    errorState: "reportsLoadError replaces the whole bar with an error surface",
    renderPolicy: "when-no-reports-load-error",
    desktopVisibility: 'FilterBar from md: up ("hidden shrink-0 md:grid")',
    mobileAccess: "ModuleDialog variant (data-clinic-report-filter-bar=advanced-mobile)",
    markers: [
      "onSubmit={applyAdvancedFilters}",
      "pagedReports.setPage(0);",
      "matchesClinicReportFilters(",
      "INITIAL_REPORTS_FILTER_STATE",
      "Aplicar",
      "Limpiar",
      "{!reportsLoadError ? renderAdvancedFilterForm() : null}",
      "hidden shrink-0 md:grid",
      'data-clinic-report-filter-bar={mobile ? "advanced-mobile" : "advanced"}',
      '"Filtros avanzados de informes clínica"',
    ],
  },
  {
    id: "S7",
    label: "Tokens clínica",
    role: "clinic",
    moduleId: "tokens",
    route: "/dashboard?module=tokens",
    sourcePath: "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx",
    mode: "client-submit",
    filtering: "client-side",
    fields: ["token", "reportId", "patient", "status", "from", "to"],
    apply: 'React onSubmit ("Aplicar") copying the draft into appliedFilters',
    clear: '"Limpiar" restores INITIAL_FILTER_STATE unconditionally',
    pageReset: "pagedTokens.setPage(0)",
    refresh: '"Actualizar" calls loadTokens(effectiveFetchLimit)',
    loading: "isLoadingTokens",
    disabled: "disabled={isLoadingTokens} on the refresh control",
    urlPersistence: false,
    backForwardRestores: false,
    reloadRestores: false,
    emptyState: '"Sin tokens para los filtros aplicados"',
    errorState: "load error surfaced by the card; the bar disappears when tokens is empty",
    renderPolicy: "when-tokens-loaded",
    desktopVisibility: 'FilterBar from md: up ("mb-2 hidden shrink-0 md:grid")',
    mobileAccess: "ModuleDialog variant (data-clinic-access-filter-bar=advanced-mobile)",
    markers: [
      "onSubmit={applyAdvancedFilters}",
      "pagedTokens.setPage(0);",
      "matchesClinicParticularTokenFilters(",
      "INITIAL_FILTER_STATE",
      "Aplicar",
      "Limpiar",
      "Actualizar",
      "disabled={isLoadingTokens}",
      "onClick={() => void loadTokens(effectiveFetchLimit)}",
      "{tokens.length ? renderAdvancedFilterForm() : null}",
      "mb-2 hidden shrink-0 md:grid",
      'data-clinic-access-filter-bar={mobile ? "advanced-mobile" : "advanced"}',
      '"Filtros avanzados de tokens clínica"',
    ],
  },
];

export const SUPER_SEARCH_TOTAL = 7;

/**
 * Recorded divergence between the audit narrative and the executable source.
 * The runtime always wins; A01 documents the gap instead of changing runtime.
 */
export type DashboardDriftRecord = {
  readonly id: string;
  readonly surface: string;
  /**
   * Heading numbers of docs/audit/AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md
   * (`### <n> ...`) that state the claim being contradicted.
   */
  readonly auditSections: readonly string[];
  readonly auditClaim: string;
  readonly runtimeBehaviour: string;
  readonly runtimeSourcePath: string;
  /** Literal substrings proving `runtimeBehaviour` inside `runtimeSourcePath`. */
  readonly runtimeMarkers: readonly string[];
  readonly resolution: "runtime-prevails";
};

export const DASHBOARD_OPERATIONAL_DRIFT: readonly DashboardDriftRecord[] = [
  {
    id: "D-01",
    surface: "S4",
    auditSections: ["7.2", "7.4"],
    auditClaim:
      "S4 filters in memory on every keystroke (`onChange` cliente, «Filtrado en memoria») and performs no page reset.",
    runtimeBehaviour:
      "S4 is debounced-server: a 300 ms timer promotes the query into `submittedSearch`, resets the offset and sends `search` to `getAdminClinics`.",
    runtimeSourcePath: "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx",
    runtimeMarkers: [
      "setSubmittedSearch(searchQuery.trim());",
      "}, 300);",
      "{ search: submittedSearch }",
      "getAdminClinics(query)",
      "setOffset(0);",
    ],
    resolution: "runtime-prevails",
  },
  {
    id: "D-02",
    surface: "S5",
    auditSections: ["7.2"],
    auditClaim:
      "S5 resets the offset only on the selects and explicitly **not** on the text field.",
    runtimeBehaviour:
      "The debounce effect that promotes the text query also calls `setOffset(0)`, so the text field resets the offset too — the selects merely reset it synchronously.",
    runtimeSourcePath: "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx",
    runtimeMarkers: [
      "setDebouncedSearch(searchQuery.trim());",
      "setOffset(0);",
      "}, 300);",
    ],
    resolution: "runtime-prevails",
  },
  {
    id: "D-03",
    surface: "S2",
    auditSections: ["7.4"],
    auditClaim:
      "The 7 S2 parameters (`token`, `clinic`, `reportId`, `patient`, `status`, `from`, `to`) have `loadTokens()` as their destination.",
    runtimeBehaviour:
      "`loadTokens()` takes no filter argument: it fetches the bounded initial adaptive window (`limit: TOKENS_INITIAL_ADAPTIVE_WINDOW_SIZE, offset: 0`) and the 7 filters are a client-side predicate over the loaded rows.",
    runtimeSourcePath: "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx",
    runtimeMarkers: [
      "getAdminParticularTokens({",
      "limit: TOKENS_INITIAL_ADAPTIVE_WINDOW_SIZE,",
      "matchesAdminParticularTokenFilters(",
    ],
    resolution: "runtime-prevails",
  },
  {
    id: "D-04",
    surface: "S3",
    auditSections: ["7.4"],
    auditClaim:
      "The 8 S3 parameters have `getAdminReportWorkflow({limit, offset})` as their destination.",
    runtimeBehaviour:
      "`getAdminReportWorkflow` only ever receives `{limit, offset}`; the 8 filters never reach the backend and are applied by `matchesAdminReportFilters` over the loaded page.",
    runtimeSourcePath: "frontend/src/app/dashboard/admin/AdminReportsCard.tsx",
    runtimeMarkers: [
      "getAdminReportWorkflow({",
      "limit: query.limit,",
      "offset: query.offset,",
      "matchesAdminReportFilters(",
    ],
    resolution: "runtime-prevails",
  },
  {
    id: "D-05",
    surface: "S6",
    auditSections: ["7.2"],
    auditClaim: "S6 resets pagination with `setOffset(0)`.",
    runtimeBehaviour:
      "S6 has no server offset: it resets the client pager with `pagedReports.setPage(0)` over `usePagedRows`.",
    runtimeSourcePath: "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx",
    runtimeMarkers: ["pagedReports.setPage(0);", "usePagedRows(filteredReports, rowsPerPage)"],
    resolution: "runtime-prevails",
  },
  {
    id: "D-06",
    surface: "S6 / S7",
    auditSections: ["7.6"],
    auditClaim:
      "The conditional render policy is stated per surface only (`always` / `!reportsLoadError` / `tokens.length`), without a viewport dimension.",
    runtimeBehaviour:
      "The policy is two-dimensional: on top of the state condition, the desktop bar is gated behind `md:` and mobile reaches the same fields through a `ModuleDialog` variant with its own aria-label — so the bar can be absent on mobile even when the state condition holds.",
    runtimeSourcePath: "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx",
    runtimeMarkers: [
      "{tokens.length ? renderAdvancedFilterForm() : null}",
      "mb-2 hidden shrink-0 md:grid",
      '"Filtros avanzados de tokens clínica mobile"',
    ],
    resolution: "runtime-prevails",
  },
];

/**
 * S4 and S5 are the two surfaces that do NOT use the shared `FilterBar`
 * primitive (audit finding P1-05). Frozen here so a future migration is a
 * deliberate contract change.
 */
export const SUPER_SEARCH_WITHOUT_FILTER_BAR: readonly string[] = ["S4", "S5"];
