"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardModuleRail } from "./DashboardModuleRail";
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
  const currentUrlModule = useRef<ClinicModule>(
    initialModule ?? DEFAULT_CLINIC_MODULE,
  );
  // Latest sync navigation intention (rail tab, pager step, nav signal, hub
  // reset). The stage swaps the active module optimistically before the router
  // commits the matching URL; this ref lets the URL-sync effect tell that
  // commit apart from a stale, superseded one.
  const pendingNavigationIntent = useRef<{ target: ClinicModule } | null>(null);
  const [hasManuallyReturnedToHub, setHasManuallyReturnedToHub] =
    useState(false);

  const recordNavigationIntent = useCallback((target: ClinicModule) => {
    pendingNavigationIntent.current =
      currentUrlModule.current === target ? null : { target };
  }, []);

  useEffect(() => {
    // No module in the URL means the operational default — never a hub.
    const nextModule =
      parseClinicModule(searchParams.get("module")) ?? DEFAULT_CLINIC_MODULE;
    currentUrlModule.current = nextModule;

    // A sync activation swaps the stage before its URL commit. Under load the
    // SUPERSEDED previous navigation can still commit after that optimistic
    // swap (the router action queue drains in dispatch order); applying it here
    // would yank the workspace away mid-interaction. Consume the intent on the
    // first commit that follows it: a mismatching commit is the stale
    // navigation and must not override optimistic state; the matching commit
    // re-converges URL and state. One-shot consumption keeps external
    // navigations (Back/Forward, deep links) working — they are never skipped
    // more than once, and only inside the sub-second optimistic window.
    const intent = pendingNavigationIntent.current;
    if (intent) {
      if (nextModule !== intent.target) {
        return;
      }
      pendingNavigationIntent.current = null;
    }

    setActiveModule(nextModule);
  }, [searchParams]);

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
  useEffect(() => {
    if (hasRestoredLastModule.current || hasManuallyReturnedToHub) return;
    if (searchParams.get("module")) return;
    const lastModule = parseClinicModule(
      readDashboardLastModule(CLINIC_LAST_MODULE_STORAGE_KEY),
    );
    if (!lastModule) return;
    hasRestoredLastModule.current = true;
    router.replace(`${ROUTES.dashboard}?module=${lastModule}`, {
      scroll: false,
    });
  }, [searchParams, hasManuallyReturnedToHub, router]);

  const meta = MODULE_META[activeModule];

  return (
    <div
      data-dashboard-module-stage="true"
      data-clinic-dashboard-stage="true"
      className="flex min-h-0 flex-1 flex-col overflow-hidden dashboard-module-stage"
    >
      <DashboardModuleRail activeModule={activeModule} />
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
