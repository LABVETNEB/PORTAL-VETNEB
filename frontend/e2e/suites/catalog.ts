export const DOMAINS = [
  "admin",
  "clinic",
  "public",
  "particular",
  "platform",
  "regression",
] as const;

export const CURRENT_COHORTS = [
  "smoke",
  "admin-mobile",
  "visual-contract",
  "public-clinic",
] as const;

export const EXECUTION_COHORTS = [
  "ci",
  "extended",
  "evidence",
  "visual-linux",
  "full",
  "affected",
] as const;

export const PLATFORMS = ["any", "linux"] as const;

export type E2eDomain = (typeof DOMAINS)[number];
export type E2eCurrentCohort = (typeof CURRENT_COHORTS)[number];
export type E2eExecutionCohort = (typeof EXECUTION_COHORTS)[number];
export type E2ePlatform = (typeof PLATFORMS)[number];
export type E2eCriticality = "P0" | "P1" | "P2" | "P3";
export type E2eTargetGate = "current-ci" | "future-p1" | "extended" | "manual";

export type E2eCatalogEntry = {
  readonly path: `e2e/${string}.spec.ts`;
  readonly domain: E2eDomain;
  readonly feature: string;
  readonly contractType: string;
  readonly criticality: E2eCriticality;
  readonly owner: string;
  readonly currentCohorts: readonly E2eCurrentCohort[];
  readonly executionCohorts: readonly E2eExecutionCohort[];
  readonly platform: E2ePlatform;
  readonly fixture: string;
  readonly evidence: string;
  readonly targetGate: E2eTargetGate;
  readonly notes: string;
};

const ci = ["ci", "full"] as const;
const extended = ["extended", "full"] as const;
const evidence = ["evidence", "full"] as const;
const visualLinux = ["visual-linux", "full"] as const;

const entry = (
  path: E2eCatalogEntry["path"],
  domain: E2eDomain,
  feature: string,
  contractType: string,
  currentCohorts: readonly E2eCurrentCohort[],
  executionCohorts: readonly E2eExecutionCohort[],
  options: Partial<
    Pick<
      E2eCatalogEntry,
      "criticality" | "platform" | "fixture" | "evidence" | "targetGate" | "notes"
    >
  > = {},
): E2eCatalogEntry => ({
  path,
  domain,
  feature,
  contractType,
  criticality: options.criticality ?? (currentCohorts.length > 0 ? "P1" : "P2"),
  owner: domain,
  currentCohorts,
  executionCohorts,
  platform: options.platform ?? "any",
  fixture: options.fixture ?? "none",
  evidence: options.evidence ?? "none",
  targetGate: options.targetGate ?? (currentCohorts.length > 0 ? "current-ci" : "extended"),
  notes: options.notes ?? "",
});

