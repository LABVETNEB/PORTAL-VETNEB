"use client";

import {
  Suspense,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  HUB_QUERY_PARAM,
  MODULE_QUERY_PARAM,
  buildDashboardModuleHref,
  buildHubHref,
  isHubRequested,
} from "@/features/dashboard/application";
import {
  ADMIN_MODULE_IDS,
  CLINIC_MODULE_IDS,
  DEFAULT_ADMIN_MODULE,
  DEFAULT_CLINIC_MODULE,
  parseAdminModule,
  parseClinicModule,
  type AdminModule,
  type ClinicModule,
} from "@/features/dashboard/config";
import { registerAdminNavigationOwner } from "@/lib/admin-hub-reset";
import { registerClinicNavigationOwner } from "@/lib/clinic-hub-reset";
import {
  ADMIN_LAST_MODULE_STORAGE_KEY,
  CLINIC_LAST_MODULE_STORAGE_KEY,
  readDashboardLastModule,
  writeDashboardLastModule,
} from "@/lib/dashboard-last-module";
import { clinicModuleHref } from "@/lib/dashboard/navigation/clinicNavigationState";
import {
  createNavigationCoordinator,
  previewDisplay,
  sameNavLocation,
  type NavigationCoordinator,
  type NavigationMachine,
} from "@/lib/dashboard/navigation/dashboardNavigationCoordinator";
import {
  initial,
  transition,
  type MachineConfig,
  type NavLocation,
} from "@/lib/dashboard/navigation/dashboardNavigationMachine";
import { NAVIGATION_FLIGHT_BUDGET_MS } from "@/lib/dashboard/navigation/navigationFlight";
import { installSupersededFlightGuard } from "@/lib/dashboard/navigation/supersededFlightGuard";
import { ROUTES } from "@/lib/routes";

/**
 * Owner of module navigation on the dashboard: `/dashboard/admin` (PR-NAV-03)
 * and the clinic surface, `/dashboard` with its hub (PR-NAV-04).
 *
 * A thin wrapper over the coordinator of §12.5.1: the store is created in
 * render with HYDRATED applied (A1), mounted in a passive effect (A4),
 * unmounted (A8) and handed the events. Every decision is the machine's; every
 * effect runs from the coordinator's queue, never from render.
 *
 * One store per surface. The clinic store lives across `/dashboard` and its
 * full routes, which is what lets it leave FAILED when the pathname changes;
 * the stage of a full route and "Abrir módulo completo" are views of it too
 * (PR-NAV-05). Crossing between the two surfaces starts a new store.
 *
 * The provider itself never reads the search params and never wraps its
 * children in a boundary: the layout also serves statically prerendered
 * routes, and a boundary around the page would make the server send the page
 * twice. What needs the URL reads it where it renders — the owner below, a
 * sibling of the children, and each consumer of the display.
 *
 * @see docs/implementation/dashboard-navigation-fsm-admin.md
 * @see docs/implementation/dashboard-navigation-fsm-clinic.md
 * @see docs/implementation/dashboard-navigation-fsm-full-routes.md
 */

type RouterLike = ReturnType<typeof useRouter>;
type UrlQuery = Pick<URLSearchParams, "get" | "has">;

const MACHINE: NavigationMachine = { initial, transition };

const NO_MODULE: NavLocation = { kind: "none" };
const HUB: NavLocation = { kind: "hub" };

type Located = {
  readonly location: NavLocation;
  /** The URL had `module` or `hub`, valid or not (HYDRATED.explicit). */
  readonly explicit: boolean;
};

type NavigationOwner = {
  /** `true` when the selection was dispatched to the machine. */
  readonly selectModule: (moduleId: string) => boolean;
  readonly selectHub: () => void;
};

/** What tells one surface from the other; the owner below is the same for both. */
type NavigationSurface = {
  readonly config: MachineConfig;
  readonly storageKey: string;
  readonly parseModule: (value: string | null) => string | null;
  /** The surface's reading of a URL, or `null` when the URL is not its own. */
  readonly locate: (pathname: string, query: UrlQuery) => Located | null;
  readonly href: (location: NavLocation) => string;
  readonly registerOwner: (owner: NavigationOwner) => () => void;
};

