"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { DashboardModuleWorkspace } from "@/components/dashboard/DashboardModuleWorkspace";
import { useAdminDashboardNavigation } from "@/components/dashboard/DashboardNavigationProvider";
import { Button } from "@/components/ui/button";
import {
  clearAdminAccessError,
  getAdminAccessErrorServerSnapshot,
  getAdminAccessErrorSnapshot,
  subscribeAdminAccessError,
} from "@/lib/admin-access-error";
import type { AdminAccessErrorStatus } from "@/lib/api-error";
import {
  parseAdminModule,
} from "@/features/dashboard/config";
import type { AdminModule } from "@/features/dashboard/config";
import {
  MODULE_QUERY_PARAM,
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
  /** The server's reading of the URL. The stage follows the navigation owner. */
  initialModule?: AdminModule | null;
  initialAccessErrorStatus?: AdminAccessErrorStatus | null;
  workspaces: AdminWorkspaceSlots;
  /** Page header rendered only for an access error without a module. */
  pageHeader?: ReactNode;
};

// The admin hub — the "Inicio" module and its launcher — is retired at every
// width: below 768px since pre-C05 (#1826) and from 768px up since the
// desktop/tablet space pass. An entry without a module (bare route or a legacy
// `?hub=1`) is normalized by the navigation machine to the last module or the
// default one, so no surface paints or links the hub.

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

// STALLED: the navigation outlived its budget and nothing in the router says
// whether it will ever land. A zero-height anchor with the notice laid over
// what follows it, so showing or dismissing it never changes the height the
// workspace measures. The retry is a document navigation to the same target.
function AdminNavigationStalledNotice({ onRetry }: { onRetry: () => void }) {
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
 * View of the admin stage. It decides nothing about navigation: the module on
 * stage is the navigation machine's `display`
 * (`components/dashboard/DashboardNavigationProvider.tsx`), which also owns the
 * URL, history, the landing restore, the budget and the last-module storage.
 */
export function AdminDashboardWorkspaceController({
  initialAccessErrorStatus,
  workspaces,
  pageHeader,
}: AdminDashboardWorkspaceControllerProps) {
  const searchParams = useSearchParams();
  const navigation = useAdminDashboardNavigation();
  const urlModule = parseAdminModule(searchParams.get(MODULE_QUERY_PARAM));
  // Without an owner (no provider above) the stage reads the URL.
  const activeModule = navigation === null ? urlModule : navigation.module;
  const browserAccessErrorStatus = useSyncExternalStore(
    subscribeAdminAccessError,
    getAdminAccessErrorSnapshot,
    getAdminAccessErrorServerSnapshot,
  );
  const accessErrorStatus =
    browserAccessErrorStatus ?? initialAccessErrorStatus ?? null;

  // An access error belongs to the module that reported it: it is dropped when
  // the stage moves to another module and again when the URL commits one.
  const shown = useRef({ activeModule, urlModule });
  useEffect(() => {
    if (shown.current.activeModule === activeModule && shown.current.urlModule === urlModule) return;
    shown.current = { activeModule, urlModule };
    clearAdminAccessError();
  }, [activeModule, urlModule]);

  useEffect(() => () => clearAdminAccessError(), []);

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
      {navigation?.stalled ? <AdminNavigationStalledNotice onRetry={navigation.retry} /> : null}
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
