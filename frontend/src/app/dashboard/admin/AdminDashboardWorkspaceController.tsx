"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
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
import { DashboardModuleHub } from "@/components/dashboard/DashboardModuleHub";
import { DashboardModuleWorkspace } from "@/components/dashboard/DashboardModuleWorkspace";
import {
  ADMIN_LAST_MODULE_STORAGE_KEY,
  readDashboardLastModule,
  writeDashboardLastModule,
} from "@/lib/dashboard-last-module";

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

function parseModuleFromUrl(value: string | null): AdminModule | null {
  if (!value) return null;
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
  workspaces: AdminWorkspaceSlots;
  systemStatus: string;
  systemStatusLabel: string;
  systemStatusVariant: "default" | "secondary" | "destructive" | "outline";
};

const ADMIN_MODULE_META: Record<AdminModule, { title: string; description: string }> = {
  admin: {
    title: "Administración",
    description: "Resumen operativo, alertas críticas y métricas del sistema.",
  },
  "admin-report-upload": {
    title: "Subir informe",
    description: "Cargar nuevos informes vinculados a tokens de clínica.",
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
    title: "Roles clínica",
    description: "Auditoría de cambios de rol en usuarios de clínicas.",
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
  workspaces,
  systemStatus,
  systemStatusLabel,
  systemStatusVariant,
}: AdminDashboardWorkspaceControllerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeModule, setActiveModule] = useState<AdminModule | null>(
    initialModule ?? null,
  );
  const hasRestoredLastModule = useRef(false);
  const [hasManuallyReturnedToHub, setHasManuallyReturnedToHub] =
    useState(false);

  useEffect(() => {
    setActiveModule(parseModuleFromUrl(searchParams.get("module")));
  }, [searchParams]);

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
      setActiveModule(moduleId);
      router.push(`/dashboard/admin?module=${moduleId}`, { scroll: false });
    },
    [router],
  );

  const backToHub = useCallback(() => {
    setActiveModule(null);
    setHasManuallyReturnedToHub(true);
    router.replace("/dashboard/admin", { scroll: false });
  }, [router]);

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
      title: "Roles clínica",
      description: "Auditoría de cambios de rol en usuarios de clínicas.",
      moduleId: "admin-users-roles" as AdminModule,
      onClick: () => activateModule("admin-users-roles"),
      actionLabel: "Ver roles",
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
        {workspaces[activeModule]}
      </DashboardModuleWorkspace>
    );
  }

  return (
    <DashboardModuleHub
      heading="Módulos de administración"
      description="Acceso a clínicas, precios, sesiones, auditoría y estado del sistema."
      cards={adminCards}
    />
  );
}