export const E2E_SUITE_CATALOG = [
  entry("e2e/admin/clinics/admin-clinic-edit-drawer.spec.ts", "admin", "clinics", "admin isolation edit drawer", ["admin-mobile"], ci, { criticality: "P1", notes: "Security isolation contract; do not demote." }),
  entry("e2e/admin/clinics/admin-clinics-mobile-card-layout.spec.ts", "admin", "clinics", "mobile card layout", ["admin-mobile"], ci),
  entry("e2e/admin/pricing/admin-pricing-multi-form-measurement.spec.ts", "admin", "pricing", "multi-form measurement", [], extended),
  entry("e2e/admin/shell/admin-mobile-app-shell-absolute-no-scroll.spec.ts", "admin", "shell", "absolute no-scroll app shell", ["admin-mobile"], ci),
  entry("e2e/admin/shell/admin-mobile-bottom-navigation-no-scroll.spec.ts", "admin", "shell", "bottom navigation no-scroll", ["admin-mobile"], ci),
  entry("e2e/admin/shell/admin-mobile-config-modules-no-scroll.spec.ts", "admin", "shell", "config modules no-scroll", ["admin-mobile"], ci, { evidence: "test-results" }),
  entry("e2e/admin/shell/admin-mobile-core-modules-no-scroll.spec.ts", "admin", "shell", "core modules no-scroll", ["admin-mobile"], ci, { fixture: "admin-mobile-contracts" }),
  entry("e2e/admin/shell/admin-mobile-final-polish-no-scroll.spec.ts", "admin", "shell", "final polish no-scroll", ["admin-mobile"], ci, { fixture: "admin-mobile-contracts", evidence: "test-results" }),
  entry("e2e/admin/shell/admin-mobile-hub-launcher-no-scroll.spec.ts", "admin", "shell", "hub launcher no-scroll", ["admin-mobile"], ci),
  entry("e2e/admin/shell/admin-mobile-hub-stale-layer-stage.spec.ts", "admin", "shell", "stale layer stage", ["admin-mobile"], ci, { evidence: "test-results" }),
  entry("e2e/admin/shell/admin-mobile-module-layer-isolation.spec.ts", "admin", "shell", "module layer isolation", ["admin-mobile"], ci, { evidence: "test-results" }),
  entry("e2e/admin/shell/admin-mobile-ops-modules-no-scroll.spec.ts", "admin", "shell", "ops modules no-scroll", ["admin-mobile"], ci, { fixture: "admin-mobile-contracts" }),
  entry("e2e/admin/shell/admin-mobile-status-modules-no-scroll.spec.ts", "admin", "shell", "status modules no-scroll", ["admin-mobile"], ci, { fixture: "admin-mobile-contracts", evidence: "test-results" }),
  entry("e2e/admin/tokens/admin-tokens-mobile-toolbar-layout.spec.ts", "admin", "tokens", "mobile toolbar layout", ["admin-mobile"], ci),
  entry("e2e/admin/users/admin-users-fixture-pagination.spec.ts", "admin", "users", "fixture pagination", [], extended, { fixture: "admin-populated-api-server" }),
  entry("e2e/admin/users/admin-users-roles-pager-reachability.spec.ts", "admin", "users", "pager reachability under adaptive geometry", [], extended, { criticality: "P1", fixture: "admin-populated-api-server", notes: "A03 PASS 3 regression: the adaptive desktop row floor must keep the pager reachable." }),
  entry("e2e/admin/users/admin-users-visual-quality-gate.spec.ts", "admin", "users", "visual quality capacity", [], extended, { fixture: "admin-mobile-contracts", notes: "Audit CAP classification mapped to extended in E2E-ORG-1." }),
  entry("e2e/admin/users/admin-users-workspace-5000.spec.ts", "admin", "users", "workspace capacity 5000", [], extended, { notes: "Audit CAP classification mapped to extended in E2E-ORG-1." }),
  entry("e2e/admin/users/admin-users-workspace-mobile-5000.spec.ts", "admin", "users", "mobile workspace capacity 5000", [], extended, { fixture: "admin-mobile-contracts", notes: "Audit CAP classification mapped to extended in E2E-ORG-1." }),
  entry("e2e/clinic/logistics/dashboard-clinic-logistica-mobile-parity.spec.ts", "clinic", "logistics", "mobile logistics parity", ["public-clinic"], ci),
  entry("e2e/clinic/logistics/dashboard-logistica-metricas-full-route-adaptive.spec.ts", "clinic", "logistics", "metrics full route adaptive", [], extended),
  entry("e2e/clinic/logistics/dashboard-logistica-mobile-action-bar-reachability.spec.ts", "clinic", "logistics", "mobile bottom chrome reachability", [], extended, { criticality: "P1", fixture: "admin-populated-api-server", notes: "Hit-testability (not visibility) of the hub pagers and the StickyActionBar actions under the role bottom nav; 5 mobile viewports + the md boundary." }),
  entry("e2e/clinic/logistics/dashboard-logistica-rutas-full-route-adaptive.spec.ts", "clinic", "logistics", "routes full route adaptive", [], extended),
  entry("e2e/clinic/logistics/dashboard-logistica-visitas-full-route-adaptive.spec.ts", "clinic", "logistics", "visits full route adaptive", [], extended),
  entry("e2e/clinic/logistics/logistics-mobile-no-horizontal-table.spec.ts", "clinic", "logistics", "mobile no horizontal table", [], extended),
  entry("e2e/clinic/profile/dashboard-clinic-perfil-mobile-operability.spec.ts", "clinic", "profile", "mobile profile operability", ["public-clinic"], ci),
  entry("e2e/clinic/reports/clinic-informes-zero-internal-scroll.spec.ts", "clinic", "reports", "internal no-scroll", [], extended),
  entry("e2e/clinic/reports/clinic-reports-fixture-pagination.spec.ts", "clinic", "reports", "fixture pagination", [], extended, { fixture: "admin-populated-api-server" }),
  entry("e2e/clinic/reports/clinic-reports-workspace-1000.spec.ts", "clinic", "reports", "workspace capacity 1000 with P1 guards", [], extended, { notes: "Known Informes product defect remains out of scope; audit CAP classification mapped to extended." }),
  entry("e2e/clinic/reports/dashboard-clinic-informes-mobile-parity.spec.ts", "clinic", "reports", "mobile reports parity", ["public-clinic"], ci),
  entry("e2e/clinic/reports/dashboard-informes-server-adaptive-pagination.spec.ts", "clinic", "reports", "server adaptive pagination", [], extended),
  entry("e2e/clinic/shell/dashboard-adaptive-rows.spec.ts", "clinic", "shell", "adaptive rows", [], extended),
  entry("e2e/clinic/shell/dashboard-centered-pager.spec.ts", "clinic", "shell", "centered pager", [], extended),
  entry("e2e/clinic/shell/dashboard-clinic-controller-workspace-parity.spec.ts", "clinic", "shell", "controller rail workspace parity", [], extended),
  entry("e2e/clinic/shell/dashboard-clinic-mobile-content-reachability.spec.ts", "clinic", "shell", "mobile content reachability", [], extended),
  entry("e2e/clinic/shell/dashboard-clinic-mobile-operational-density.spec.ts", "clinic", "shell", "mobile operational density", [], extended),
  entry("e2e/clinic/shell/dashboard-clinic-module-state-parity.spec.ts", "clinic", "shell", "module state parity", [], extended),
  entry("e2e/clinic/shell/dashboard-interaction-foundation.spec.ts", "clinic", "shell", "interaction foundation", ["smoke"], ci),
  entry("e2e/clinic/shell/dashboard-master-detail-state-polish.spec.ts", "clinic", "shell", "master-detail state polish", ["visual-contract"], ci),
  entry("e2e/clinic/shell/remove-dashboard-home-unified-workspace.spec.ts", "clinic", "shell", "post hub removal behavior", [], extended),
  entry("e2e/clinic/tokens/dashboard-clinic-tokens-mobile-parity.spec.ts", "clinic", "tokens", "mobile tokens parity", ["public-clinic"], ci),
  entry("e2e/particular/auth/particular-authenticated-no-scroll.spec.ts", "particular", "auth", "authenticated no-scroll", [], extended, { fixture: "particular-session-contracts" }),
  entry("e2e/particular/auth/particular-authenticated-session-fixture.spec.ts", "particular", "auth", "authenticated session fixture", [], extended, { fixture: "particular-session-contracts" }),
  entry("e2e/platform/accessibility/accessibility-axe-key-routes.spec.ts", "platform", "accessibility", "axe key routes", [], extended),
  entry("e2e/platform/accessibility/dashboard-accessibility-keyboard.spec.ts", "platform", "accessibility", "dashboard keyboard accessibility", ["visual-contract"], ci),
  entry("e2e/platform/app-shell/dashboard-app-shell-visibility-contract.spec.ts", "platform", "app-shell", "app shell visibility", ["visual-contract"], ci),
  entry("e2e/platform/app-shell/dashboard-card-navigation-shell.spec.ts", "platform", "app-shell", "navigation and deep links", ["visual-contract"], ci),
  entry("e2e/platform/app-shell/dashboard-global-masked-master-detail.spec.ts", "platform", "app-shell", "masked master detail", ["visual-contract"], ci),
  entry("e2e/platform/app-shell/dashboard-internal-no-scroll-contract.spec.ts", "platform", "app-shell", "internal no-scroll", ["visual-contract"], ci),
  entry("e2e/platform/app-shell/dashboard-mobile-shell-nav-contract.spec.ts", "platform", "app-shell", "mobile shell navigation", ["visual-contract"], ci),
  entry("e2e/platform/app-shell/dashboard-real-app-shell-no-scroll-contract.spec.ts", "platform", "app-shell", "real app shell no-scroll", ["visual-contract"], ci),
  entry("e2e/platform/app-shell/dashboard-single-viewport-app-shell.spec.ts", "platform", "app-shell", "single viewport app shell", ["visual-contract"], ci),
  entry("e2e/platform/app-shell/dashboard-viewport-zoom-adaptability.spec.ts", "platform", "app-shell", "viewport zoom adaptability", ["visual-contract"], ci),
  entry("e2e/platform/app-shell/dashboard-workspace-layout-polish.spec.ts", "platform", "app-shell", "workspace layout polish", ["visual-contract"], ci),
  entry("e2e/platform/app-shell/dashboard-zero-scroll-mobile-boundary.spec.ts", "platform", "app-shell", "mobile zero-scroll boundary", [], extended),
  entry("e2e/platform/auth/dashboard-auth-redirect.spec.ts", "platform", "auth", "private redirect and admin 404", ["smoke"], ci, { criticality: "P1", notes: "Security boundary; do not demote." }),
  entry("e2e/platform/auth/dashboard-logout-private-cache.spec.ts", "platform", "auth", "logout and private no-store", ["smoke"], ci, { criticality: "P1", targetGate: "current-ci", notes: "Security boundary promoted to the effective CI gate in E2E-ORG-CI; do not demote." }),
  entry("e2e/platform/hydration/contacto-hydration.spec.ts", "platform", "hydration", "contact page hydration", ["smoke"], ci),
  entry("e2e/platform/hydration/login-hydration.spec.ts", "platform", "hydration", "login page hydration", ["smoke"], ci),
  entry("e2e/platform/smoke/visual-smoke.spec.ts", "platform", "smoke", "multi-surface render sanity", ["smoke"], ci, { evidence: "memory" }),
  entry("e2e/platform/theme/theme-mode.spec.ts", "platform", "theme", "light dark toggle", ["smoke"], ci),
  entry("e2e/public/clinics/public-clinics-b2b-operations.spec.ts", "public", "clinics", "B2B operations landing", ["public-clinic"], ci),
  entry("e2e/public/home/home-hero-evidence-first.spec.ts", "public", "home", "hero evidence-first", ["public-clinic"], ci),
  entry("e2e/public/home/public-perspective-scroll.spec.ts", "public", "home", "perspective scroll", ["public-clinic"], ci),
  entry("e2e/public/navigation/public-navigation-footer.spec.ts", "public", "navigation", "navigation and footer", ["public-clinic"], ci),
  entry("e2e/public/pricing/public-pricing-actionable.spec.ts", "public", "pricing", "actionable pricing", ["public-clinic"], ci),
  entry("e2e/public/reports/public-report-preview.spec.ts", "public", "reports", "public report preview", ["public-clinic"], ci),
  entry("e2e/public/routes/public-routes.spec.ts", "public", "routes", "public routes resolve", ["smoke"], ci, { criticality: "P1", notes: "Availability boundary; do not demote." }),
  entry("e2e/public/services/public-service-bento-specimen-journey.spec.ts", "public", "services", "service bento specimen journey", ["public-clinic"], ci),
  entry("e2e/regression/dashboard-adaptive-limit-baseline.spec.ts", "regression", "dashboard", "adaptive limit baseline 15x13", [], extended, { criticality: "P1", fixture: "admin-populated-api-server", evidence: "test-results", notes: "A03: frozen CURRENT adaptive window for 15 consumers across 13 canonical viewports (195 primary records, 234 leaves); exact source/limit/offset/secondPageCount comparison, platform fail-closed." }),
  entry("e2e/regression/dashboard-b04-surface-token-migration.spec.ts", "regression", "dashboard", "persistent chrome elevation", ["visual-contract"], ci, { criticality: "P1", fixture: "admin-populated-api-server", evidence: "test-results", notes: "B04 / audit gate G6: the persistent chrome (shell frame, topbar, horizontal nav, module rail, both mobile bottom navs, filter toolbar, sticky action bar, module tablist) must compute to no elevation shadow. Same canonical matrix owner as A02/A08 (21 surfaces) x 2 themes (normal, dark-gray) x 2 viewport classes (1366x768, 390x844) = 84 states. Transient overlays and focus rings keep their shadow by classification and are NOT asserted flat. Routed to visual-contract because AGENTS.md 7 maps the visual contract to that cohort; do not demote." }),
  entry("e2e/regression/dashboard-b05-surface-inversion.spec.ts", "regression", "dashboard", "filter-field surface inversion", ["visual-contract"], ci, { criticality: "P1", fixture: "admin-populated-api-server", evidence: "test-results", notes: "B05: the 7 super searchers (S1-S7) must resolve a transparent filter-bar/band container and a tinted field via --dash-color-field, in both themes. SHARED surfaces (S1/S2/S3/S6/S7) test only the desktop-visible FilterBar instance — the mobile density renders inside a Radix Dialog.Portal outside .dashboard-app-shell, a pre-B05 gap out of scope to fix. DIRECT surfaces (S4/S5) test both viewport classes since their desktop/mobile markup coexists in the DOM. S7 (clinic-tokens) is expected BLOCKED: the hermetic fixture implements no /api/particular-tokens handler, so its FilterBar never mounts." }),
  entry("e2e/regression/dashboard-geometry-baseline.spec.ts", "regression", "dashboard", "geometry baseline 21x13", [], extended, { criticality: "P1", fixture: "admin-populated-api-server", evidence: "test-results", notes: "A02: frozen CURRENT geometry of 21 surfaces x 13 viewports (273 combinations); not target geometry (audit §46), not the A08 zero-scroll contract." }),
  entry("e2e/regression/dashboard-limit-invariance.spec.ts", "regression", "dashboard", "A05 stable geometry reservation limit invariance 15x13", [], extended, { criticality: "P1", fixture: "admin-populated-api-server", notes: "A05: 15 adaptive consumers across the 13 canonical viewports; exact 32/48/64 internal-region invariance plus hot A-B-A viewport transitions." }),
  entry("e2e/regression/dashboard-operational-contract.spec.ts", "regression", "dashboard", "operational contract S1", ["smoke"], ci, { criticality: "P1", notes: "A01: this E2E covers S1 (the only URL-persisted super searcher); the source-backed matrix in test/unit/ui/dashboard/dashboard-operational-contract-baseline.test.ts covers S1-S7." }),
  entry("e2e/regression/dashboard-zero-scroll-baseline.spec.ts", "regression", "dashboard", "zero-scroll baseline 21x13", ["visual-contract"], ci, { criticality: "P1", fixture: "admin-populated-api-server", evidence: "test-results", notes: "A08: app-shell zero-scroll freeze over the SAME canonical A02 matrix (21 surfaces x 13 viewports = 273 combinations); documentElement/body/main.dashboard-main must not scroll (exact 0px) and main must not be an operational scroll container. Contracted internal canvas scroll stays permitted (audit §10). Routed to visual-contract because AGENTS.md §7 maps the zero-scroll/visual contract to that cohort and §10 names it the exit criterion; do not demote." }),
  entry("e2e/regression/evidence/dashboard-runtime-post-ux1-visual-evidence.spec.ts", "regression", "evidence", "runtime visual evidence", [], evidence, { evidence: "test-results" }),
  entry("e2e/regression/evidence/remove-home-unified-workspace-screenshots.spec.ts", "regression", "evidence", "workspace screenshots evidence", [], evidence, { evidence: "test-results" }),
  entry("e2e/regression/visual/visual-regression-authenticated.spec.ts", "regression", "visual", "authenticated dual-theme pixel baseline", [], visualLinux, { platform: "linux", evidence: "snapshots", targetGate: "manual", notes: "R9: dual since B04 - 2 routes x 5 viewports x 2 themes = 20 Chromium-Linux baselines. The 10 normal names are unchanged from before B04; the dark set carries a -dark-gray suffix." }),
  entry("e2e/regression/visual/visual-regression-public.spec.ts", "regression", "visual", "public pixel baseline", [], visualLinux, { platform: "linux", evidence: "snapshots", targetGate: "manual", notes: "Linux-only baseline; public spec has no platform skip." }),
  entry("e2e/regression/visual/visual-regression-stress.spec.ts", "regression", "visual", "stress pixel baseline", [], visualLinux, { platform: "linux", evidence: "snapshots", targetGate: "manual" }),
] as const satisfies readonly E2eCatalogEntry[];

