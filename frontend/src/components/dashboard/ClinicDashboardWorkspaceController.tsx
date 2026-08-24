"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardModuleWorkspace } from "./DashboardModuleWorkspace";
import { ROUTES } from "@/lib/routes";
import {
  CLINIC_LAST_MODULE_STORAGE_KEY,
  readDashboardLastModule,
  writeDashboardLastModule,
} from "@/lib/dashboard-last-module";
import {
  subscribeClinicHubReset,
  subscribeClinicModuleActivate,
} from "@/lib/clinic-hub-reset";
import {
  DEFAULT_CLINIC_MODULE,
  parseClinicModule,
} from "@/features/dashboard/config";
import {
  applyClinicUrlCommit,
  clinicModuleHref,
  recordClinicNavigationIntent,
  type ClinicNavigationState,
} from "@/lib/dashboard/navigation/clinicNavigationState";
import type { ClinicModule } from "@/features/dashboard/config";

export type { ClinicModule };
export { DEFAULT_CLINIC_MODULE };

type ClinicWorkspaceSlots = {
  operaciones: ReactNode;
  informes: ReactNode;
  logistica: ReactNode;
  perfil: ReactNode;
  tokens: ReactNode;
};

type ClinicDashboardWorkspaceControllerProps = {
  initialModule?: ClinicModule | null;
  workspaces: ClinicWorkspaceSlots;
};

const MODULE_META: Record<
  ClinicModule,
  { title: string; description: string }
> = {
  operaciones: {
    title: "Centro de operaciones",
    description: "Métricas operativas, informes recientes y visitas activas.",
  },
  informes: {
    title: "Informes",
    description: "Consultar, filtrar y descargar informes veterinarios.",
  },
  logistica: {
    title: "Logística",
    description: "Visitas de campo, planes de ruta y métricas de cumplimiento.",
  },
  perfil: {
    title: "Perfil público",
    description: "Publicar y actualizar el perfil en el banco de especialidades.",
  },
  tokens: {
    title: "Tokens particulares",
    description: "Generar y gestionar tokens de acceso para pacientes.",
  },
};