function isExplicit(query: UrlQuery): boolean {
  return query.has(MODULE_QUERY_PARAM) || query.has(HUB_QUERY_PARAM);
}

const ADMIN_CONFIG: MachineConfig = {
  surface: "admin",
  modules: ADMIN_MODULE_IDS,
  defaultModule: DEFAULT_ADMIN_MODULE,
};

function adminLocation(moduleId: AdminModule | null): NavLocation {
  return moduleId === null ? NO_MODULE : { kind: "module", module: moduleId };
}

function adminHref(location: NavLocation): string {
  return location.kind === "module"
    ? buildDashboardModuleHref(ROUTES.dashboardAdmin, location.module)
    : ROUTES.dashboardAdmin;
}

const ADMIN_SURFACE: NavigationSurface = {
  config: ADMIN_CONFIG,
  storageKey: ADMIN_LAST_MODULE_STORAGE_KEY,
  parseModule: parseAdminModule,
  locate(pathname, query) {
    if (pathname !== ROUTES.dashboardAdmin) return null;
    return {
      location: adminLocation(parseAdminModule(query.get(MODULE_QUERY_PARAM))),
      explicit: isExplicit(query),
    };
  },
  href: adminHref,
  registerOwner: registerAdminNavigationOwner,
};

const CLINIC_CONFIG: MachineConfig = {
  surface: "clinic",
  modules: CLINIC_MODULE_IDS,
  defaultModule: DEFAULT_CLINIC_MODULE,
};

const CLINIC_ROUTES_PREFIX = `${ROUTES.dashboard}/`;

function isClinicPath(pathname: string): boolean {
  if (pathname === ROUTES.dashboard) return true;
  return (
    pathname.startsWith(CLINIC_ROUTES_PREFIX) &&
    pathname !== ROUTES.dashboardAdmin &&
    !pathname.startsWith(`${ROUTES.dashboardAdmin}/`)
  );
}

function clinicLocation(pathname: string, query: UrlQuery): NavLocation {
  if (pathname !== ROUTES.dashboard) {
    // A full route names its module in the segment below `/dashboard`, the
    // grammar the mobile bar already reads. One that names none stores nothing.
    const segment = pathname.slice(CLINIC_ROUTES_PREFIX.length).split("/")[0];
    return { kind: "route", path: pathname, module: parseClinicModule(segment) ?? "" };
  }
  if (isHubRequested(query)) return HUB;
  return {
    kind: "module",
    module: parseClinicModule(query.get(MODULE_QUERY_PARAM)) ?? DEFAULT_CLINIC_MODULE,
  };
}

function clinicHref(location: NavLocation): string {
  // The default module has more than one URL (`/dashboard`, `?module=operaciones`,
  // an unknown `?module=`). A push of the location on screen (#25, #32) must be
  // a push of the URL on screen, or it would add the entry it exists to avoid.
  const shown = clinicLocation(window.location.pathname, new URLSearchParams(window.location.search));
  if (isClinicPath(window.location.pathname) && sameNavLocation(shown, location)) {
    return `${window.location.pathname}${window.location.search}`;
  }
  if (location.kind === "module") {
    return clinicModuleHref(ROUTES.dashboard, DEFAULT_CLINIC_MODULE, location.module);
  }
  if (location.kind === "hub") return buildHubHref("clinic");
  return location.kind === "route" ? location.path : ROUTES.dashboard;
}

const CLINIC_SURFACE: NavigationSurface = {
  config: CLINIC_CONFIG,
  storageKey: CLINIC_LAST_MODULE_STORAGE_KEY,
  parseModule: parseClinicModule,
  locate(pathname, query) {
    if (!isClinicPath(pathname)) return null;
    return {
      location: clinicLocation(pathname, query),
      explicit: pathname === ROUTES.dashboard && isExplicit(query),
    };
  },
  href: clinicHref,
  registerOwner: registerClinicNavigationOwner,
};

