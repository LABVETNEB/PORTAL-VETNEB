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
 * Empty on purpose: PR-PRES-2 only draws the architecture boundary (see
 * docs/implementation/dashboard-presentation-boundaries.md).
 */
export {};
