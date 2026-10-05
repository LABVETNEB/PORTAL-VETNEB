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
/** C01 collection primitives; implementation extends the `ui/table` base (audit §14.2). */
export {
  CollectionWorkspace,
  CollectionHeader,
  ContentList,
  ContentListItem,
  type ContentListProps,
  type ContentListItemProps,
} from "@/components/ui/table";
/** C02 collection pager; the legacy `DashboardPager`/`CompactPager` names are its adapters. */
export {
  CollectionPager,
  type CollectionPagerProps,
  type CollectionPagerCenteredProps,
  type CollectionPagerCompactProps,
} from "@/components/dashboard/DashboardPager";
/** C03 collection states; the legacy `EmptyState`/`ErrorState`/`LoadingState` names are its adapters. */
export {
  CollectionState,
  type CollectionStateProps,
  type CollectionStateEmptyProps,
  type CollectionStateErrorProps,
  type CollectionStateLoadingProps,
  type CollectionStateSkeleton,
} from "@/components/dashboard/EmptyState";
/** C06 collection selection: state only, keyed by item ID; actions on the selection belong to C07/C09. */
export {
  useCollectionSelection,
  type CollectionSelection,
  type CollectionSelectionId,
  type CollectionSelectionOptions,
} from "./useCollectionSelection";
/** C07 contextual toolbar: DefaultToolbar ⇄ SelectionToolbar on the C06 owner; bulk actions are C09. */
export { SelectionToolbar, type SelectionToolbarProps } from "./SelectionToolbar";
