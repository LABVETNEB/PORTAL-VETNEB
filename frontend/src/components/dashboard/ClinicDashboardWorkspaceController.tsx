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
import { formatDate } from "@/lib/utils";
import type { DashboardStats, FieldVisit, Report } from "@/types";

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
  stats: DashboardStats | null;
  statsLoadError: boolean;
  recentReports: Report[];
  reportsLoadError: boolean;
  recentVisits: FieldVisit[];
  visitsLoadError: boolean;
  pendingReports: number;
  activeVisits: number;
  workspaces: ClinicWorkspaceSlots;
  /** Page header rendered only on the hub; hidden in modules to reclaim height. */
  pageHeader?: ReactNode;
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

type ClinicDashboardCockpitProps = {
  stats: DashboardStats | null;
  statsLoadError: boolean;
  recentReports: Report[];
  reportsLoadError: boolean;
  recentVisits: FieldVisit[];
  visitsLoadError: boolean;
  pendingReports: number;
  activeVisits: number;
  activateModule: (moduleId: ClinicModule) => void;
};

function getActivityTime(value: string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getLatestActivity(
  recentReports: Report[],
  recentVisits: FieldVisit[],
) {
  const latestReport = recentReports[0];
  const latestVisit = recentVisits[0];

  const reportTime = latestReport
    ? getActivityTime(latestReport.updatedAt ?? latestReport.uploadDate)
    : 0;
  const visitTime = latestVisit
    ? getActivityTime(latestVisit.scheduledAt)
    : 0;

  if (latestReport && reportTime >= visitTime) {
    return {
      title: latestReport.patientName ?? "Informe sin nombre",
      detail: `${latestReport.studyType ?? "Estudio"} · ${formatDate(latestReport.uploadDate)}`,
    };
  }

  if (latestVisit) {
    return {
      title: latestVisit.clinicName ?? `Clínica #${latestVisit.clinicId}`,
      detail: `Visita de campo · ${formatDate(latestVisit.scheduledAt)}`,
    };
  }

  return null;
}

function ClinicDashboardCockpit({
  stats,
  statsLoadError,
  recentReports,
  reportsLoadError,
  recentVisits,
  visitsLoadError,
  pendingReports,
  activeVisits,
  activateModule,
}: ClinicDashboardCockpitProps) {
  const latestActivity = getLatestActivity(recentReports, recentVisits);
  const hasAnyError = statsLoadError || reportsLoadError || visitsLoadError;
  const attentionItems = [
    pendingReports > 0
      ? `${pendingReports} informe(s) pendiente(s) de entrega.`
      : null,
    activeVisits > 0
      ? `${activeVisits} visita(s) activa(s) o programada(s).`
      : null,
    statsLoadError ? "Métricas operativas degradadas." : null,
    reportsLoadError ? "Informes recientes no disponibles." : null,
    visitsLoadError ? "Continuidad logística no disponible." : null,
  ].filter(Boolean);

  const moduleItems: Array<{
    moduleId: ClinicModule;
    label: string;
    detail: string;
    icon: typeof LayoutDashboard;
  }> = [
    {
      moduleId: "operaciones",
      label: "Operaciones",
      detail: "Métricas y continuidad del día",
      icon: LayoutDashboard,
    },
    {
      moduleId: "informes",
      label: "Informes",
      detail: `${recentReports.length} reciente(s)`,
      icon: FileText,
    },
    {
      moduleId: "logistica",
      label: "Logística",
      detail: `${recentVisits.length} visita(s) reciente(s)`,
      icon: Route,
    },
    {
      moduleId: "perfil",
      label: "Perfil",
      detail: "Publicación y datos visibles",
      icon: Building2,
    },
    {
      moduleId: "tokens",
      label: "Tokens",
      detail: "Accesos particulares",
      icon: KeyRound,
    },
  ];

  return (
    <section
      data-dashboard-module-hub="true"
      data-clinic-cockpit="true"
      aria-label="Cockpit operativo de clínica"
      className="clinic-cockpit-hub dashboard-module-surface rounded-xl border border-vetneb-line/75 bg-card/92 p-3 shadow-[0_16px_42px_rgba(15,45,62,0.08)] sm:p-4"
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div
          data-clinic-cockpit-status="true"
          className="surface-soft flex min-h-0 flex-col justify-between gap-3 overflow-hidden"
        >
          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-vetneb-navy/80">
              Estado operativo clínica
            </p>
            <h2 className="mt-1 text-xl font-semibold leading-tight text-vetneb-ink">
              {hasAnyError ? "Operación con señales degradadas" : "Operación al día"}
            </h2>
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
              {hasAnyError
                ? "Revise métricas, informes o visitas antes de continuar la agenda diagnóstica."
                : "Informes y logística están sincronizados para continuar la operación."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="dashboard-kpi-pill" data-tone="critical">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wide">
                Pendientes
              </p>
              <p className="mt-1 text-xl font-bold leading-none">
                {statsLoadError ? "—" : pendingReports}
              </p>
            </div>
            <div className="dashboard-kpi-pill" data-tone="focus">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wide">
                Visitas
              </p>
              <p className="mt-1 text-xl font-bold leading-none">
                {statsLoadError ? "—" : activeVisits}
              </p>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-1 gap-3 lg:grid-rows-[auto_1fr]">
          <div className="grid min-h-0 grid-cols-1 gap-3 sm:grid-cols-3">
            <div
              data-clinic-cockpit-attention="true"
              className="surface-soft min-h-0 overflow-hidden"
            >
              <p className="text-sm font-semibold text-vetneb-ink">
                Atención requerida
              </p>
              {attentionItems.length ? (
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {attentionItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Sin pendientes operativos detectados.
                </p>
              )}
            </div>

            <div
              data-clinic-cockpit-continuity="true"
              className="surface-soft min-h-0 overflow-hidden"
            >
              <p className="text-sm font-semibold text-vetneb-ink">
                Continuidad logística
              </p>
              <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                {visitsLoadError
                  ? "No se pudo confirmar la continuidad logística reciente."
                  : activeVisits > 0
                    ? "Hay visitas activas para sostener seguimiento de campo."
                    : "Sin visitas activas registradas en la lectura actual."}
              </p>
            </div>

            <div
              data-clinic-cockpit-activity="true"
              className="surface-soft min-h-0 overflow-hidden"
            >
              <p className="text-sm font-semibold text-vetneb-ink">
                Actividad reciente
              </p>
              {latestActivity ? (
                <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground/85">
                    {latestActivity.title}
                  </span>{" "}
                  · {latestActivity.detail}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Sin actividad reciente disponible.
                </p>
              )}
            </div>
          </div>

          <div className="grid min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)]">
            <div
              data-clinic-cockpit-modules="true"
              className="dashboard-inline-list rounded-lg border border-vetneb-line/75 bg-card/82"
            >
              <div className="shrink-0 border-b border-vetneb-line/70 px-3 py-2">
                <h3 className="text-sm font-semibold text-vetneb-ink">
                  Módulos clínicos
                </h3>
                <p className="dashboard-section-description line-clamp-1">
                  Acceso operativo dentro del stage del dashboard.
                </p>
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 p-2">
                {moduleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.moduleId}
                      type="button"
                      data-clinic-cockpit-module-card={item.moduleId}
                      onClick={() => activateModule(item.moduleId)}
                      className="dashboard-card-interactive flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-vetneb-line/70 bg-vetneb-surface-muted/55 px-3 py-2 text-left"
                    >
                      <span className="dashboard-cockpit-tile-icon h-8 w-8">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-vetneb-ink">
                          {item.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.detail}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              data-clinic-cockpit-primary-actions="true"
              className="surface-soft hidden min-h-0 flex-col justify-center gap-2 overflow-hidden lg:flex"
            >
              <p className="text-sm font-semibold text-vetneb-ink">
                Acciones principales
              </p>
              <div className="grid grid-cols-1 gap-2">
                {moduleItems.map((item) => (
                  <button
                    key={item.moduleId}
                    type="button"
                    onClick={() => activateModule(item.moduleId)}
                    className="dashboard-btn-interactive flex min-h-8 items-center justify-between rounded-md border border-vetneb-line/70 bg-card/90 px-3 text-sm font-semibold text-vetneb-navy"
                  >
                    <span>
                      {item.moduleId === "tokens"
                        ? "Generar o abrir tokens"
                        : `Abrir ${item.label.toLowerCase()}`}
                    </span>
                    <span aria-hidden="true">&gt;</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">
        {stats ? "Métricas disponibles" : "Métricas no disponibles"}
      </span>
    </section>
  );
}

export function ClinicDashboardWorkspaceController({
  initialModule,
  stats,
  statsLoadError,
  recentReports,
  reportsLoadError,
  recentVisits,
  visitsLoadError,
  pendingReports,
  activeVisits,
  workspaces,
  pageHeader,
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

  useEffect(
    () =>
      subscribeClinicHubReset(() => {
        setActiveModule(null);
        setHasManuallyReturnedToHub(true);
      }),
    [],
  );

  useEffect(
    () =>
      subscribeClinicModuleActivate((moduleId) => {
        const parsed = parseModuleFromUrl(moduleId);
        if (!parsed) return;
        setHasManuallyReturnedToHub(false);
        setActiveModule(parsed);
      }),
    [],
  );

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

  if (activeModule) {
    const meta = MODULE_META[activeModule];
    return (
      <div
        data-dashboard-module-stage="true"
        data-clinic-dashboard-stage="true"
        className="flex min-h-0 flex-1 flex-col overflow-hidden dashboard-module-stage"
      >
        <DashboardModuleWorkspace
          title={meta.title}
          description={meta.description}
          moduleId={activeModule}
          onBack={backToHub}
        >
          {workspaces[activeModule]}
        </DashboardModuleWorkspace>
      </div>
    );
  }

  return (
    <div
      data-dashboard-module-stage="true"
      data-clinic-dashboard-stage="true"
      className="flex min-h-0 flex-1 flex-col overflow-hidden dashboard-module-stage"
    >
      {pageHeader}
      <ClinicDashboardCockpit
        stats={stats}
        statsLoadError={statsLoadError}
        recentReports={recentReports}
        reportsLoadError={reportsLoadError}
        recentVisits={recentVisits}
        visitsLoadError={visitsLoadError}
        pendingReports={pendingReports}
        activeVisits={activeVisits}
        activateModule={activateModule}
      />
    </div>
  );
}