export function ClinicDashboardWorkspaceController({
  initialModule,
  workspaces,
}: ClinicDashboardWorkspaceControllerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeModule, setActiveModule] = useState<ClinicModule>(
    initialModule ?? DEFAULT_CLINIC_MODULE,
  );
  const hasRestoredLastModule = useRef(false);
  // Confirmed URL module + the latest sync navigation intention (nav signal,
  // hub reset). The stage swaps the active module optimistically before the
  // router commits the matching URL, so every commit has to be told apart from
  // a stale, superseded one. The classification lives in a pure module because
  // it is a race: it cannot be exercised through the router, only modelled.
  const navigationState = useRef<ClinicNavigationState>({
    confirmedUrlModule: initialModule ?? DEFAULT_CLINIC_MODULE,
    pendingIntent: null,
  });
  const [hasManuallyReturnedToHub, setHasManuallyReturnedToHub] =
    useState(false);

  const recordNavigationIntent = useCallback((target: ClinicModule) => {
    navigationState.current = recordClinicNavigationIntent(
      navigationState.current,
      target,
    );
  }, []);

  // No module in the URL means the operational default — never a hub.
  //
  // Derived OUTSIDE the effect, and as a plain string, because it is the
  // effect's real dependency. `useSearchParams()` hands back a new object on
  // every render, so depending on it made the effect run again on renders where
  // the url had not moved at all — and a re-render is exactly what the sync
  // activation below causes, through `setActiveModule`, while its `push` is
  // still in flight. `applyClinicUrlCommit` cannot tell that phantom run apart
  // from a superseded commit: both arrive as "a module that is not the intent",
  // so it reconciled, and the reconciling `replace` cancelled the push it was
  // supposed to be protecting. Keying on the module ITSELF means the effect
  // observes url commits and nothing else.
  const nextModule =
    parseClinicModule(searchParams.get("module")) ?? DEFAULT_CLINIC_MODULE;

  useEffect(() => {
    // A sync activation swaps the stage before its URL commit. Under load the
    // SUPERSEDED previous navigation can still commit after that optimistic
    // swap (the router action queue drains in dispatch order); applying it here
    // would yank the workspace away mid-interaction.
    //
    // Skipping that commit is only half the job. The URL would keep pointing at
    // the module that LOST, and `DashboardMobileNav` derives its `aria-current`
    // from `useSearchParams` — so url, bar and workspace would disagree with no
    // event left to fix them. The stale commit is therefore RECONCILED: the
    // winning intention's canonical url is re-asserted with `replace` (never
    // `push`: superseding a navigation must not add a history entry). That
    // replace produces a matching commit, which consumes the intent, so there
    // is at most one per intention and no loop.
    const outcome = applyClinicUrlCommit(navigationState.current, nextModule);
    navigationState.current = outcome.state;

    if (outcome.reconcileTo !== null) {
      router.replace(
        clinicModuleHref(
          ROUTES.dashboard,
          DEFAULT_CLINIC_MODULE,
          outcome.reconcileTo,
        ),
        { scroll: false },
      );
      return;
    }

    if (outcome.activeModule !== null) {
      setActiveModule(outcome.activeModule as ClinicModule);
    }
  }, [router, nextModule]);

  useEffect(
    () =>
      subscribeClinicModuleActivate((moduleId) => {
        const parsed = parseClinicModule(moduleId);
        if (!parsed) return;
        recordNavigationIntent(parsed);
        setHasManuallyReturnedToHub(false);
        setActiveModule(parsed);
      }),
    [recordNavigationIntent],
  );

  // Legacy hub-reset signals (e.g. the "Inicio" control on secondary surfaces)
  // resolve to the operational default because the hub no longer exists.
  useEffect(
    () =>
      subscribeClinicHubReset(() => {
        recordNavigationIntent(DEFAULT_CLINIC_MODULE);
        setActiveModule(DEFAULT_CLINIC_MODULE);
        setHasManuallyReturnedToHub(true);
      }),
    [recordNavigationIntent],
  );

  useEffect(() => {
    writeDashboardLastModule(CLINIC_LAST_MODULE_STORAGE_KEY, activeModule);
  }, [activeModule]);

  // Resume the last visited module on a bare `/dashboard` entry. This only ever
  // resolves to a real module (there is no hub to force), stays replace-only to
  // avoid history pollution, and yields to an explicit URL module or a manual
  // return to the default.
  //
  // The restore is a NAVIGATION, so it obeys the same two rules as every other
  // one. It used to bypass both. It hand-built `?module=${lastModule}`, which
  // spells the DEFAULT module as `?module=operaciones` while the canonical url
  // for it is the bare `/dashboard` — a second spelling of one surface, and the
  // one `clinicModuleHref` exists to prevent. And it recorded no intent, so
  // `applyClinicUrlCommit` classified its commit as EXTERNAL (deep link,
  // Back/Forward) and obeyed it: a restore fired on mount could land AFTER an
  // explicit tap and reopen the module the user had just navigated away from.
  // Recording the intent first is what lets a later tap supersede the restore,
  // and what makes the restore's own late commit reconcilable instead of
  // authoritative.
  useEffect(() => {
    if (hasRestoredLastModule.current || hasManuallyReturnedToHub) return;
    if (searchParams.get("module")) return;
    const lastModule = parseClinicModule(
      readDashboardLastModule(CLINIC_LAST_MODULE_STORAGE_KEY),
    );
    if (!lastModule) return;
    hasRestoredLastModule.current = true;
    // Restoring the DEFAULT module is not a navigation: `clinicModuleHref`
    // spells it as the bare `/dashboard`, which is exactly the url a bare entry
    // is already showing — the same condition `recordClinicNavigationIntent`
    // calls a genuine no-op (nothing in flight AND the url already shows the
    // target). Issuing the replace anyway put an unguarded navigation in flight
    // during mount, and an intent recorded for a target that already matches
    // the confirmed url cannot arm a guard, so that replace could land after
    // the user's first tap and overwrite it with the url they had left.
    if (lastModule === DEFAULT_CLINIC_MODULE) return;
    recordNavigationIntent(lastModule);
    router.replace(
      clinicModuleHref(ROUTES.dashboard, DEFAULT_CLINIC_MODULE, lastModule),
      { scroll: false },
    );
  }, [searchParams, hasManuallyReturnedToHub, recordNavigationIntent, router]);

  const meta = MODULE_META[activeModule];

  return (
    <div
      data-dashboard-module-stage="true"
      data-clinic-dashboard-stage="true"
      className="flex min-h-0 flex-1 flex-col overflow-hidden dashboard-module-stage"
    >
      {/* B09: no module navigation inside the stage. Below 768px the shared
          `DashboardMobileNav` owns it at shell level; from 768px up the B07/B08
          lateral band does. The rail that used to sit here carried both a tab
          track and a prev/next pager over the same ordered modules, and it was
          the last surface where navigation cost VERTICAL budget inside `main`. */}
      <DashboardModuleWorkspace
        key={activeModule}
        title={meta.title}
        description={meta.description}
        moduleId={activeModule}
      >
        {workspaces[activeModule]}
      </DashboardModuleWorkspace>
    </div>
  );
}
