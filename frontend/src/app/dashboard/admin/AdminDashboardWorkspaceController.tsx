"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardModuleWorkspace } from "@/components/dashboard/DashboardModuleWorkspace";
import { usePublishStageModule } from "@/components/dashboard/useStageModule";
import {
  ADMIN_LAST_MODULE_STORAGE_KEY,
  readDashboardLastModule,
  writeDashboardLastModule,
} from "@/lib/dashboard-last-module";
import {
  clearAdminAccessError,
  getAdminAccessErrorServerSnapshot,
  getAdminAccessErrorSnapshot,
  subscribeAdminAccessError,
} from "@/lib/admin-access-error";
import {
  subscribeAdminHubReset,
  subscribeAdminModuleActivate,
} from "@/lib/admin-hub-reset";
import type { AdminAccessErrorStatus } from "@/lib/api-error";
import { subscribeHistoryTraversal } from "@/lib/dashboard/navigation/historyTraversal";
import { ROUTES } from "@/lib/routes";
import {
  DEFAULT_ADMIN_MODULE,
  parseAdminModule,
} from "@/features/dashboard/config";
import type { AdminModule } from "@/features/dashboard/config";
import {
  MODULE_QUERY_PARAM,
  buildDashboardModuleHref,
  isAdminHubRequested,
} from "@/features/dashboard/application";
import { AdminAccessErrorState } from "./AdminAccessErrorState";

export type { AdminModule };

type AdminWorkspaceSlots = {
  admin: ReactNode;
  "admin-report-upload": ReactNode;
  "admin-health": ReactNode;
  "admin-clinics": ReactNode;
  "admin-particular-tokens": ReactNode;
  "admin-pricing": ReactNode;
  "admin-sessions": ReactNode;
  "admin-users-roles": ReactNode;
  "audit-log": ReactNode;
  "admin-maintenance": ReactNode;
};

type AdminDashboardWorkspaceControllerProps = {
  initialModule?: AdminModule | null;
  initialAccessErrorStatus?: AdminAccessErrorStatus | null;
  workspaces: AdminWorkspaceSlots;
  /** Page header rendered only for an access error without a module. */
  pageHeader?: ReactNode;
};

// The admin hub — the "Inicio" module and its launcher — is retired at every
// width: below 768px since pre-C05 (#1826) and from 768px up since the
// desktop/tablet space pass. The null module state (bare route or a legacy
// `?hub=1`) resolves to the same landing module a bare route restores, so no
// surface paints or links the hub.

const ADMIN_MODULE_META: Record<AdminModule, { title: string; description: string }> = {
  admin: {
    title: "Administración",
    description: "Resumen operativo, alertas críticas y métricas del sistema.",
  },
  "admin-report-upload": {
    title: "Informes",
    description: "Carga, estado y trazabilidad de informes administrados.",
  },
  "admin-health": {
    title: "Estado del sistema",
    description: "Salud de servicios, esquema y mantenimiento backend.",
  },
  "admin-clinics": {
    title: "Clínicas",
    description: "Crear, buscar y editar clínicas registradas en el portal.",
  },
  "admin-particular-tokens": {
    title: "Tokens particulares",
    description: "Revisar y gestionar tokens de acceso para particulares.",
  },
  "admin-pricing": {
    title: "Precios",
    description: "Actualizar precios del portal visibles en /precios.",
  },
  "admin-sessions": {
    title: "Sesiones",
    description: "Consultar y revocar sesiones activas de clínicas.",
  },
  "admin-users-roles": {
    title: "Usuarios y roles",
    description: "Permisos administrativos y de clínica con trazabilidad.",
  },
  "audit-log": {
    title: "Auditoría",
    description: "Log de eventos con filtros por tipo de evento y actor.",
  },
  "admin-maintenance": {
    title: "Mantenimiento",
    description: "Dry-run de mantenimiento y verificación de esquema.",
  },
};

