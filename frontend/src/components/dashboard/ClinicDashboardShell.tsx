import type { CSSProperties, ReactNode } from "react";

import type { ClinicModule } from "@/features/dashboard/config";
import { DashboardTopbar } from "./DashboardTopbar";
import { DashboardNavigationFrame } from "./DashboardNavigationFrame";

/**
 * B10 - the single clinic app shell.
 *
 * WHAT IT OWNS, AND NOTHING ELSE. Three things, in this order: the B06 app bar
 * (through `DashboardTopbar`), the B08 lateral frame, and the `<main>` region.
 * Before B10 those three were re-declared verbatim by each of the six clinic
 * routes, so "which surface am I, and does the workspace hang off a frame"
 * was answered six times instead of once. That is the residue of P0-04 that
 * B08 and B09 left behind: the horizontal nav and the module rail are gone, so
 * the two shells no longer differ in their BANDS - they differed in who
 * declared them.
 *
 * IT IS NOT A SCAFFOLD. No header, no toolbar, no filter region, no collection
 * region, no side panel. The module header stays split between
 * `DashboardModuleWorkspace` (the `/dashboard` stage) and `DashboardPageHeader`
 * (the full routes) on purpose: unifying it changes the module header's
 * geometry and its permanent description, which is B11, and folding both into
 * one scaffold is B15 (audit §14.2, §49).
 *
 * NO GEOMETRY OF ITS OWN (A03/A08). This component introduces no wrapper
 * between the frame and `<main>`, and declares no `overflow`, `height`,
 * `min-height`, `flex-basis` or transition. The height ledger is exactly the
 * one `styles/dashboard/*` already owns, so the rows canvas every adaptive
 * consumer measures - and therefore every `limit` frozen by A03 - is left
 * where it was. A size transition here would feed the ResizeObserver behind
 * the capacity engine (R11).
 *
 * DIRECT CHILDREN ARE CONTRACTUAL. `children` land as the direct children of
 * `<main>`, in route order, because two shipped rules read that position:
 * the rhythm owl `.dashboard-main > :not([hidden]) ~ :not([hidden])`
 * (responsive.css) and `.dashboard-main:has(> [data-sticky-action-bar="true"])`
 * (zero-scroll.css). B09 already paid for forgetting this once: retiring the
 * rail turned a second child into an only child and silently dropped one
 * `--dash-rhythm` at all 13 viewports.
 *
 * SERVER COMPONENT ON PURPOSE. No `"use client"`, so the client boundary stays
 * exactly where the routes put it: the topbar and the frame remain the client
 * leaves of a server route, and `children` keep rendering on the server.
 *
 * NOT A PRESENTATION EXPORT. `DashboardTopbar` reaches `@/lib/api` for logout,
 * so re-exporting this shell from `features/dashboard/presentation/*` would
 * launder the data layer across the boundary that
 * `test/architecture/dashboard-presentation-import-boundaries.test.ts` walks -
 * the same reason the topbar itself is absent from that barrel.
 *
 * @see docs/implementation/dashboard-b10-clinic-shell-unification.md
 */

export type ClinicDashboardShellProps = {
  /** App-bar title for this route. */
  readonly title: string;
  /** App-bar subtitle for this route. */
  readonly subtitle: string;
  /**
   * Active module for the full routes, whose grammar has no `?module=`.
   * Omitted on `/dashboard`, where the frame reads the URL itself.
   */
  readonly module?: ClinicModule;
  /**
   * Style carried by `<main>`. Only `/dashboard/logistica` uses it, to publish
   * the sticky-action ledger var; the value stays declared in that route so the
   * reservation it feeds keeps a single source.
   */
  readonly mainStyle?: CSSProperties;
  /** Marks `<main>` as the adaptive reservation root (A05). */
  readonly mainAdaptiveReservation?: boolean;
  readonly children: ReactNode;
};

export function ClinicDashboardShell({
  title,
  subtitle,
  module,
  mainStyle,
  mainAdaptiveReservation,
  children,
}: ClinicDashboardShellProps) {
  return (
    <>
      <DashboardTopbar
        title={title}
        subtitle={subtitle}
        notifications="clinic"
      />
      <DashboardNavigationFrame surface="clinic" module={module}>
        <main
          className="dashboard-main"
          data-dashboard-adaptive-reservation={
            mainAdaptiveReservation ? "true" : undefined
          }
          style={mainStyle}
        >
          {children}
        </main>
      </DashboardNavigationFrame>
    </>
  );
}
