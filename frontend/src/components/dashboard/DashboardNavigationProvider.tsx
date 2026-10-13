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
import { HUB_QUERY_PARAM, MODULE_QUERY_PARAM, buildDashboardModuleHref } from "@/features/dashboard/application";
import {
  ADMIN_MODULE_IDS,
  DEFAULT_ADMIN_MODULE,
  parseAdminModule,
  type AdminModule,
} from "@/features/dashboard/config";
import { registerAdminNavigationOwner } from "@/lib/admin-hub-reset";
import {
  ADMIN_LAST_MODULE_STORAGE_KEY,
  readDashboardLastModule,
  writeDashboardLastModule,
} from "@/lib/dashboard-last-module";
import {
  createNavigationCoordinator,
  previewDisplay,
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
import { ROUTES } from "@/lib/routes";

/**
 * Owner of module navigation on `/dashboard/admin` (PR-NAV-03).
 *
 * A thin wrapper over the coordinator of §12.5.1: the store is created in
 * render with HYDRATED applied (A1), mounted in a passive effect (A4),
 * unmounted (A8) and handed the events. Every decision is the machine's; every
 * effect runs from the coordinator's queue, never from render.
 *
 * It lives in the dashboard layout, which the clinic routes share, and holds
 * nothing there: no store, no dispatch, no navigation (clinic is PR-NAV-04).
 *
 * The provider itself never reads the search params and never wraps its
 * children in a boundary: the layout also serves statically prerendered
 * routes, and a boundary around the page would make the server send the page
 * twice. What needs the URL reads it where it renders — the owner below, a
 * sibling of the children, and each consumer of the display.
 *
 * @see docs/implementation/dashboard-navigation-fsm-admin.md
 */

type RouterLike = ReturnType<typeof useRouter>;

const MACHINE: NavigationMachine = { initial, transition };

const ADMIN_CONFIG: MachineConfig = {
  surface: "admin",
  modules: ADMIN_MODULE_IDS,
  defaultModule: DEFAULT_ADMIN_MODULE,
};

const NO_MODULE: NavLocation = { kind: "none" };

function adminLocation(moduleId: AdminModule | null): NavLocation {
  return moduleId === null ? NO_MODULE : { kind: "module", module: moduleId };
}

function adminHref(location: NavLocation): string {
  return location.kind === "module"
    ? buildDashboardModuleHref(ROUTES.dashboardAdmin, location.module)
    : ROUTES.dashboardAdmin;
}

/** The admin location of a URL, or `null` when it is not the admin dashboard. */
function adminLocationOfUrl(href: string): NavLocation | null {
  const url = new URL(href, window.location.href);
  if (url.pathname !== ROUTES.dashboardAdmin) return null;
  return adminLocation(parseAdminModule(url.searchParams.get(MODULE_QUERY_PARAM)));
}

function createAdminStore(router: RouterLike, location: NavLocation, explicit: boolean): NavigationCoordinator {
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  return createNavigationCoordinator(
    MACHINE,
    ADMIN_CONFIG,
    {
      type: "HYDRATED",
      location,
      explicit,
      storedModule: parseAdminModule(readDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY)),
    },
    {
      scheduleMicrotask: (drain) => queueMicrotask(drain),
      navigate(effect) {
        const href = adminHref(effect.to);
        if (effect.type === "ROUTER_PUSH") router.push(href, { scroll: false });
        else if (effect.type === "ROUTER_REPLACE") router.replace(href, { scroll: false });
        else if (effect.mode === "assign") window.location.assign(href);
        else window.location.replace(href);
      },
      persist: (moduleId) => writeDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY, moduleId),
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
 * One store per visit to the admin dashboard. A1: whichever component renders
 * first with the URL in hand creates it; the rest get the same one. A store
 * that React discards with its render never ran anything.
 */
type AdminStoreSlot = {
  readonly resolve: (router: RouterLike, location: NavLocation, explicit: boolean) => NavigationCoordinator;
};

function createAdminStoreSlot(): AdminStoreSlot {
  let store: NavigationCoordinator | null = null;
  return {
    resolve(router, location, explicit) {
      store ??= createAdminStore(router, location, explicit);
      return store;
    },
  };
}

const AdminStoreSlotContext = createContext<AdminStoreSlot | null>(null);

type AdminNavigationSource = {
  readonly store: NavigationCoordinator;
  /** The admin location of the URL this render sees. */
  readonly location: NavLocation;
};

/** `null` outside `/dashboard/admin`. Reads the search params: call it under a boundary. */
function useAdminNavigationSource(): AdminNavigationSource | null {
  const slot = useContext(AdminStoreSlotContext);
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlModule = parseAdminModule(searchParams.get(MODULE_QUERY_PARAM));
  const explicit = searchParams.has(MODULE_QUERY_PARAM) || searchParams.has(HUB_QUERY_PARAM);
  const location = useMemo(() => adminLocation(urlModule), [urlModule]);

  return useMemo(
    () => (slot === null ? null : { store: slot.resolve(router, location, explicit), location }),
    [slot, router, location, explicit],
  );
}

type NavigateEventLike = Event & {
  readonly navigationType?: string;
  readonly destination?: { readonly url?: string };
};

/** TRAVERSE_STARTED: Navigation API when present, `popstate` otherwise. */
function subscribeTraversals(store: NavigationCoordinator): () => void {
  const started = (href: string | undefined) => {
    const destination = href === undefined ? null : adminLocationOfUrl(href);
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
function AdminNavigationOwner() {
  const source = useAdminNavigationSource();
  const store = source?.store ?? null;
  const location = source?.location ?? NO_MODULE;

  // URL_COMMITTED, in the layout effect of the commit that moved the URL. The
  // consumers previewed it in that same render (`useAdminDashboardNavigation`).
  useLayoutEffect(() => {
    store?.commit(location);
  }, [store, location]);

  // A4 / A8. Passive on purpose: a layout effect would drain before the
  // boundary's own passive effect of the same commit had dispatched NAV_FAILED.
  useEffect(() => {
    if (store === null) return undefined;
    store.mount();
    const unsubscribeTraversals = subscribeTraversals(store);
    const unregisterOwner = registerAdminNavigationOwner({
      selectModule(moduleId) {
        const parsed = parseAdminModule(moduleId);
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
  }, [store]);

  return null;
}

/**
 * Mounted by the dashboard layout. Outside `/dashboard/admin` it provides no
 * slot and mounts no owner, so nothing below it can reach a store.
 */
export function DashboardNavigationProvider({ children }: { children: ReactNode }) {
  const isAdmin = usePathname() === ROUTES.dashboardAdmin;
  const [held, setHeld] = useState<AdminStoreSlot | null>(() => (isAdmin ? createAdminStoreSlot() : null));
  const slot = isAdmin ? (held ?? createAdminStoreSlot()) : null;
  if (slot !== held) setHeld(slot);

  return (
    <AdminStoreSlotContext.Provider value={slot}>
      {slot === null ? null : (
        // The owner reads the search params; the boundary is where the build's
        // prerender attempt of this route bails out. It has nothing to show.
        <Suspense fallback={null}>
          <AdminNavigationOwner />
        </Suspense>
      )}
      {children}
    </AdminStoreSlotContext.Provider>
  );
}

export type AdminDashboardNavigation = {
  /** What stage and chrome show: the machine's `display`. `null`: no module. */
  readonly module: AdminModule | null;
  /** The navigation outlived its budget (STALLED). */
  readonly stalled: boolean;
  /** Leaves STALLED through a document navigation (RETRY). */
  readonly retry: () => void;
};

const subscribeToNothing = () => () => {};
const noSnapshot = () => null;

/**
 * The admin navigation as stage and chrome render it. `null` outside
 * `/dashboard/admin`: no owner is mounted. Reads the search params, so the
 * display is previewed in the same render, and commit, as the URL (§11.3).
 */
export function useAdminDashboardNavigation(): AdminDashboardNavigation | null {
  const source = useAdminNavigationSource();
  const store = source?.store ?? null;
  const snapshot = useSyncExternalStore(
    store === null ? subscribeToNothing : store.subscribe,
    store === null ? noSnapshot : store.getSnapshot,
    store === null ? noSnapshot : store.getSnapshot,
  );

  const display =
    source === null || snapshot === null
      ? null
      : previewDisplay(MACHINE, ADMIN_CONFIG, snapshot, source.location);
  const displayModule = display?.kind === "module" ? parseAdminModule(display.module) : null;
  const stalled = snapshot?.state.tag === "STALLED";

  return useMemo(
    () =>
      store === null
        ? null
        : { module: displayModule, stalled, retry: () => store.dispatch({ type: "RETRY" }) },
    [store, displayModule, stalled],
  );
}

export type NavigationBoundarySignals = {
  /** The error boundary mounted: NAV_FAILED. */
  readonly failed: () => void;
  /** The boundary is leaving, by "Reintentar" or by unmount: RESET. */
  readonly left: () => void;
};

/**
 * Stable per owner, so the boundary's effect runs once per mount. `null` where
 * the boundary has no owner to tell: every clinic route.
 */
export function useDashboardNavigationBoundary(): NavigationBoundarySignals | null {
  const source = useAdminNavigationSource();
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
