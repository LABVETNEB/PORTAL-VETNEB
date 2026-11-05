"use client";

import type { ReactNode } from "react";

/**
 * B06 - WorkspaceAppBar, level 4 of the dashboard shell.
 *
 * The single persistent band at the top of every authenticated workspace:
 * identity, global search, actions, notifications and account. Its
 * geometry contract is `--dash-app-bar-h` (64px since V6) with a +/-2px band, authored in
 * `styles/dashboard/tokens.css` and applied in `styles/dashboard/layout.css` -
 * never restated as a literal here.
 *
 * PRESENTATION-PURE by contract. Nothing in this module import closure may
 * reach `@/lib/api` or the `app/` layer, which is what lets it be re-exported
 * from `features/dashboard/presentation/shell` (enforced by
 * `test/architecture/dashboard-presentation-import-boundaries.test.ts`). Every
 * behaviour that needs the data layer - logout, admin/clinic session
 * invalidation, notifications, theme, the admin overflow menu and, since
 * GLOBAL-SEARCH-2, the record search "Buscar en VETNEB" (it calls the search
 * API) - is INJECTED as an already-rendered slot by `DashboardTopbar`, which
 * stays the orchestrator.
 * The bar renders those slots; it never learns what they do.
 *
 * Geometry note (A03): the band participates in the shell height ledger, so its
 * box is BOUNDED, not pinned. `layout.css` declares the 62-66px band as
 * `min-block-size`/`max-block-size`; the row keeps its measured intrinsic height
 * inside that band, so the rows canvas below it - and therefore every adaptive
 * `limit` frozen by A03 - is left exactly where it was. Pinning a point value
 * instead would move `main` and re-page the 15 adaptive consumers.
 *
 * @see docs/implementation/dashboard-b06-workspace-app-bar.md
 */

export type WorkspaceAppBarProps = {
  /** Title/subtitle block. Owned by the orchestrator (aria wiring lives there). */
  readonly identity: ReactNode;
  /** Utility actions (theme, density...). */
  readonly actions?: ReactNode;
  /** Notification affordance. */
  readonly notifications?: ReactNode;
  /** Account/session affordance. */
  readonly account?: ReactNode;
  /** Compact overflow menu rendered outside the desktop action cluster. */
  readonly overflow?: ReactNode;
  /** Global record search (GLOBAL-SEARCH-2). Owned by the orchestrator. */
  readonly search?: ReactNode;
};

export function WorkspaceAppBar({
  identity,
  actions,
  notifications,
  account,
  overflow,
  search,
}: WorkspaceAppBarProps) {
  return (
    <div
      className="flex min-h-[2.75rem] min-w-0 items-center justify-between gap-2 px-3 py-1.5 sm:min-h-[2.5rem] sm:gap-3 sm:px-6 md:py-2"
      data-workspace-app-bar="true"
    >
      {identity}

      {search}

      <div
        className="ml-2 flex shrink-0 items-center gap-1.5 sm:ml-3 sm:gap-3"
        data-dashboard-desktop-actions="true"
      >
        {actions}
        {notifications}
        {account}
      </div>
      {overflow}
    </div>
  );
}