const SURFACES: readonly NavigationSurface[] = [ADMIN_SURFACE, CLINIC_SURFACE];

function createStore(
  surface: NavigationSurface,
  router: RouterLike,
  { location, explicit }: Located,
): NavigationCoordinator {
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  return createNavigationCoordinator(
    MACHINE,
    surface.config,
    {
      type: "HYDRATED",
      location,
      explicit,
      storedModule: surface.parseModule(readDashboardLastModule(surface.storageKey)),
    },
    {
      scheduleMicrotask: (drain) => queueMicrotask(drain),
      navigate(effect) {
        const href = surface.href(effect.to);
        if (effect.type === "ROUTER_PUSH") router.push(href, { scroll: false });
        else if (effect.type === "ROUTER_REPLACE") router.replace(href, { scroll: false });
        else if (effect.mode === "assign") window.location.assign(href);
        else window.location.replace(href);
      },
      persist: (moduleId) => writeDashboardLastModule(surface.storageKey, moduleId),
      armBudget(navId, expire) {
        timers.set(navId, setTimeout(expire, NAVIGATION_FLIGHT_BUDGET_MS));
      },
      cancelBudget(navId) {
        clearTimeout(timers.get(navId));
        timers.delete(navId);
      },
      reportError: (error) => reportError(error),
    },
  );
}

/**
 * One store per visit to a surface. A1: whichever component renders first with
 * the URL in hand creates it; the rest get the same one. A store that React
 * discards with its render never ran anything.
 */
type StoreSlot = {
  readonly surface: NavigationSurface;
  readonly resolve: (router: RouterLike, located: Located) => NavigationCoordinator;
};

function createStoreSlot(surface: NavigationSurface): StoreSlot {
  let store: NavigationCoordinator | null = null;
  return {
    surface,
    resolve(router, located) {
      store ??= createStore(surface, router, located);
      return store;
    },
  };
}

const StoreSlotContext = createContext<StoreSlot | null>(null);

type NavigationSource = {
  readonly surface: NavigationSurface;
  readonly store: NavigationCoordinator;
  /** The surface's location of the URL this render sees. */
  readonly location: NavLocation;
};

/**
 * The owner mounted above, or `null` when there is none or it is not `only`'s.
 * Reads the search params: call it under a boundary.
 */
function useNavigationSource(only?: NavigationSurface): NavigationSource | null {
  const slot = useContext(StoreSlotContext);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const owned = slot !== null && (only === undefined || slot.surface === only) ? slot : null;
  const located = owned === null ? null : owned.surface.locate(pathname, searchParams);
  // A new object per render: its text is what tells a URL change apart.
  const urlKey = located === null ? null : JSON.stringify(located);

  return useMemo(() => {
    if (owned === null || urlKey === null) return null;
    const seen = JSON.parse(urlKey) as Located;
    return { surface: owned.surface, store: owned.resolve(router, seen), location: seen.location };
  }, [owned, router, urlKey]);
}

type NavigateEventLike = Event & {
  readonly navigationType?: string;
  readonly destination?: { readonly url?: string };
};

/** TRAVERSE_STARTED: Navigation API when present, `popstate` otherwise. */
function subscribeTraversals(store: NavigationCoordinator, surface: NavigationSurface): () => void {
  const started = (href: string | undefined) => {
    if (href === undefined) return;
    const url = new URL(href, window.location.href);
    const destination = surface.locate(url.pathname, url.searchParams)?.location ?? null;
    if (destination !== null) store.dispatch({ type: "TRAVERSE_STARTED", destination });
  };
  const navigation = (window as Window & { navigation?: EventTarget }).navigation;

  if (navigation) {
    const onNavigate = (event: Event) => {
      const navigate = event as NavigateEventLike;
      if (navigate.navigationType === "traverse") started(navigate.destination?.url);
    };
    navigation.addEventListener("navigate", onNavigate);
    return () => navigation.removeEventListener("navigate", onNavigate);
  }

  // `popstate` fires after the URL moved: the destination is the location.
  const onPopState = () => started(window.location.href);
  window.addEventListener("popstate", onPopState);
  return () => window.removeEventListener("popstate", onPopState);
}

