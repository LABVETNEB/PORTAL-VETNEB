/**
 * Dashboard · presentation/shell (B01 re-export boundary).
 *
 * Home for the persistent app-shell chrome: PrivateDashboardShell,
 * DashboardShellRouter, DashboardModuleWorkspace, DashboardModuleHub and
 * DashboardHubHero (audit §6).
 *
 * B01 populates this barrel with **behaviour-preserving re-exports**: nothing is
 * moved, reimplemented or renamed, and no consumer is migrated. The
 * implementations stay pinned at `@/components/dashboard/*` because their source
 * is anchored by source-invariant guardrails, so the rendered DOM, class names
 * and `data-*` contract attributes are untouched. This is the sanctioned
 * "reexportar durante la migración" step of audit §47.2 / mitigation R14: the
 * barrel becomes the declared import surface while both grammars coexist.
 *
 * Boundary rule: presentation does not reach the data layer. Neither this
 * barrel nor any module it re-exports may import `@/lib/api` or the `app/`
 * layer — enforced by
 * `test/architecture/dashboard-presentation-import-boundaries.test.ts`, which
 * follows every re-export into its legacy target instead of only scanning this
 * folder.
 *
 * `DashboardTopbar` is deliberately absent: it still imports `@/lib/api`
 * directly, so exposing it here would launder that violation through the
 * boundary. It is admitted automatically once that import is gone; B01 does not
 * modify it.
 *
 * @see docs/implementation/dashboard-presentation-shell-navigation-barrels.md
 * @see docs/implementation/dashboard-presentation-boundaries.md
 */
export { DashboardShellRouter } from "@/components/dashboard/DashboardShellRouter";
export {
  PrivateDashboardShell,
  type PrivateDashboardShellProps,
} from "@/components/dashboard/PrivateDashboardShell";
export { DashboardModuleWorkspace } from "@/components/dashboard/DashboardModuleWorkspace";
export {
  DashboardModuleHub,
  type DashboardModuleCard,
} from "@/components/dashboard/DashboardModuleHub";
export {
  DashboardHubHero,
  type DashboardHubHeroMetric,
  type DashboardHubHeroProps,
  type DashboardHubHeroStatusTone,
} from "@/components/dashboard/DashboardHubHero";
