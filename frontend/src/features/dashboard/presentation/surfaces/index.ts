/**
 * Dashboard · presentation/surfaces (boundary placeholder).
 *
 * Intended home for reusable surface primitives: EmptyState / ErrorState /
 * LoadingState, StatsCards, StatusBadge, FilterBar/Drawer, StickyActionBar,
 * ModuleSurface, ModuleTabs/Dialog, StudyTimeline, ReportDownloadButton and
 * table primitives (audit §5/§6).
 *
 * Boundary rule: presentation does not import `@/lib/api` directly; surfaces
 * are pure presentation driven by props.
 *
 * PR-PRES-5 lands the first real export: `StatusBadge`, exposed through the
 * surfaces boundary as a pure re-export (implementation unchanged, still pinned
 * at `@/components/dashboard/StatusBadge`). See
 * docs/implementation/dashboard-surface-primitives.md.
 */
export * from "./DashboardStatusBadge";