/** Renders nothing: it is the store's lifecycle and its URL commits. */
function NavigationOwner() {
  const source = useNavigationSource();
  const store = source?.store ?? null;
  const surface = source?.surface ?? null;
  const location = source?.location ?? NO_MODULE;

  // URL_COMMITTED, in the layout effect of the commit that moved the URL. The
  // consumers previewed it in that same render (`useNavigationView`).
  useLayoutEffect(() => {
    store?.commit(location);
  }, [store, location]);

  // A4 / A8. Passive on purpose: a layout effect would drain before the
  // boundary's own passive effect of the same commit had dispatched NAV_FAILED.
  useEffect(() => {
    if (store === null || surface === null) return undefined;
    store.mount();
    const unsubscribeTraversals = subscribeTraversals(store, surface);
    const unregisterOwner = surface.registerOwner({
      selectModule(moduleId) {
        const parsed = surface.parseModule(moduleId);
        const tag = store.getSnapshot().state.tag;
        // DT-10: the machine ignores these selections, so the chrome keeps them.
        if (parsed === null || tag === "BOOTING" || tag === "FAILED") return false;
        store.dispatch({ type: "SELECT_MODULE", module: parsed });
        return true;
      },
      selectHub() {
        store.dispatch({ type: "SELECT_HUB" });
      },
    });

    return () => {
      unregisterOwner();
      unsubscribeTraversals();
      store.unmount();
    };
  }, [store, surface]);

  return null;
}

function surfaceOf(pathname: string): NavigationSurface | null {
  return SURFACES.find((surface) => surface.locate(pathname, new URLSearchParams()) !== null) ?? null;
}

/**
 * Mounted by the dashboard layout. It reads the pathname only: which surface
 * the route belongs to, so the store of one is never reachable from the other.
 */
export function DashboardNavigationProvider({ children }: { children: ReactNode }) {
  const surface = surfaceOf(usePathname());
  const [held, setHeld] = useState<StoreSlot | null>(() => (surface === null ? null : createStoreSlot(surface)));
  const slot = surface === null ? null : held?.surface === surface ? held : createStoreSlot(surface);
  if (slot !== held) setHeld(slot);

  // D-10: a superseded payload's failure must not reload over the latest selection.
  useEffect(() => installSupersededFlightGuard(window), []);

  return (
    <StoreSlotContext.Provider value={slot}>
      {slot === null ? null : (
        // The owner reads the search params; the boundary is where the build's
        // prerender attempt of a route bails out. It has nothing to show.
        <Suspense fallback={null}>
          <NavigationOwner />
        </Suspense>
      )}
      {children}
    </StoreSlotContext.Provider>
  );
}

const subscribeToNothing = () => () => {};
const noSnapshot = () => null;

type NavigationView = {
  readonly store: NavigationCoordinator;
  /** The machine's `display`, with the URL of this render already delivered. */
  readonly display: NavLocation;
  /** The navigation outlived its budget (STALLED). */
  readonly stalled: boolean;
};

/**
 * A surface's navigation as its stage and chrome render it, or `null` when its
 * owner is not the one mounted. The display is previewed in the same render,
 * and commit, as the URL (§11.3).
 */
function useNavigationView(surface: NavigationSurface): NavigationView | null {
  const source = useNavigationSource(surface);
  const store = source?.store ?? null;
  const snapshot = useSyncExternalStore(
    store === null ? subscribeToNothing : store.subscribe,
    store === null ? noSnapshot : store.getSnapshot,
    store === null ? noSnapshot : store.getSnapshot,
  );

  if (source === null || store === null || snapshot === null) return null;
  return {
    store,
    display: previewDisplay(MACHINE, surface.config, snapshot, source.location),
    stalled: snapshot.state.tag === "STALLED",
  };
}

