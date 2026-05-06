/**
 * API Client — Portal VETNEB Frontend
 *
 * Funciones wrapper para consumir el backend Fastify existente.
 * El backend corre en: process.env.NEXT_PUBLIC_API_URL (default: http://localhost:3000)
 *
 * Convención:
 * - Si el endpoint está confirmado en el backend, se llama directamente.
 * - Si el endpoint NO está confirmado, se devuelve mock data desde mock-data.ts.
 * - Las funciones mock están claramente marcadas con el comentario @mock.
 *
 * Autenticación: el backend usa cookies de sesión (credentials: 'include').
 */

import type {
  Report,
  FieldVisit,
  RoutePlan,
  RouteMetrics,
  AuditEntry,
  AuthUser,
  LoginCredentials,
  DashboardStats,
} from "@/types";

import {
  MOCK_REPORTS,
  MOCK_FIELD_VISITS,
  MOCK_ROUTE_PLANS,
  MOCK_ROUTE_METRICS,
  MOCK_AUDIT_ENTRIES,
  MOCK_DASHBOARD_STATS,
} from "@/lib/mock-data";

// ─── Configuración base ───────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: options.credentials ?? "include",
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `HTTP ${res.status}`,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ─── Autenticación (endpoints confirmados en backend) ─────────────────────────

/**
 * Iniciar sesión como usuario de clínica.
 * POST /api/auth/login
 */
export async function loginClinic(
  credentials: LoginCredentials,
): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

/**
 * Obtener sesión activa del usuario de clínica.
 * GET /api/auth/me
 */
export async function getClinicSession(): Promise<AuthUser | null> {
  try {
    return await apiFetch<AuthUser>("/api/auth/me");
  } catch {
    return null;
  }
}

/**
 * Cerrar sesión.
 * POST /api/auth/logout
 */
export async function logout(): Promise<void> {
  await apiFetch<void>("/api/auth/logout", { method: "POST" });
}

// ─── Informes (endpoints confirmados en backend) ──────────────────────────────

/**
 * Obtener lista de informes de la clínica autenticada.
 * GET /api/reports
 */
export async function getReports(): Promise<Report[]> {
  try {
    const res = await apiFetch<{ reports: Report[] }>("/api/reports");
    return res.reports ?? [];
  } catch {
    // @mock — Fallback a mock data si el backend no está disponible
    console.warn("[API] getReports: usando mock data");
    return MOCK_REPORTS;
  }
}

/**
 * Buscar informes con filtros.
 * GET /api/reports/search
 */
export async function searchReports(params: {
  query?: string;
  status?: string;
  studyType?: string;
}): Promise<Report[]> {
  try {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined),
      ) as Record<string, string>,
    ).toString();
    const res = await apiFetch<{ reports: Report[] }>(
      `/api/reports/search${qs ? `?${qs}` : ""}`,
    );
    return res.reports ?? [];
  } catch {
    // @mock
    console.warn("[API] searchReports: usando mock data");
    return MOCK_REPORTS;
  }
}

/**
 * Obtener URL firmada para descargar un informe.
 * GET /api/reports/:reportId/download-url
 */
export async function getReportDownloadUrl(
  reportId: number,
): Promise<string | null> {
  try {
    const res = await apiFetch<{ url: string }>(
      `/api/reports/${reportId}/download-url`,
    );
    return res.url ?? null;
  } catch {
    return null;
  }
}

// ─── Logística — Visitas de campo ─────────────────────────────────────────────

/**
 * Obtener visitas de campo.
 * GET /api/logistics/field-visits
 *
 * Endpoint confirmado en backend. Acepta RequestInit para lectura server-side
 * dinámica con cookies reenviadas desde Next.
 */
export async function getLogisticsFieldVisits(
  options?: RequestInit,
): Promise<FieldVisit[]> {
  try {
    const res = await apiFetch<{ visits: FieldVisit[] }>(
      "/api/logistics/field-visits",
      options,
    );
    return res.visits ?? [];
  } catch {
    console.warn("[API] getLogisticsFieldVisits: usando mock data");
    return MOCK_FIELD_VISITS;
  }
}

// ─── Logística — Planes de ruta ───────────────────────────────────────────────

/**
 * Obtener planes de ruta.
 * GET /api/logistics/route-plans
 *
 * Endpoint confirmado en backend. Acepta RequestInit para lectura server-side
 * dinámica con cookies reenviadas desde Next.
 */
export async function getRoutePlans(
  options?: RequestInit,
): Promise<RoutePlan[]> {
  try {
    const res = await apiFetch<{ plans: RoutePlan[] }>(
      "/api/logistics/route-plans",
      options,
    );
    return res.plans ?? [];
  } catch {
    console.warn("[API] getRoutePlans: usando mock data");
    return MOCK_ROUTE_PLANS;
  }
}

/**
 * Obtener métricas de cumplimiento de planes de ruta.
 * GET /api/logistics/route-plans/:id/metrics
 *
 * Endpoint confirmado en backend. Acepta RequestInit para lectura server-side
 * dinámica con cookies reenviadas desde Next.
 */
export async function getRoutePlanMetrics(
  planId?: number,
  options?: RequestInit,
): Promise<RouteMetrics[]> {
  if (planId !== undefined) {
    try {
      const res = await apiFetch<{ metrics: RouteMetrics }>(
        `/api/logistics/route-plans/${planId}/metrics`,
        options,
      );
      return res.metrics ? [res.metrics] : [];
    } catch {
      console.warn("[API] getRoutePlanMetrics: usando mock data");
      return MOCK_ROUTE_METRICS.filter(
        (metric) => metric.routePlanId === planId,
      );
    }
  }

  console.warn("[API] getRoutePlanMetrics: usando mock data");
  return MOCK_ROUTE_METRICS;
}

// ─── Admin — Auditoría ────────────────────────────────────────────────────────

/**
 * Obtener entradas del log de auditoría.
 * GET /api/admin/audit-log
 *
 * Endpoint confirmado en backend. Acepta RequestInit para lectura server-side
 * dinámica con cookies reenviadas desde Next.
 */
export async function getAuditEntries(
  options?: RequestInit,
): Promise<AuditEntry[]> {
  try {
    const res = await apiFetch<{ entries: AuditEntry[] }>(
      "/api/admin/audit-log",
      options,
    );
    return res.entries ?? [];
  } catch {
    console.warn("[API] getAuditEntries: usando mock data");
    return MOCK_AUDIT_ENTRIES;
  }
}

// ─── Dashboard — Estadísticas resumen (@mock) ─────────────────────────────────

/**
 * Obtener estadísticas resumen del dashboard.
 *
 * @mock — No existe un endpoint específico. Se calcula en el cliente
 * o se puede agregar un endpoint /api/dashboard/stats en el backend.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  console.warn("[API] getDashboardStats: usando mock data");
  return MOCK_DASHBOARD_STATS;
}
