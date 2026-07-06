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
import {
  Activity,
  Building2,
  ClipboardPlus,
  KeyRound,
  ReceiptText,
  ScrollText,
  Settings2,
  ShieldCheck,
  TicketCheck,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DashboardHubHero } from "@/components/dashboard/DashboardHubHero";
import type { DashboardHubHeroStatusTone } from "@/components/dashboard/DashboardHubHero";
import { DashboardModuleHub } from "@/components/dashboard/DashboardModuleHub";
import { DashboardModuleWorkspace } from "@/components/dashboard/DashboardModuleWorkspace";
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
import { parseAdminModule } from "@/features/dashboard/config";
import type { AdminModule } from "@/features/dashboard/config";
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
  systemStatus: string;
  systemStatusLabel: string;
  systemStatusVariant: "default" | "secondary" | "destructive" | "outline";
  auditEntriesCount: number;
  eventTypesCount: number;
  /** Page header rendered only on the hub; hidden in modules to reclaim height. */
  pageHeader?: ReactNode;
};

function getHeroStatusTone(systemStatus: string): DashboardHubHeroStatusTone {
  if (systemStatus === "ok") return "ok";
  if (systemStatus === "degraded") return "warn";
  if (systemStatus === "down") return "down";
  return "neutral";
}

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
  systemStatus,
  systemStatusLabel,
  systemStatusVariant,
  auditEntriesCount,
  eventTypesCount,
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
  const hasRestoredLastModule = useRef(false);
  const previousUrlModule = useRef<AdminModule | null>(initialModule ?? null);
  // Latest sync navigation intention (hub tile, hero CTA, bottom-nav signal,
  // hub reset). The stage swaps optimistically before the router commits the
  // matching URL; this ref lets the URL-sync effect tell that commit apart
  // from a stale, superseded one.
  const pendingNavigationIntent = useRef<{ target: AdminModule | null } | null>(
    null,
  );
  // Two-commit activation buffer: a hub tile/card click only RECORDS the
  // module here; the promotion effect below applies it one commit later.
  const [pendingActivation, setPendingActivation] = useState<AdminModule | null>(
    null,
  );
  const [hasManuallyReturnedToHub, setHasManuallyReturnedToHub] =
    useState(false);

  useEffect(() => {
    const nextModule = parseAdminModule(searchParams.get("module"));

    if (previousUrlModule.current !== nextModule) {
      clearAdminAccessError();
      previousUrlModule.current = nextModule;
    }

    // A sync activation swaps the stage before its URL commit. Under load the
    // SUPERSEDED previous navigation can still commit after that optimistic
    // swap (the router action queue drains in dispatch order), and blindly
    // applying it here yanked the hub away mid-interaction (CI: hub tile
    // detached mid-click). Consume the intent on the first commit that follows
    // it: a mismatching commit is the stale navigation and must not override
    // the optimistic state; the matching commit (or a same-URL collapse, where
    // state and URL already agree) re-converges URL and state. One-shot
    // consumption keeps external navigations (back/forward, deep links)
    // working: they are never skipped more than once, and only inside the
    // sub-second optimistic window.
    const intent = pendingNavigationIntent.current;
    if (intent) {
      pendingNavigationIntent.current = null;
      if (nextModule !== intent.target) {
        return;
      }
    }

    setActiveModule(parseAdminModule(searchParams.get("module")));
  }, [searchParams]);

  useEffect(() => () => clearAdminAccessError(), []);

  // The mobile bottom-nav "Inicio" publishes a hub-reset signal; honour it by
  // dropping back to the hub even when its URL navigation collapses into a
  // same-URL no-op (in-flight module push cancelled before it committed), which
  // would otherwise leave the controller stranded on the previous module.
  useEffect(
    () =>
      subscribeAdminHubReset(() => {
        clearAdminAccessError();
        pendingNavigationIntent.current = { target: null };
        setActiveModule(null);
        setHasManuallyReturnedToHub(true);
      }),
    [],
  );

  // The mobile bottom-nav module destinations publish their target so the
  // workspace swaps synchronously, mirroring the hub cards' optimistic
  // activateModule. Without this the swap waited on the async URL push, which
  // intermittently lagged past the navigation under load and left the previous
  // module rendered (mobile bottom-nav flake).
  useEffect(
    () =>
      subscribeAdminModuleActivate((moduleId) => {
        const parsed = parseAdminModule(moduleId);
        if (!parsed) return;
        clearAdminAccessError();
        pendingNavigationIntent.current = { target: parsed };
        setHasManuallyReturnedToHub(false);
        setActiveModule(parsed);
      }),
    [],
  );

  useEffect(() => {
    if (!activeModule) return;
    writeDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY, activeModule);
  }, [activeModule]);

  useEffect(() => {
    if (hasRestoredLastModule.current || hasManuallyReturnedToHub) return;
    if (searchParams.get("module")) return;
    const lastModule = parseAdminModule(
      readDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY),
    );
    if (!lastModule) return;
    hasRestoredLastModule.current = true;
    router.replace(`/dashboard/admin?module=${lastModule}`, { scroll: false });
  }, [searchParams, hasManuallyReturnedToHub, router]);

  // React flushes discrete-event state synchronously, so promoting the module
  // directly inside the tile's onClick unmounts the hub launcher WITHIN the
  // native click lifecycle. Locally the input sequence usually wins that race;
  // on a slow CI runner the stretched frame timing let the unmount land
  // mid-action and Playwright saw the clicked tile "detached from the DOM".
  // Recording the intention in the click's own commit and promoting it from
  // this effect (the NEXT commit) keeps the clicked tile mounted through the
  // whole click deterministically — commit ordering, not timers.
  useEffect(() => {
    if (!pendingActivation) return;
    const moduleId = pendingActivation;
    setPendingActivation(null);
    clearAdminAccessError();
    pendingNavigationIntent.current = { target: moduleId };
    setActiveModule(moduleId);
    router.push(`/dashboard/admin?module=${moduleId}`, { scroll: false });
  }, [pendingActivation, router]);

  const activateModule = useCallback((moduleId: AdminModule) => {
    setPendingActivation(moduleId);
  }, []);

  const backToHub = useCallback(() => {
    clearAdminAccessError();
    pendingNavigationIntent.current = { target: null };
    setActiveModule(null);
    setHasManuallyReturnedToHub(true);
    router.replace("/dashboard/admin", { scroll: false });
  }, [router]);

  const adminHero = (
    <DashboardHubHero
      variant="admin"
      icon={ShieldCheck}
      eyebrow="Centro de control · Administración"
      title="Centro de control operativo"
      description="Estado del sistema, seguridad y auditoría en una sola lectura antes de abrir cada módulo."
      statusLabel={systemStatusLabel}
      statusTone={getHeroStatusTone(systemStatus)}
      metrics={[
        {
          label: "Eventos de auditoría",
          value: auditEntriesCount,
          hint: "Registros totales",
        },
        {
          label: "Tipos de evento",
          value: eventTypesCount,
          hint: "Categorías distintas",
        },
      ]}
      primaryActionLabel="Abrir administración"
      onPrimaryAction={() => activateModule("admin")}
    />
  );

  const adminCards = [
    {
      icon: Settings2,
      title: "Administración",
      description: "Resumen operativo, alertas críticas y métricas del sistema.",
      moduleId: "admin" as AdminModule,
      onClick: () => activateModule("admin"),
      actionLabel: "Ver resumen",
    },
    {
      icon: ClipboardPlus,
      title: "Subir informe",
      description: "Cargar nuevos informes vinculados a tokens de clínica.",
      moduleId: "admin-report-upload" as AdminModule,
      onClick: () => activateModule("admin-report-upload"),
      actionLabel: "Ir a carga",
    },
    {
      icon: Activity,
      title: "Estado del sistema",
      description: "Salud de servicios, esquema y mantenimiento backend.",
      moduleId: "admin-health" as AdminModule,
      onClick: () => activateModule("admin-health"),
      badge:
        systemStatus !== "ok" ? (
          <Badge variant={systemStatusVariant}>{systemStatusLabel}</Badge>
        ) : null,
      actionLabel: "Ver estado",
    },
    {
      icon: Building2,
      title: "Clínicas",
      description: "Crear, buscar y editar clínicas registradas en el portal.",
      moduleId: "admin-clinics" as AdminModule,
      onClick: () => activateModule("admin-clinics"),
      actionLabel: "Gestionar",
    },
    {
      icon: TicketCheck,
      title: "Tokens particulares",
      description: "Revisar y gestionar tokens de acceso para particulares.",
      moduleId: "admin-particular-tokens" as AdminModule,
      onClick: () => activateModule("admin-particular-tokens"),
      actionLabel: "Ver tokens",
    },
    {
      icon: ReceiptText,
      title: "Precios",
      description: "Actualizar precios del portal visibles en /precios.",
      moduleId: "admin-pricing" as AdminModule,
      onClick: () => activateModule("admin-pricing"),
      actionLabel: "Editar precios",
    },
    {
      icon: KeyRound,
      title: "Sesiones",
      description: "Consultar y revocar sesiones activas de clínicas.",
      moduleId: "admin-sessions" as AdminModule,
      onClick: () => activateModule("admin-sessions"),
      actionLabel: "Ver sesiones",
    },
    {
      icon: UsersRound,
      title: "Usuarios y roles",
      description: "Permisos administrativos y de clínica con trazabilidad.",
      moduleId: "admin-users-roles" as AdminModule,
      onClick: () => activateModule("admin-users-roles"),
      actionLabel: "Ver usuarios",
    },
    {
      icon: ScrollText,
      title: "Auditoría",
      description: "Log de eventos con filtros por tipo de evento y actor.",
      moduleId: "audit-log" as AdminModule,
      onClick: () => activateModule("audit-log"),
      actionLabel: "Ver log",
    },
    {
      icon: ShieldCheck,
      title: "Mantenimiento",
      description: "Dry-run de mantenimiento y verificación de esquema.",
      moduleId: "admin-maintenance" as AdminModule,
      onClick: () => activateModule("admin-maintenance"),
      actionLabel: "Ver mantenimiento",
    },
  ];

  const activeMeta = activeModule ? ADMIN_MODULE_META[activeModule] : null;

  // Single persistent, opaque, isolated stage for the Hub<->module swap. The
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
          title={activeMeta.title}
          description={activeMeta.description}
          moduleId={activeModule}
          onBack={backToHub}
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
      ) : (
        <>
          {pageHeader}
          <DashboardModuleHub
            heading="Módulos de administración"
            description="Acceso a clínicas, precios, sesiones, auditoría y estado del sistema."
            cards={adminCards}
            hero={adminHero}
          />
        </>
      )}
    </div>
  );
}