export function AdminDashboardWorkspaceController({
  initialModule,
  initialAccessErrorStatus,
  workspaces,
  pageHeader,
}: AdminDashboardWorkspaceControllerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeModule, setActiveModule] = useState<AdminModule | null>(
    initialModule ?? null,
  );
  const browserAccessErrorStatus = useSyncExternalStore(
    subscribeAdminAccessError,
    getAdminAccessErrorSnapshot,
    getAdminAccessErrorServerSnapshot,
  );
  const accessErrorStatus =
    browserAccessErrorStatus ?? initialAccessErrorStatus ?? null;
  // Landing-only latch for the last-module restore below: consumed either by
  // the restore itself or by the first URL module transition the controller
  // observes (see the URL-sync effect).
  const hasRestoredLastModule = useRef(false);
  const previousUrlModule = useRef<AdminModule | null>(initialModule ?? null);
  const currentUrlModule = useRef<AdminModule | null>(initialModule ?? null);
  // Latest sync navigation intention (bottom-nav signal, hub reset). The stage swaps optimistically before the router commits the
  // matching URL; this ref lets the URL-sync effect tell that commit apart
  // from a stale, superseded one.
  const pendingNavigationIntent = useRef<{ target: AdminModule | null } | null>(
    null,
  );
  // Targets of intents superseded while still in flight: the only modules a
  // stale router commit can carry. Any other mismatching commit is external.
  const supersededTargets = useRef<readonly (AdminModule | null)[]>([]);
  // Module whose entry the in-flight burst left with a push (see
  // `clinicNavigationState.pushedFrom`): returning to it steps back onto that
  // entry instead of replacing the pushed one into a duplicate [A, A].
  const pushedFrom = useRef<{ readonly module: AdminModule | null } | null>(null);
  // Raised when a Back/Forward traversal starts, consumed by the url commit it
  // produces (or by the popstate backstop): that commit is external even when
  // it lands on a superseded target.
  const historyTraversalStarted = useRef(false);
  const [hasManuallyReturnedToHub, setHasManuallyReturnedToHub] =
    useState(false);

  // Same rule as `recordClinicNavigationIntent`: only "nothing in flight AND
  // the url already shows the target" is a no-op. While a navigation is in
  // flight the url is stale by construction, so A -> B -> A used to clear the
  // intent and B's late commit was then obeyed as an external navigation.
  const recordNavigationIntent = useCallback((target: AdminModule | null) => {
    const superseded = pendingNavigationIntent.current;
    if (superseded === null && currentUrlModule.current === target) return;
    pendingNavigationIntent.current = { target };
    supersededTargets.current =
      superseded && superseded.target !== target
        ? [...supersededTargets.current, superseded.target]
        : supersededTargets.current;
  }, []);

  useEffect(() => {
    const previousCommittedModule = currentUrlModule.current;
    const nextModule = parseAdminModule(searchParams.get(MODULE_QUERY_PARAM));
    currentUrlModule.current = nextModule;

    if (previousUrlModule.current !== nextModule) {
      clearAdminAccessError();
      previousUrlModule.current = nextModule;
      // The last-module restore is a LANDING-only one-shot, so any observed URL
      // module transition — hub tile push, deep link, browser Back/Forward —
      // consumes it. It used to stay armed for the controller's whole life
      // whenever the landing had nothing stored yet, so a browser Back to
      // `/dashboard/admin` (which sets no manual-return flag) re-entered the
      // restore, replaced the URL back into the module the visit had just
      // persisted and remounted its workspace: the Back was undone and its
      // history entry overwritten.
      hasRestoredLastModule.current = true;
    }

    // A sync activation swaps the stage before its URL commit. Under load the
    // SUPERSEDED previous navigation can still commit after that optimistic
    // swap (the router action queue drains in dispatch order), and blindly
    // applying it here yanked the hub away mid-interaction (CI: hub tile
    // detached mid-click). Only a SUPERSEDED target can arrive that way, so only
    // that commit (or a re-render that did not move the module at all) keeps the
    // optimistic state. Every other mismatching commit is an external navigation
    // that landed inside the optimistic window - Back/Forward, a deep link - and
    // it is the user's own: the intent is abandoned and the URL obeyed. Skipping
    // every mismatch used to keep the left module on screen after a Back, and the
    // matching commit (or a same-URL collapse) still re-converges URL and state.
    // A commit produced by a history traversal is external even when it lands
    // on a superseded target: the module alone cannot tell it from a stale one.
    const fromHistory = historyTraversalStarted.current;
    historyTraversalStarted.current = false;
    const intent = pendingNavigationIntent.current;
    if (
      intent &&
      !fromHistory &&
      nextModule !== intent.target &&
      (nextModule === previousCommittedModule ||
        supersededTargets.current.includes(nextModule))
    ) {
      // SINGLE FLIGHT: the superseded navigation landed and the latest request
      // was claimed instead of pushed, so replacing this entry is the one
      // navigation that brings the url to it. Its commit consumes the intent.
      if (nextModule !== previousCommittedModule && intent.target !== null) {
        if (pushedFrom.current?.module === intent.target) {
          pendingNavigationIntent.current = null;
          supersededTargets.current = [];
          pushedFrom.current = null;
          window.history.back();
          return;
        }
        router.replace(buildDashboardModuleHref(ROUTES.dashboardAdmin, intent.target), {
          scroll: false,
        });
      }
      return;
    }
    pendingNavigationIntent.current = null;
    supersededTargets.current = [];
    pushedFrom.current = null;

    setActiveModule(parseAdminModule(searchParams.get(MODULE_QUERY_PARAM)));
  }, [searchParams, router]);

  useEffect(() => () => clearAdminAccessError(), []);

  useEffect(
    () =>
      subscribeHistoryTraversal(() => {
        historyTraversalStarted.current = true;
      }),
    [],
  );

  // Backstop of the classification above for Back/Forward while an activation
  // is pending: a history entry that carries the committed module does not move
  // the module, so the effect keeps the optimistic stage. The intent is
  // abandoned here and the stage falls back to the committed module; when the
  // effect already treated the commit as external, there is nothing left to do.
  useEffect(() => {
    function relinquishOnHistoryNavigation() {
      historyTraversalStarted.current = false;
      if (!pendingNavigationIntent.current) return;
      pendingNavigationIntent.current = null;
      supersededTargets.current = [];
      pushedFrom.current = null;
      if (currentUrlModule.current) setActiveModule(currentUrlModule.current);
    }

    window.addEventListener("popstate", relinquishOnHistoryNavigation);
    return () => window.removeEventListener("popstate", relinquishOnHistoryNavigation);
  }, []);

  // Hub-reset signal: honour it by dropping back to the hub even when its URL
  // navigation collapses into a same-URL no-op (in-flight module push cancelled
  // before it committed), which would otherwise leave the controller stranded
  // on the previous module. The mobile bottom-nav "Inicio" that produced it is
  // retired (pre-C05); the subscription stays because the signal is contracted.
  useEffect(
    () =>
      subscribeAdminHubReset(() => {
        clearAdminAccessError();
        recordNavigationIntent(null);
        setActiveModule(null);
        setHasManuallyReturnedToHub(true);
      }),
    [recordNavigationIntent],
  );

  // The mobile bottom-nav module destinations publish their target so the
  // workspace swaps synchronously, as an optimistic activation. Without this
  // the swap waited on the async URL push, which intermittently lagged past the
  // navigation under load and left the previous module rendered (mobile
  // bottom-nav flake).
  // SINGLE FLIGHT (`admin-hub-reset.ts`): a request that arrives while a module
  // navigation is still in flight is claimed, and reconciled above once it lands.
  useEffect(
    () =>
      subscribeAdminModuleActivate((moduleId) => {
        const parsed = parseAdminModule(moduleId);
        if (!parsed) return false;
        const inFlight = pendingNavigationIntent.current?.target != null;
        const committed = currentUrlModule.current;
        clearAdminAccessError();
        recordNavigationIntent(parsed);
        // Not in flight: the caller pushes this one, which starts the burst.
        if (!inFlight && pendingNavigationIntent.current) pushedFrom.current = { module: committed };
        setHasManuallyReturnedToHub(false);
        setActiveModule(parsed);
        return inFlight;
      }),
    [recordNavigationIntent],
  );

  useEffect(() => {
    if (!activeModule) return;
    writeDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY, activeModule);
  }, [activeModule]);

  useEffect(() => {
    if (hasRestoredLastModule.current || hasManuallyReturnedToHub) return;
    if (searchParams.get(MODULE_QUERY_PARAM) || isAdminHubRequested(searchParams)) return;
    const lastModule = parseAdminModule(
      readDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY),
    );
    const landingModule = lastModule ?? DEFAULT_ADMIN_MODULE;
    hasRestoredLastModule.current = true;
    router.replace(
      buildDashboardModuleHref(ROUTES.dashboardAdmin, landingModule),
      { scroll: false },
    );
  }, [searchParams, hasManuallyReturnedToHub, router]);

  useEffect(() => {
    if (activeModule !== null || accessErrorStatus) return;
    function resolveRetiredHub() {
      // A navigation activation already owns this navigation.
      if (pendingNavigationIntent.current) return;
      // A module the live URL already carries (a nav tap that committed before
      // this controller hydrated) wins over the landing fallback.
      if (parseAdminModule(new URLSearchParams(window.location.search).get(MODULE_QUERY_PARAM))) {
        return;
      }
      const landingModule =
        parseAdminModule(readDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY)) ??
        DEFAULT_ADMIN_MODULE;
      hasRestoredLastModule.current = true;
      setActiveModule(landingModule);
      // Native replace, synced into useSearchParams by the router: it never
      // enters the router action queue, so it cannot overtake a navigation the
      // user already started.
      window.history.replaceState(
        null,
        "",
        buildDashboardModuleHref(ROUTES.dashboardAdmin, landingModule),
      );
    }
    resolveRetiredHub();
  }, [activeModule, accessErrorStatus]);

  // The lateral band, the mobile bar and the mobile title render this, not
  // their own reading of the URL: a superseded commit kept above must not move
  // them either.
  usePublishStageModule("admin", activeModule);

  const activeMeta = activeModule ? ADMIN_MODULE_META[activeModule] : null;

  // Single persistent, opaque, isolated stage for the module swap. The
  // stage node never unmounts (only its children swap), so the swap happens
  // inside one stable stacking/paint surface instead of recreating a new
  // stacking context per navigation — which let mobile GPUs keep a recycled
  // tile of the previous module behind the freshly-mounted hub (the reported
  // ghosting / bleed-through). See admin-mobile-stage-layer in globals.css.
  return (
    <div
      data-dashboard-module-stage="true"
      className="flex min-h-0 flex-1 flex-col overflow-hidden dashboard-module-stage"
    >
      {activeModule && activeMeta ? (
        <DashboardModuleWorkspace
          key={activeModule}
          title={activeMeta.title}
          description={activeMeta.description}
          moduleId={activeModule}
        >
          {accessErrorStatus ? (
            <AdminAccessErrorState status={accessErrorStatus} />
          ) : (
            workspaces[activeModule]
          )}
        </DashboardModuleWorkspace>
      ) : accessErrorStatus ? (
        <>
          {pageHeader}
          <AdminAccessErrorState status={accessErrorStatus} />
        </>
      ) : null}
    </div>
  );
}
