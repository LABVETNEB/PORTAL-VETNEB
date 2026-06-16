"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  FileText,
  KeyRound,
  LayoutDashboard,
  Route,
} from "lucide-react";
import { DashboardModuleHub } from "./DashboardModuleHub";
import { DashboardModuleWorkspace } from "./DashboardModuleWorkspace";
import { ROUTES } from "@/lib/routes";
import {
  CLINIC_LAST_MODULE_STORAGE_KEY,
  readDashboardLastModule,
  writeDashboardLastModule,
} from "@/lib/dashboard-last-module";

const CLINIC_MODULE_VALUES = [
  "operaciones",
  "informes",
  "logistica",
  "perfil",
  "tokens",
] as const;

function parseModuleFromUrl(value: string | null): ClinicModule | null {
  if (!value) return null;
  return (CLINIC_MODULE_VALUES as readonly string[]).includes(value)
    ? (value as ClinicModule)
    : null;
}

export type ClinicModule =
  | "operaciones"
  | "informes"
  | "logistica"
  | "perfil"
  | "tokens";

type ClinicWorkspaceSlots = {
  operaciones: ReactNode;
  informes: ReactNode;
  logistica: ReactNode;
  perfil: ReactNode;
  tokens: ReactNode;
};

type ClinicDashboardWorkspaceControllerProps = {
  initialModule?: ClinicModule | null;
  pendingReports: number;
  activeVisits: number;
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
  pendingReports,
  activeVisits,
  workspaces,
}: ClinicDashboardWorkspaceControllerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeModule, setActiveModule] = useState<ClinicModule | null>(
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
    writeDashboardLastModule(CLINIC_LAST_MODULE_STORAGE_KEY, activeModule);
  }, [activeModule]);

  useEffect(() => {
    if (hasRestoredLastModule.current || hasManuallyReturnedToHub) return;
    if (searchParams.get("module")) return;
    const lastModule = parseModuleFromUrl(
      readDashboardLastModule(CLINIC_LAST_MODULE_STORAGE_KEY),
    );
    if (!lastModule) return;
    hasRestoredLastModule.current = true;
    router.replace(`${ROUTES.dashboard}?module=${lastModule}`, {
      scroll: false,
    });
  }, [searchParams, hasManuallyReturnedToHub, router]);

  const activateModule = useCallback(
    (moduleId: ClinicModule) => {
      setActiveModule(moduleId);
      router.push(`${ROUTES.dashboard}?module=${moduleId}`, { scroll: false });
    },
    [router],
  );

  const backToHub = useCallback(() => {
    setActiveModule(null);
    setHasManuallyReturnedToHub(true);
    router.replace(ROUTES.dashboard, { scroll: false });
  }, [router]);

  const clinicCards = [
    {
      icon: LayoutDashboard,
      title: "Centro de operaciones",
      description: "Métricas operativas, informes recientes y visitas activas.",
      moduleId: "operaciones",
      onClick: () => activateModule("operaciones"),
      badge:
        pendingReports > 0 ? (
          <span
            className="inline-flex items-center rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground"
            aria-label={`${pendingReports} informes pendientes`}
          >
            {pendingReports}
          </span>
        ) : null,
      actionLabel: "Ver resumen",
    },
    {
      icon: FileText,
      title: "Informes",
      description: "Consultar, filtrar y descargar informes veterinarios.",
      moduleId: "informes",
      onClick: () => activateModule("informes"),
      actionLabel: "Abrir informes",
    },
    {
      icon: Route,
      title: "Logística",
      description: "Visitas de campo, planes de ruta y métricas de cumplimiento.",
      moduleId: "logistica",
      onClick: () => activateModule("logistica"),
      badge:
        activeVisits > 0 ? (
          <span
            className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground"
            aria-label={`${activeVisits} visitas activas`}
          >
            {activeVisits}
          </span>
        ) : null,
      actionLabel: "Ver logística",
    },
    {
      icon: Building2,
      title: "Perfil público",
      description: "Publicar y actualizar el perfil en el banco de especialidades.",
      moduleId: "perfil",
      onClick: () => activateModule("perfil"),
      actionLabel: "Editar perfil",
    },
    {
      icon: KeyRound,
      title: "Tokens particulares",
      description: "Generar y gestionar tokens de acceso para pacientes.",
      moduleId: "tokens",
      onClick: () => activateModule("tokens"),
      actionLabel: "Gestionar tokens",
    },
  ];

  if (activeModule) {
    const meta = MODULE_META[activeModule];
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
      heading="Módulos operativos"
      description="Acceso rápido a informes, logística, perfil público y tokens de la clínica."
      cards={clinicCards}
    />
  );
}
