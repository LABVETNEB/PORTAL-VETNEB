/**
 * Dashboard · presentation/surfaces · StatusBadge entry (PR-PRES-5).
 *
 * First concrete surface primitive exposed through the presentation boundary.
 * It re-exports the already-clean `StatusBadge` primitive verbatim — same
 * component, same props, same rendered DOM/className/`data-*`. Nothing is moved
 * or reimplemented: the implementation stays at
 * `@/components/dashboard/StatusBadge` because its source is pinned by
 * source-invariant guardrails (see
 * `test/frontend-dashboard-private-shell-foundation.test.ts`). This module only
 * makes the primitive reachable from
 * `@/features/dashboard/presentation/surfaces` so later presentation code can
 * import it through the declared boundary instead of reaching across trees.
 *
 * This is the sanctioned "re-export puro" first step (audit §9): no consumer is
 * migrated yet, so no import contract changes and no behavior changes.
 *
 * Boundary rule: surfaces are pure presentation driven by props and must not
 * import `@/lib/api`.
 *
 * @see docs/implementation/dashboard-surface-primitives.md
 * @see docs/audit/dashboard-presentation-primitives-architecture-audit.md
 */
export {
  StatusBadge,
  type StatusBadgeProps,
} from "@/components/dashboard/StatusBadge";
