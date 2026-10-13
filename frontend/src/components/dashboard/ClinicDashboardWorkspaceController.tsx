"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardModuleWorkspace } from "./DashboardModuleWorkspace";
import { useClinicDashboardNavigation } from "./DashboardNavigationProvider";
import { usePublishStageModule } from "./useStageModule";
import {
  DEFAULT_CLINIC_MODULE,
  parseClinicModule,
} from "@/features/dashboard/config";
import { isHubRequested } from "@/features/dashboard/application";
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
  /** The server's reading of the URL. The stage follows the navigation owner. */
  initialModule?: ClinicModule | null;
  workspaces: ClinicWorkspaceSlots;
  /**
   * CMP-02 — the clinic Inicio/hub surface. It is a STATE of `/dashboard`
   * (`?hub=1`), never a module, exactly as `?hub=1` is for admin. Rendered in
   * place of the module workspace while the hub state is active.
   */
  hub: ReactNode;
  /** The server's reading of `?hub=1`. The stage follows the navigation owner. */
  initialHub?: boolean;
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

// STALLED: the navigation outlived its budget and nothing in the router says
// whether it will ever land. A zero-height anchor with the notice laid over
// what follows it, so showing or dismissing it never changes the height the
// workspace measures. The retry is a document navigation to the same target.
function ClinicNavigationStalledNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="relative z-[3] h-0 shrink-0">
      <div
        role="status"
        data-dashboard-navigation-stalled="true"
        className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-500/25 bg-card px-3 py-1.5 text-xs text-amber-700 shadow-sm"
      >
        <p className="min-w-0 flex-1 basis-56">
          <span className="font-semibold">El módulo está tardando en cargar.</span> Podés esperar o
          reintentar la carga.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="h-7 shrink-0 border-amber-500/30 px-2 text-xs text-amber-700 hover:border-amber-500/45 hover:bg-amber-500/10 hover:text-amber-700 focus-visible:ring-2"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Reintentar
        </Button>
      </div>
    </div>
  );
}

/**
 * View of the clinic stage on `/dashboard`. It decides nothing about
 * navigation: the module or hub on stage is the navigation machine's `display`
 * (`components/dashboard/DashboardNavigationProvider.tsx`), which also owns the
 * URL, history, the restore of the last module, the budget and its storage.
 */
export function ClinicDashboardWorkspaceController({
  workspaces,
  hub,
}: ClinicDashboardWorkspaceControllerProps) {
  const searchParams = useSearchParams();
  const navigation = useClinicDashboardNavigation();
  // What the URL of this render says: the stage without an owner (no provider
  // above), and while the display is a full route this page is leaving for.
  const hubInUrl = isHubRequested(searchParams);
  const urlModule = parseClinicModule(searchParams.get("module")) ?? DEFAULT_CLINIC_MODULE;
  const followsUrl = navigation === null || (navigation.module === null && !navigation.hub);
  // CMP-02 — the hub is a STATE of `/dashboard` (`?hub=1`), never a module.
  const isHubActive = followsUrl ? hubInUrl : navigation.hub;
  const activeModule = followsUrl ? urlModule : (navigation.module ?? urlModule);

  // The lateral band, the mobile bar and the mobile title render this, not
  // their own reading of the URL, so they move with the stage on the click and
  // never follow a superseded commit. The hub is a module-less stage.
  usePublishStageModule("clinic", isHubActive ? null : activeModule);

  const meta = MODULE_META[activeModule];

  return (
    <div
      data-dashboard-module-stage="true"
      data-clinic-dashboard-stage="true"
      className="flex min-h-0 flex-1 flex-col overflow-hidden dashboard-module-stage"
    >
      {navigation?.stalled ? <ClinicNavigationStalledNotice onRetry={navigation.retry} /> : null}
      {/* B09: no module navigation inside the stage. Below 768px the shared
          `DashboardMobileNav` owns it at shell level; from 768px up the B07/B08
          lateral band does. The rail that used to sit here carried both a tab
          track and a prev/next pager over the same ordered modules, and it was
          the last surface where navigation cost VERTICAL budget inside `main`. */}
      {isHubActive ? (
        hub
      ) : (
        <DashboardModuleWorkspace
          key={activeModule}
          title={meta.title}
          description={meta.description}
          moduleId={activeModule}
        >
          {workspaces[activeModule]}
        </DashboardModuleWorkspace>
      )}
    </div>
  );
}
