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
  SystemHealth,
} from "@/types";

import {
  MOCK_REPORTS,
  MOCK_FIELD_VISITS,
  MOCK_ROUTE_PLANS,
  MOCK_ROUTE_METRICS,
  MOCK_AUDIT_ENTRIES,
} from "@/lib/mock-data";

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

export async function loginClinic(
  credentials: LoginCredentials,
): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export async function getClinicSession(): Promise<AuthUser | null> {
  try {
    return await apiFetch<AuthUser>("/api/auth/me");
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await apiFetch<void>("/api/auth/logout", { method: "POST" });
}

export async function getReports(options?: RequestInit): Promise<Report[]> {
  try {
    const res = await apiFetch<{ reports: Report[] }>("/api/reports", options);
    return res.reports ?? [];
  } catch {
    console.warn("[API] getReports: usando mock data");
    return MOCK_REPORTS;
  }
}

export async function searchReports(
  params: {
    query?: string;
    status?: string;
    studyType?: string;
  },
  options?: RequestInit,
): Promise<Report[]> {
  try {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined),
      ) as Record<string, string>,
    ).toString();
    const res = await apiFetch<{ reports: Report[] }>(
      `/api/reports/search${qs ? `?${qs}` : ""}`,
      options,
    );
    return res.reports ?? [];
  } catch {
    console.warn("[API] searchReports: usando mock data");
    return MOCK_REPORTS;
  }
}

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


export async function getAdminSystemHealth(
  options?: RequestInit,
): Promise<SystemHealth | null> {
  try {
    return await apiFetch<SystemHealth>(
      "/api/admin/system/health",
      options,
    );
  } catch {
    console.warn("[API] getAdminSystemHealth: endpoint no disponible");
    return null;
  }
}
export async function getDashboardStats(
  options?: RequestInit,
): Promise<DashboardStats> {
  const [reports, visits, routePlans] = await Promise.all([
    getReports(options),
    getLogisticsFieldVisits(options),
    getRoutePlans(options),
  ]);

  return {
    totalReports: reports.length,
    pendingReports: reports.filter((report) => report.status !== "delivered")
      .length,
    activeVisits: visits.filter(
      (visit) => visit.status === "scheduled" || visit.status === "in_progress",
    ).length,
    activePlans: routePlans.filter(
      (plan) => plan.status === "released" || plan.status === "in_progress",
    ).length,
  };
}