export type AdminDashboardNavigation = {
  /** What stage and chrome show: the machine's `display`. `null`: no module. */
  readonly module: AdminModule | null;
  /** The navigation outlived its budget (STALLED). */
  readonly stalled: boolean;
  /** Leaves STALLED through a document navigation (RETRY). */
  readonly retry: () => void;
};

/**
 * The admin navigation as stage and chrome render it. `null` outside
 * `/dashboard/admin`: no admin owner is mounted. Reads the search params.
 */
export function useAdminDashboardNavigation(): AdminDashboardNavigation | null {
  const view = useNavigationView(ADMIN_SURFACE);
  const store = view?.store ?? null;
  const displayModule = view?.display.kind === "module" ? parseAdminModule(view.display.module) : null;
  const stalled = view?.stalled ?? false;

  return useMemo(
    () =>
      store === null
        ? null
        : { module: displayModule, stalled, retry: () => store.dispatch({ type: "RETRY" }) },
    [store, displayModule, stalled],
  );
}

export type ClinicDashboardNavigation = {
  /** The module the machine's `display` names; `null` while it is the hub or a full route. */
  readonly module: ClinicModule | null;
  /** The `display` is the hub. */
  readonly hub: boolean;
  /** The path of the full route the `display` names; `null` while it is a module or the hub. */
  readonly route: string | null;
  /** The navigation outlived its budget (STALLED). */
  readonly stalled: boolean;
  /** Leaves STALLED through a document navigation (RETRY). */
  readonly retry: () => void;
  /** OPEN_ROUTE. `false`: the machine would ignore it and the caller navigates (DT-10). */
  readonly openRoute: (href: string) => boolean;
};

const NO_QUERY = new URLSearchParams();

/**
 * The clinic navigation as its stages render it, on `/dashboard` and on a full
 * route. `null` when no clinic owner is mounted. Reads the search params.
 */
export function useClinicDashboardNavigation(): ClinicDashboardNavigation | null {
  const view = useNavigationView(CLINIC_SURFACE);
  const store = view?.store ?? null;
  const displayModule = view?.display.kind === "module" ? parseClinicModule(view.display.module) : null;
  const hub = view?.display.kind === "hub";
  const route = view?.display.kind === "route" ? view.display.path : null;
  const stalled = view?.stalled ?? false;

  return useMemo(
    () =>
      store === null
        ? null
        : {
            module: displayModule,
            hub,
            route,
            stalled,
            retry: () => store.dispatch({ type: "RETRY" }),
            openRoute(href) {
              // A full route is its pathname: an href that carries anything
              // else names no module of the surface and is declined (#6).
              const target = CLINIC_SURFACE.locate(href, NO_QUERY)?.location;
              if (target?.kind !== "route" || parseClinicModule(target.module) === null) return false;
              const tag = store.getSnapshot().state.tag;
              if (tag === "BOOTING" || tag === "FAILED") return false;
              store.dispatch({ type: "OPEN_ROUTE", path: target.path, module: target.module });
              return true;
            },
          },
    [store, displayModule, hub, route, stalled],
  );
}

export type NavigationBoundarySignals = {
  /** The error boundary mounted: NAV_FAILED. */
  readonly failed: () => void;
  /** The boundary is leaving, by "Reintentar" or by unmount: RESET. */
  readonly left: () => void;
};

/**
 * Stable per owner, so the boundary's effect runs once per mount. The owner is
 * whichever surface the route belongs to; `null` when there is none.
 */
export function useDashboardNavigationBoundary(): NavigationBoundarySignals | null {
  const source = useNavigationSource();
  const store = source?.store ?? null;

  return useMemo(
    () =>
      store === null
        ? null
        : {
            failed: () => store.dispatch({ type: "NAV_FAILED", reason: "unknown" }),
            // The committed location as the owner last delivered it: the same
            // source as URL_COMMITTED.
            left: () => store.dispatch({ type: "RESET", location: store.getSnapshot().delivered }),
          },
    [store],
  );
}
