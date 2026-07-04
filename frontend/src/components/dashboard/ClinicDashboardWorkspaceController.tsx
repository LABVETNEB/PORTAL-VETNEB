"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Building2,
  ChevronRight,
  Clock3,
  FileText,
  KeyRound,
  LayoutDashboard,
  Map,
  Route,
  TriangleAlert,
  Truck,
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
      className="clinic-cockpit-hub"
    >
      <header
        data-clinic-cockpit-status="true"
        className="dashboard-hub-band"
      >
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="min-w-0">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-vetneb-navy/80">
              Estado operativo clínica
            </p>
            <div className="mt-0.5 flex min-w-0 items-center gap-2">
              <span
                className="dashboard-status-dot"
                data-tone={hasAnyError ? "warn" : "ok"}
                aria-hidden="true"
              />
              <h2 className="truncate text-lg font-semibold leading-tight text-vetneb-ink sm:text-xl">
                {hasAnyError ? "Operación con señales degradadas" : "Operación al día"}
              </h2>
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground sm:text-sm">
              {hasAnyError
                ? "Revise métricas, informes o visitas antes de continuar la agenda diagnóstica."
                : "Informes y logística están sincronizados para continuar la operación."}
            </p>
          </div>

          <div
            className="clinic-hub-kpis lg:w-[34rem] lg:shrink-0"
            role="group"
            aria-label="Indicadores operativos de clínica"
          >
            <div className="dashboard-kpi-chip" data-tone="critical">
              <span className="dashboard-kpi-chip-icon">
                <Clock3 className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="dashboard-kpi-chip-label">Pendientes</span>
                <span className="dashboard-kpi-chip-value">
                  {statsLoadError ? "—" : pendingReports}
                </span>
              </span>
            </div>
            <div className="dashboard-kpi-chip" data-tone="focus">
              <span className="dashboard-kpi-chip-icon">
                <Route className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="dashboard-kpi-chip-label">Visitas</span>
                <span className="dashboard-kpi-chip-value">
                  {statsLoadError ? "—" : activeVisits}
                </span>
              </span>
            </div>
            <div className="dashboard-kpi-chip hidden sm:flex" data-tone="neutral">
              <span className="dashboard-kpi-chip-icon">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="dashboard-kpi-chip-label">Informes</span>
                <span className="dashboard-kpi-chip-value">
                  {statsLoadError || !stats ? "—" : stats.totalReports}
                </span>
              </span>
            </div>
            <div className="dashboard-kpi-chip hidden sm:flex" data-tone="neutral">
              <span className="dashboard-kpi-chip-icon">
                <Map className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="dashboard-kpi-chip-label">Rutas</span>
                <span className="dashboard-kpi-chip-value">
                  {statsLoadError || !stats ? "—" : stats.activePlans}
                </span>
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="clinic-hub-body">
        <div className="clinic-hub-modules">
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <h3 className="dashboard-section-heading">Módulos clínicos</h3>
              <p className="dashboard-section-description hidden line-clamp-1 sm:block">
                Acceso operativo dentro del stage del dashboard.
              </p>
            </div>
            <span className="clinic-hub-count-badge">
              {moduleItems.length} módulos
            </span>
          </div>

          <div data-clinic-cockpit-modules="true" className="clinic-hub-tile-grid">
            {moduleItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.moduleId}
                  type="button"
                  data-clinic-cockpit-module-card={item.moduleId}
                  onClick={() => activateModule(item.moduleId)}
                  className="clinic-hub-tile dashboard-card-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
                >
                  <span className="clinic-hub-tile-icon">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-vetneb-ink">
                      {item.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.detail}
                    </span>
                  </span>
                  <ChevronRight
                    className="clinic-hub-tile-chevron h-4 w-4"
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>

          <div
            data-clinic-cockpit-primary-actions="true"
            className="clinic-hub-actions"
            aria-label="Acciones principales"
          >
            {moduleItems.map((item) => (
              <button
                key={item.moduleId}
                type="button"
                onClick={() => activateModule(item.moduleId)}
                className="clinic-hub-action dashboard-btn-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
              >
                <span>
                  {item.moduleId === "tokens"
                    ? "Generar o abrir tokens"
                    : `Abrir ${item.label.toLowerCase()}`}
                </span>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        <aside className="clinic-hub-signals" aria-label="Señales operativas">
          <section
            data-clinic-cockpit-attention="true"
            data-tone={attentionItems.length ? "warn" : "ok"}
            className="clinic-hub-signal"
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <TriangleAlert
                className="clinic-hub-signal-icon h-3.5 w-3.5"
                aria-hidden="true"
              />
              <p className="truncate text-[0.8rem] font-semibold text-vetneb-ink">
                Atención requerida
              </p>
            </div>
            {attentionItems.length ? (
              <ul className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
                {attentionItems.slice(0, 3).map((item) => (
                  <li key={item} className="truncate">
                    {item}
                  </li>
                ))}
                {attentionItems.length > 3 ? (
                  <li className="truncate font-semibold text-foreground/75">
                    +{attentionItems.length - 3} señal(es) adicionales en módulos.
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="line-clamp-1 text-xs text-muted-foreground">
                Sin pendientes operativos detectados.
              </p>
            )}
          </section>

          <section
            data-clinic-cockpit-continuity="true"
            data-tone="teal"
            className="clinic-hub-signal"
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <Truck
                className="clinic-hub-signal-icon h-3.5 w-3.5"
                aria-hidden="true"
              />
              <p className="truncate text-[0.8rem] font-semibold text-vetneb-ink">
                Continuidad logística
              </p>
            </div>
            <p className="line-clamp-1 text-xs text-muted-foreground md:line-clamp-2">
              {visitsLoadError
                ? "No se pudo confirmar la continuidad logística reciente."
                : activeVisits > 0
                  ? "Hay visitas activas para sostener seguimiento de campo."
                  : "Sin visitas activas registradas en la lectura actual."}
            </p>
          </section>

          <section
            data-clinic-cockpit-activity="true"
            data-tone="cyan"
            className="clinic-hub-signal"
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <Activity
                className="clinic-hub-signal-icon h-3.5 w-3.5"
                aria-hidden="true"
              />
              <p className="truncate text-[0.8rem] font-semibold text-vetneb-ink">
                Actividad reciente
              </p>
            </div>
            {latestActivity ? (
              <p className="line-clamp-1 text-xs text-muted-foreground md:line-clamp-2">
                <span className="font-semibold text-foreground/85">
                  {latestActivity.title}
                </span>{" "}
                · {latestActivity.detail}
              </p>
            ) : (
              <p className="line-clamp-1 text-xs text-muted-foreground">
                Sin actividad reciente disponible.
              </p>
            )}
          </section>
        </aside>
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