export const E2E_MANUAL_ONLY_SPECS = [] as const satisfies readonly `e2e/${string}.spec.ts`[];

export const E2E_COHORT_SPECS: Readonly<Record<E2eExecutionCohort, readonly E2eCatalogEntry["path"][]>> =
  Object.freeze({
    ci: E2E_SUITE_CATALOG.filter((item) => item.executionCohorts.includes("ci")).map((item) => item.path),
    extended: E2E_SUITE_CATALOG.filter((item) => item.executionCohorts.includes("extended")).map((item) => item.path),
    evidence: E2E_SUITE_CATALOG.filter((item) => item.executionCohorts.includes("evidence")).map((item) => item.path),
    "visual-linux": E2E_SUITE_CATALOG.filter((item) => item.executionCohorts.includes("visual-linux")).map((item) => item.path),
    full: E2E_SUITE_CATALOG.filter((item) => item.executionCohorts.includes("full")).map((item) => item.path),
    affected: [],
  });

export const E2E_CURRENT_COHORT_SPECS: Readonly<Record<E2eCurrentCohort, readonly E2eCatalogEntry["path"][]>> =
  Object.freeze({
    smoke: E2E_SUITE_CATALOG.filter((item) => item.currentCohorts.includes("smoke")).map((item) => item.path),
    "admin-mobile": E2E_SUITE_CATALOG.filter((item) => item.currentCohorts.includes("admin-mobile")).map((item) => item.path),
    "visual-contract": E2E_SUITE_CATALOG.filter((item) => item.currentCohorts.includes("visual-contract")).map((item) => item.path),
    "public-clinic": E2E_SUITE_CATALOG.filter((item) => item.currentCohorts.includes("public-clinic")).map((item) => item.path),
  });
