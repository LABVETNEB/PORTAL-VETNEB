/**
 * Dashboard · application · module navigation (PR-PRES-4).
 *
 * Small, framework-light helpers for the `?module=` navigation grammar shared
 * by the clinic module surfaces. Before this, the query-key literal and the
 * URL→module normalization were copied across the shared module rail
 * (`DashboardModuleRail`) and the mobile bottom-nav (`ClinicMobileBottomNav`),
 * both retired by B09 in favour of `DashboardMobileNav`:
 * each built its own `${ROUTES.dashboard}?module=${id}` href inline, and the
 * bottom-nav re-implemented module validation with a private id check instead
 * of the catalog's `parseClinicModule`.
 *
 * Those surfaces now build the href and read the active module from here, so
 * the query-param key lives in one place and URL parsing always flows through
 * the shared catalog parser — the rail and the bottom-nav can no longer drift
 * on the `?module=` contract.
 *
 * Boundary rule (application layer): no JSX — this coordinates URL/state shape,
 * it does not render UI. It stays route-agnostic (callers pass the base path)
 * and SSR-safe (`window` is guarded).
 *
 * Scope note: the admin/clinic *controllers* keep their own URL-sync,
 * last-module restore and optimistic two-commit navigation effects. Those are
 * pinned verbatim by source-invariant guardrail tests (an intentional
 * anti-drift contract) and diverge structurally between roles (hub vs. no-hub,
 * alias parse, activation buffer), so folding them into a shared hook would
 * either break those contracts or change behavior. Only the safe, common pieces
 * shared by the two clinic nav components live here.
 *
 * @see docs/implementation/dashboard-module-navigation-controller.md
 * @see docs/implementation/dashboard-presentation-boundaries.md
 */
import { parseClinicModule, type ClinicModule } from "../config";
import { ROUTES } from "@/lib/routes";

/** Query-string key that selects the active dashboard module (`?module=`). */
export const MODULE_QUERY_PARAM = "module";

/**
 * Explicit, durable hub intent. The hub is a state of the role's dashboard route,
 * never one of its modules.
 *
 * CMP-02 — the grammar is now declared ONCE for both roles. It used to be
 * admin-only (`ADMIN_HUB_*`), which is why the clinic bottom nav's "Inicio" slot
 * had nowhere to point and silently resolved to the default module instead of an
 * entry surface (audit DIF-041 / RC-015). The `ADMIN_*` names below are retained
 * as delegating aliases so the six existing call sites and their guards keep
 * resolving; they add no second semantics.
 */
export const HUB_QUERY_PARAM = "hub";
export const HUB_QUERY_VALUE = "1";

/** @deprecated CMP-02 — use {@link HUB_QUERY_PARAM}; kept for existing call sites. */
export const ADMIN_HUB_QUERY_PARAM = HUB_QUERY_PARAM;
/** @deprecated CMP-02 — use {@link HUB_QUERY_VALUE}; kept for existing call sites. */
export const ADMIN_HUB_QUERY_VALUE = HUB_QUERY_VALUE;

/** The two dashboard surfaces that own a hub/Inicio destination. */
export type DashboardHubSurface = "admin" | "clinic";

const HUB_BASE_PATH: Record<DashboardHubSurface, string> = {
  admin: ROUTES.dashboardAdmin,
  clinic: ROUTES.dashboard,
};

/** Is the explicit hub/Inicio state requested? Role-agnostic by construction. */
export function isHubRequested(
  searchParams: Pick<URLSearchParams, "get">,
): boolean {
  return searchParams.get(HUB_QUERY_PARAM) === HUB_QUERY_VALUE;
}

/** Build the sole canonical URL for a role's explicit Inicio/hub destination. */
export function buildHubHref(surface: DashboardHubSurface): string {
  return `${HUB_BASE_PATH[surface]}?${HUB_QUERY_PARAM}=${HUB_QUERY_VALUE}`;
}

/** @deprecated CMP-02 — use {@link isHubRequested}. */
export function isAdminHubRequested(
  searchParams: Pick<URLSearchParams, "get">,
): boolean {
  return isHubRequested(searchParams);
}

/** @deprecated CMP-02 — use `buildHubHref("admin")`. */
export function buildAdminHubHref(): string {
  return buildHubHref("admin");
}

/**
 * Read the explicit hub intent from the live browser URL. Returns `false` on the
 * server (no `window`). Client-only by contract, like
 * {@link readClinicModuleFromLocation}.
 */
export function readHubRequestedFromLocation(): boolean {
  if (typeof window === "undefined") return false;
  return isHubRequested(new URLSearchParams(window.location.search));
}

/**
 * Build a `?module=` href for a dashboard module on a given base route. Pure and
 * route-agnostic: callers pass the base path (e.g. `ROUTES.dashboard`). Produces
 * the exact same string the clinic rail and bottom-nav built inline before.
 */
export function buildDashboardModuleHref(
  basePath: string,
  moduleId: string,
): string {
  return `${basePath}?${MODULE_QUERY_PARAM}=${moduleId}`;
}

/**
 * Read and normalize the active clinic module from the live browser URL.
 * Returns `null` on the server (no `window`) or for an absent/unknown value,
 * delegating validation to the catalog's {@link parseClinicModule} instead of a
 * re-declared id check. Client-only by contract (popstate/location reads).
 */
export function readClinicModuleFromLocation(): ClinicModule | null {
  if (typeof window === "undefined") return null;
  return parseClinicModule(
    new URLSearchParams(window.location.search).get(MODULE_QUERY_PARAM),
  );
}
