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

/** Explicit, durable admin-hub intent. The hub is not an admin module. */
export const ADMIN_HUB_QUERY_PARAM = "hub";
export const ADMIN_HUB_QUERY_VALUE = "1";

export function isAdminHubRequested(
  searchParams: Pick<URLSearchParams, "get">,
): boolean {
  return searchParams.get(ADMIN_HUB_QUERY_PARAM) === ADMIN_HUB_QUERY_VALUE;
}

/** Build the sole canonical URL for the explicit admin Inicio/hub destination. */
export function buildAdminHubHref(): string {
  return `${ROUTES.dashboardAdmin}?${ADMIN_HUB_QUERY_PARAM}=${ADMIN_HUB_QUERY_VALUE}`;
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
