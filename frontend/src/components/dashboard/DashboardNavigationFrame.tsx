"use client";

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_CLINIC_MODULE,
  parseAdminModule,
  parseClinicModule,
  type ClinicModule,
} from "@/features/dashboard/config";
import { MODULE_QUERY_PARAM } from "@/features/dashboard/application";
import { NavigationDrawer, type NavigationDrawerProps } from "./NavigationDrawer";
import { NavigationRail } from "./NavigationRail";
import { useAdminStageModule, useClinicStageModule } from "./useStageModule";

/**
 * B08 - the lateral navigation frame.
 *
 * The single mount site of the B07 primitives. It is the one row of the shell
 * that holds the navigation band and the workspace side by side:
 *
 * ```text
 * app shell (column)
 *   header  -> WorkspaceAppBar, full width, 56px band (B06)
 *   frame   -> [ NavigationDrawer | NavigationRail ]  +  <main>
 * ```
 *
 * WHY A FRAME AND NOT SEVEN WIRINGS. Seven surfaces lost the horizontal nav
 * (the admin shell, the clinic module shell and the five clinic full routes).
 * Resolving "which module is active" once, here, is what keeps those seven from
 * drifting the way the legacy nav and the legacy rail did. It is deliberately
 * NOT a generic scaffold: it owns no toolbar, no filters and no collection
 * region - that is B15 - and it does not fold the full routes into the clinic
 * controller - that is B10.
 *
 * INLINE SIZE, NEVER VERTICAL BUDGET. The band is a real flex item in a real
 * row, not a fixed/absolute overlay: `main` receives the remaining inline size
 * and the full block size. Nothing here transitions an inline-size, a
 * block-size or a flex-basis, because a size transition feeds the
 * ResizeObserver behind the adaptive capacity engine (R11/A03).
 *
 * ACTIVE MODULE, PER ROUTE. Two grammars, both derived from an owner:
 *  - `?module=` surfaces (admin, and the clinic module shell) read the live URL
 *    through the catalog parsers, which is what the retired horizontal nav did
 *    and what keeps `aria-current` correct across click, deep link, reload,
 *    Back and Forward.
 *  - the clinic full routes declare their module (`module="informes"`,
 *    `module="logistica"`), because `?module=` is not part of their grammar.
 *
 * CURRENT ITEM = STAGE MODULE. A `?module=` switch is a navigation of a
 * dynamic page, so the URL only commits once the whole server render has
 * arrived - seconds on a slow backend - and a superseded navigation can commit
 * before the latest one. The stage owner swaps on the activation signal and
 * classifies every commit; the band renders the module that owner publishes
 * (`lib/dashboard/navigation/stageModule.ts`), so band and stage move together
 * on the click and neither follows a stale commit. The URL is read only while
 * no owner is mounted: the server render, and a full route on its own module.
 *
 * ADMIN HUB IS A LEGAL STATE. `?hub=1` is the durable explicit hub URL and
 * null is retained while an optimistic navigation settles. B13 gives that
 * state an Inicio item instead of leaving the lateral landmark without a
 * current destination.
 *
 * OWNERSHIP. This frame renders; it owns nothing, not even a pending
 * activation: that belongs to the stage owner. Module ids, order and labels
 * come from `features/dashboard/config`, the `?module=` key from
 * `features/dashboard/application`, and the geometry (256/80/40/56 px) from
 * `styles/dashboard/tokens.css` - never restated here.
 *
 * @see docs/implementation/dashboard-b08-navigation-migration.md
 */

export type DashboardNavigationFrameProps = {
  readonly children: ReactNode;
} & (
  | {
      readonly surface: "admin";
      /** Admin resolves its module from the URL; the hub is a null state. */
      readonly module?: never;
    }
  | {
      readonly surface: "clinic";
      /**
       * Fixed module for the clinic full routes, whose grammar has no
       * `?module=`. Omitted on `/dashboard`, where the URL decides.
       */
      readonly module?: ClinicModule;
    }
);

/**
 * The two primitives, mounted together. Only one is ever painted: the CSS band
 * reveals the rail at 768-1279px and the drawer from 1280px, and hides both
 * below 768px, where the mobile model B09 owns applies.
 */
function LateralNavigation(props: NavigationDrawerProps) {
  return (
    <>
      <NavigationDrawer {...props} />
      <NavigationRail {...props} />
    </>
  );
}

function AdminUrlNavigation() {
  const searchParams = useSearchParams();
  const staged = useAdminStageModule();
  const activeModule =
    staged === undefined
      ? parseAdminModule(searchParams.get(MODULE_QUERY_PARAM))
      : parseAdminModule(staged);

  return <LateralNavigation surface="admin" activeModule={activeModule} />;
}

function ClinicUrlNavigation() {
  const searchParams = useSearchParams();
  const staged = useClinicStageModule();
  // The hub (a null stage) keeps the operational default current, as `?hub=1`
  // always did here.
  const activeModule =
    staged === undefined
      ? parseClinicModule(searchParams.get(MODULE_QUERY_PARAM))
      : parseClinicModule(staged);

  return (
    <LateralNavigation
      surface="clinic"
      activeModule={activeModule ?? DEFAULT_CLINIC_MODULE}
    />
  );
}

// Every band destination leaves a full route for `/dashboard`, a different page
// whose server render can take seconds; pinning the item to the route's module
// kept it there for the whole wait. The route's stage publishes the destination
// while it hands over, and nothing once Back/Forward keeps the route.
function ClinicRouteNavigation({ routeModule }: { readonly routeModule: ClinicModule }) {
  const staged = useClinicStageModule();
  const activeModule = staged === undefined ? routeModule : parseClinicModule(staged);

  return (
    <LateralNavigation surface="clinic" activeModule={activeModule ?? routeModule} />
  );
}

export function DashboardNavigationFrame({
  surface,
  module: routeModule,
  children,
}: DashboardNavigationFrameProps) {
  const isAdmin = surface === "admin";

  // The Suspense fallback renders the SAME band with the same width, so the
  // suspended tick cannot move `main`: only the active highlight is deferred.
  const urlFallback = isAdmin ? (
    <LateralNavigation surface="admin" activeModule={null} />
  ) : (
    <LateralNavigation surface="clinic" activeModule={DEFAULT_CLINIC_MODULE} />
  );

  return (
    <div
      className="dashboard-navigation-frame"
      data-dashboard-navigation-frame={surface}
    >
      {routeModule ? (
        <ClinicRouteNavigation routeModule={routeModule} />
      ) : (
        <Suspense fallback={urlFallback}>
          {isAdmin ? <AdminUrlNavigation /> : <ClinicUrlNavigation />}
        </Suspense>
      )}
      {children}
    </div>
  );
}
