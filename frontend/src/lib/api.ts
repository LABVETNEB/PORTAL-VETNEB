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
  MaintenancePurgeDryRunSnapshot,
  AdminSessionsQuery,
  AdminSessionsSnapshot,
  AdminUsersRolesQuery,
  AdminUsersRolesSnapshot,
  AdminClinicUserRoleChangeResponse,
  ClinicUserRole,
  AdminSessionRevocationResponse,
  AdminSessionType,
  AdminFailedLoginAlertsQuery,
  AdminFailedLoginAlertsSnapshot,
} from "@/types";

import {
  MOCK_REPORTS,
  MOCK_AUDIT_ENTRIES,
} from "@/lib/mock-data";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  const hasFormDataBody =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  if (
    options.body !== undefined &&
    !hasFormDataBody &&
    !headers.has("Content-Type")
  ) {
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

type AdminReportUploadResponse = {
  success: true;
  message: string;
  report: Report;
};

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

export async function uploadAdminReport(
  formData: FormData,
  options?: RequestInit,
): Promise<AdminReportUploadResponse> {
  return apiFetch<AdminReportUploadResponse>("/api/admin/reports/upload", {
    ...options,
    method: "POST",
    body: formData,
  });
}


export type ContactMessagePayload = {
  name: string;
  email: string;
  clinicName?: string | null;
  message: string;
};

export type ContactMessageResponse = {
  success: true;
  sent: boolean;
  reason?: "smtp_disabled";
  message: string;
};

export async function submitContactMessage(
  payload: ContactMessagePayload,
  options?: RequestInit,
): Promise<ContactMessageResponse> {
  return apiFetch<ContactMessageResponse>("/api/contact", {
    ...options,
    method: "POST",
    body: JSON.stringify(payload),
  });
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
    console.warn("[API] getLogisticsFieldVisits: endpoint no disponible");
    return [];
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
    console.warn("[API] getRoutePlans: endpoint no disponible");
    return [];
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
      console.warn("[API] getRoutePlanMetrics: endpoint no disponible");
      return [];
    }
  }

  console.warn("[API] getRoutePlanMetrics: requiere planId para usar endpoint real");
  return [];
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

export async function getAdminUsersRoles(
  params: AdminUsersRolesQuery = {},
  options?: RequestInit,
): Promise<AdminUsersRolesSnapshot> {
  const query = new URLSearchParams();

  if (params.userType) {
    query.set("userType", params.userType);
  }

  if (params.role) {
    query.set("role", params.role);
  }

  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }

  if (typeof params.offset === "number") {
    query.set("offset", String(params.offset));
  }

  const qs = query.toString();

  return apiFetch<AdminUsersRolesSnapshot>(
    `/api/admin/users-roles${qs ? `?${qs}` : ""}`,
    options,
  );
}

export async function changeAdminClinicUserRole(
  clinicUserId: number,
  role: ClinicUserRole,
  options?: RequestInit,
): Promise<AdminClinicUserRoleChangeResponse> {
  return apiFetch<AdminClinicUserRoleChangeResponse>(
    `/api/admin/users-roles/clinic/${clinicUserId}/role`,
    {
      ...options,
      method: "PATCH",
      body: JSON.stringify({ role }),
    },
  );
}
export async function getAdminSessions(
  params: AdminSessionsQuery = {},
  options?: RequestInit,
): Promise<AdminSessionsSnapshot> {
  const query = new URLSearchParams();

  if (params.sessionType) {
    query.set("sessionType", params.sessionType);
  }

  if (params.status) {
    query.set("status", params.status);
  }

  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }

  if (typeof params.offset === "number") {
    query.set("offset", String(params.offset));
  }

  const qs = query.toString();

  return apiFetch<AdminSessionsSnapshot>(
    `/api/admin/sessions${qs ? `?${qs}` : ""}`,
    options,
  );
}

export async function revokeAdminSession(
  sessionType: AdminSessionType,
  sessionId: number,
  options?: RequestInit,
): Promise<AdminSessionRevocationResponse> {
  return apiFetch<AdminSessionRevocationResponse>(
    `/api/admin/sessions/${sessionType}/${sessionId}/revoke`,
    {
      ...options,
      method: "POST",
    },
  );
}

export async function getAdminMaintenancePurgeDryRun(
  options?: RequestInit,
): Promise<MaintenancePurgeDryRunSnapshot> {
  return apiFetch<MaintenancePurgeDryRunSnapshot>(
    "/api/admin/system/maintenance/purge-dry-run",
    {
      ...options,
      method: "POST",
    },
  );
}

function buildAdminFailedLoginAlertsQueryString(
  params: AdminFailedLoginAlertsQuery = {},
) {
  const query = new URLSearchParams();

  if (params.surface) {
    query.set("surface", params.surface);
  }

  if (params.reason) {
    query.set("reason", params.reason);
  }

  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }

  if (typeof params.offset === "number") {
    query.set("offset", String(params.offset));
  }

  return query.toString();
}

export async function getAdminFailedLoginAlerts(
  params: AdminFailedLoginAlertsQuery = {},
  options?: RequestInit,
): Promise<AdminFailedLoginAlertsSnapshot> {
  const qs = buildAdminFailedLoginAlertsQueryString(params);

  return apiFetch<AdminFailedLoginAlertsSnapshot>(
    `/api/admin/failed-login-alerts${qs ? `?${qs}` : ""}`,
    options,
  );
}

export function buildAdminFailedLoginAlertsCsvUrl(
  params: AdminFailedLoginAlertsQuery = {},
) {
  const qs = buildAdminFailedLoginAlertsQueryString(params);

  return `${API_BASE_URL}/api/admin/failed-login-alerts/export.csv${qs ? `?${qs}` : ""}`;
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




