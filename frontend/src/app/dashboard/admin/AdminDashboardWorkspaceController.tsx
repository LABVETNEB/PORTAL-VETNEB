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
import type { AdminAccessErrorStatus } from "@/lib/api-error";
import { AdminAccessErrorState } from "./AdminAccessErrorState";

export type AdminModule =
  | "admin"
  | "admin-report-upload"
  | "admin-health"
  | "admin-clinics"
  | "admin-particular-tokens"
  | "admin-pricing"
  | "admin-sessions"
  | "admin-users-roles"
  | "audit-log"
  | "admin-maintenance";

const ADMIN_MODULE_VALUES = [
  "admin",
  "admin-report-upload",
  "admin-health",
  "admin-clinics",
  "admin-particular-tokens",
  "admin-pricing",
  "admin-sessions",
  "admin-users-roles",
  "audit-log",
  "admin-maintenance",
] as const;

const ADMIN_MODULE_ALIASES: Partial<Record<string, AdminModule>> = {
  "admin-upload-report": "admin-report-upload",
  maintenance: "admin-maintenance",
};

function parseModuleFromUrl(value: string | null): AdminModule | null {
  if (!value) return null;
  const alias = ADMIN_MODULE_ALIASES[value];
  if (alias) {
    return alias;
  }
  return (ADMIN_MODULE_VALUES as readonly string[]).includes(value)
    ? (value as AdminModule)
    : null;
}

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
  const [hasManuallyReturnedToHub, setHasManuallyReturnedToHub] =
    useState(false);

  useEffect(() => {
    const nextModule = parseModuleFromUrl(searchParams.get("module"));

    if (previousUrlModule.current !== nextModule) {
      clearAdminAccessError();
      previousUrlModule.current = nextModule;
    }

    setActiveModule(parseModuleFromUrl(searchParams.get("module")));
  }, [searchParams]);

  useEffect(() => () => clearAdminAccessError(), []);

  useEffect(() => {
    if (!activeModule) return;
    writeDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY, activeModule);
  }, [activeModule]);

  useEffect(() => {
    if (hasRestoredLastModule.current || hasManuallyReturnedToHub) return;
    if (searchParams.get("module")) return;
    const lastModule = parseModuleFromUrl(
      readDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY),
    );
    if (!lastModule) return;
    hasRestoredLastModule.current = true;
    router.replace(`/dashboard/admin?module=${lastModule}`, { scroll: false });
  }, [searchParams, hasManuallyReturnedToHub, router]);

  const activateModule = useCallback(
    (moduleId: AdminModule) => {
      clearAdminAccessError();
      setActiveModule(moduleId);
      router.push(`/dashboard/admin?module=${moduleId}`, { scroll: false });
    },
    [router],
  );

  const backToHub = useCallback(() => {
    clearAdminAccessError();
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

  if (activeModule) {
    const meta = ADMIN_MODULE_META[activeModule];
    return (
      <DashboardModuleWorkspace
        title={meta.title}
        description={meta.description}
        moduleId={activeModule}
        onBack={backToHub}
      >
        {accessErrorStatus ? (
          <AdminAccessErrorState status={accessErrorStatus} />
        ) : (
          workspaces[activeModule]
        )}
      </DashboardModuleWorkspace>
    );
  }

  if (accessErrorStatus) {
    return (
      <>
        {pageHeader}
        <AdminAccessErrorState status={accessErrorStatus} />
      </>
    );
  }

  return (
    <>
      {pageHeader}
      <DashboardModuleHub
        heading="Módulos de administración"
        description="Acceso a clínicas, precios, sesiones, auditoría y estado del sistema."
        cards={adminCards}
        hero={adminHero}
      />
    </>
  );
}
