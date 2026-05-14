/**
 * API Client — Portal VETNEB Frontend
 *
 * Funciones wrapper para consumir el backend Fastify existente.
 * El backend corre en: process.env.NEXT_PUBLIC_API_URL (default: http://localhost:3000)
 *
 * Convención:
 * - Si el endpoint está confirmado en el backend, se llama directamente.
 * - Si el endpoint no está disponible, las funciones devuelven un estado vacío seguro.
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
  ParticularAuthResponse,
  ParticularLoginCredentials,
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

export async function loginParticular(
  credentials: ParticularLoginCredentials,
): Promise<ParticularAuthResponse> {
  return apiFetch<ParticularAuthResponse>("/api/particular/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export async function getParticularSession(): Promise<ParticularAuthResponse | null> {
  try {
    return await apiFetch<ParticularAuthResponse>("/api/particular/auth/me");
  } catch {
    return null;
  }
}

export async function logoutParticular(): Promise<void> {
  await apiFetch<void>("/api/particular/auth/logout", { method: "POST" });
}

export async function getParticularReportPreviewUrl(): Promise<string> {
  const response = await apiFetch<{ success: true; previewUrl: string }>(
    "/api/particular/auth/report/preview-url",
  );

  return response.previewUrl;
}

export async function getParticularReportDownloadUrl(): Promise<string> {
  const response = await apiFetch<{ success: true; downloadUrl: string }>(
    "/api/particular/auth/report/download-url",
  );

  return response.downloadUrl;
}

type ReportReadOptions = {
  throwOnError?: boolean;
};

export async function getReports(
  options?: RequestInit,
  params?: {
    status?: string;
    limit?: number;
    offset?: number;
  },
  readOptions: ReportReadOptions = {},
): Promise<Report[]> {
  try {
    const query = new URLSearchParams();

    if (params?.status?.trim()) {
      query.set("status", params.status.trim());
    }

    if (typeof params?.limit === "number") {
      query.set("limit", String(params.limit));
    }

    if (typeof params?.offset === "number") {
      query.set("offset", String(params.offset));
    }

    const qs = query.toString();
    const res = await apiFetch<{ reports: Report[] }>(
      `/api/reports${qs ? `?${qs}` : ""}`,
      options,
    );
    return res.reports ?? [];
  } catch (error) {
    console.warn("[API] getReports: endpoint no disponible");
    if (readOptions.throwOnError) {
      throw error;
    }

    return [];
  }
}

export async function searchReports(
  params: {
    query?: string;
    status?: string;
    studyType?: string;
  },
  options?: RequestInit,
  readOptions: ReportReadOptions = {},
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
  } catch (error) {
    console.warn("[API] searchReports: endpoint no disponible");
    if (readOptions.throwOnError) {
      throw error;
    }

    return [];
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
  const res = await apiFetch<{ url: string | null }>(
    `/api/reports/${reportId}/download-url`,
  );

  return res.url ?? null;
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


export type AdminParticularTokenSummary = {
  id: number;
  clinicId: number;
  reportId: number | null;
  tokenLast4: string;
  tutorLastName: string;
  petName: string;
  petAge: string;
  petBreed: string;
  petSex: string;
  petSpecies: string;
  sampleLocation: string;
  sampleEvolution: string;
  detailsLesion: string | null;
  extractionDate: string;
  shippingDate: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByAdminId: number | null;
  createdByClinicUserId: number | null;
  hasLinkedReport: boolean;
};

export type AdminParticularTokensSnapshot = {
  success: true;
  count: number;
  particularTokens: AdminParticularTokenSummary[];
  pagination: {
    limit: number;
    offset: number;
  };
  filters: {
    clinicId: number | null;
  };
};

export type AdminParticularTokenDetail = AdminParticularTokenSummary & {
  report: Report | null;
};

export type AdminParticularTokenReportLinkResponse = {
  success: true;
  message: string;
  particularToken: AdminParticularTokenDetail | null;
};


export type AdminParticularTokenCreatePayload = {
  clinicId: number;
  reportId?: number | null;
  tutorLastName: string;
  petName: string;
  petAge: string;
  petBreed: string;
  petSex: string;
  petSpecies: string;
  sampleLocation: string;
  sampleEvolution: string;
  detailsLesion: string;
  extractionDate: string;
  shippingDate: string;
};

export type AdminParticularTokenCreateResponse = {
  success: true;
  message: string;
  token: string;
  particularToken: AdminParticularTokenSummary;
};

export async function createAdminParticularToken(
  payload: AdminParticularTokenCreatePayload,
  options?: RequestInit,
): Promise<AdminParticularTokenCreateResponse> {
  return apiFetch<AdminParticularTokenCreateResponse>(
    "/api/admin/particular-tokens",
    {
      ...options,
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function getAdminParticularTokens(
  params: {
    clinicId?: number;
    limit?: number;
    offset?: number;
  } = {},
  options?: RequestInit,
): Promise<AdminParticularTokensSnapshot> {
  const query = new URLSearchParams();

  if (typeof params.clinicId === "number") {
    query.set("clinicId", String(params.clinicId));
  }

  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }

  if (typeof params.offset === "number") {
    query.set("offset", String(params.offset));
  }

  const qs = query.toString();

  return apiFetch<AdminParticularTokensSnapshot>(
    `/api/admin/particular-tokens${qs ? `?${qs}` : ""}`,
    options,
  );
}

export async function linkAdminParticularTokenReport(
  tokenId: number,
  reportId: number | null,
  options?: RequestInit,
): Promise<AdminParticularTokenReportLinkResponse> {
  return apiFetch<AdminParticularTokenReportLinkResponse>(
    `/api/admin/particular-tokens/${tokenId}/report`,
    {
      ...options,
      method: "PATCH",
      body: JSON.stringify({ reportId }),
    },
  );
}




export type ClinicParticularTokenSummary = AdminParticularTokenSummary;

export type ClinicParticularTokensSnapshot = {
  success: true;
  count: number;
  particularTokens: ClinicParticularTokenSummary[];
  pagination: {
    limit: number;
    offset: number;
  };
};

export type ClinicParticularTokenCreatePayload = {
  reportId?: number | null;
  tutorLastName: string;
  petName: string;
  petAge: string;
  petBreed: string;
  petSex: string;
  petSpecies: string;
  sampleLocation: string;
  sampleEvolution: string;
  detailsLesion: string;
  extractionDate: string;
  shippingDate: string;
};

export type ClinicParticularTokenCreateResponse = {
  success: true;
  message: string;
  token: string;
  particularToken: ClinicParticularTokenSummary;
};

export type ClinicParticularTokenReportLinkResponse = {
  success: true;
  message: string;
  particularToken: ClinicParticularTokenSummary | null;
};

export async function getClinicParticularTokens(
  params: {
    limit?: number;
    offset?: number;
  } = {},
  options?: RequestInit,
): Promise<ClinicParticularTokensSnapshot> {
  const query = new URLSearchParams();

  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }

  if (typeof params.offset === "number") {
    query.set("offset", String(params.offset));
  }

  const qs = query.toString();

  return apiFetch<ClinicParticularTokensSnapshot>(
    `/api/particular-tokens${qs ? `?${qs}` : ""}`,
    options,
  );
}

export async function createClinicParticularToken(
  payload: ClinicParticularTokenCreatePayload,
  options?: RequestInit,
): Promise<ClinicParticularTokenCreateResponse> {
  return apiFetch<ClinicParticularTokenCreateResponse>(
    "/api/particular-tokens",
    {
      ...options,
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function linkClinicParticularTokenReport(
  tokenId: number,
  reportId: number | null,
  options?: RequestInit,
): Promise<ClinicParticularTokenReportLinkResponse> {
  return apiFetch<ClinicParticularTokenReportLinkResponse>(
    `/api/particular-tokens/${tokenId}/report`,
    {
      ...options,
      method: "PATCH",
      body: JSON.stringify({ reportId }),
    },
  );
}

export type AdminStudyTrackingStage =
  | "reception"
  | "processing"
  | "evaluation"
  | "report_development"
  | "delivered";

export type AdminStudyTrackingCaseSummary = {
  id: number;
  clinicId: number;
  reportId: number | null;
  particularTokenId: number | null;
  createdByAdminId: number | null;
  createdByClinicUserId: number | null;
  receptionAt: string;
  estimatedDeliveryAt: string;
  estimatedDeliveryAutoCalculatedAt: string;
  estimatedDeliveryWasManuallyAdjusted: boolean;
  currentStage: AdminStudyTrackingStage;
  processingAt: string | null;
  evaluationAt: string | null;
  reportDevelopmentAt: string | null;
  deliveredAt: string | null;
  specialStainRequired: boolean;
  specialStainNotifiedAt: string | null;
  paymentUrl: string | null;
  adminContactEmail: string | null;
  adminContactPhone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminStudyTrackingCreatePayload = {
  clinicId: number;
  reportId?: number | null;
  particularTokenId?: number | null;
  receptionAt: string;
  estimatedDeliveryAt?: string | null;
  currentStage?: AdminStudyTrackingStage;
  specialStainRequired?: boolean;
  paymentUrl?: string | null;
  adminContactEmail?: string | null;
  adminContactPhone?: string | null;
  notes?: string | null;
};

export type AdminStudyTrackingCreateResponse = {
  success: true;
  message: string;
  trackingCase: AdminStudyTrackingCaseSummary;
};

export async function createAdminStudyTrackingCase(
  payload: AdminStudyTrackingCreatePayload,
  options?: RequestInit,
): Promise<AdminStudyTrackingCreateResponse> {
  return apiFetch<AdminStudyTrackingCreateResponse>(
    "/api/admin/study-tracking",
    {
      ...options,
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
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

type LogisticsReadOptions = {
  throwOnError?: boolean;
};

export async function getLogisticsFieldVisits(
  options?: RequestInit,
  readOptions: LogisticsReadOptions = {},
): Promise<FieldVisit[]> {
  try {
    const res = await apiFetch<{ visits: FieldVisit[] }>(
      "/api/logistics/field-visits",
      options,
    );
    return res.visits ?? [];
  } catch (error) {
    console.warn("[API] getLogisticsFieldVisits: endpoint no disponible");
    if (readOptions.throwOnError) {
      throw error;
    }

    return [];
  }
}

export async function getRoutePlans(
  options?: RequestInit,
  readOptions: LogisticsReadOptions = {},
): Promise<RoutePlan[]> {
  try {
    const res = await apiFetch<{ plans: RoutePlan[] }>(
      "/api/logistics/route-plans",
      options,
    );
    return res.plans ?? [];
  } catch (error) {
    console.warn("[API] getRoutePlans: endpoint no disponible");
    if (readOptions.throwOnError) {
      throw error;
    }

    return [];
  }
}

export async function getRoutePlanMetrics(
  planId?: number,
  options?: RequestInit,
  readOptions: LogisticsReadOptions = {},
): Promise<RouteMetrics[]> {
  if (planId !== undefined) {
    try {
      const res = await apiFetch<{ metrics: RouteMetrics }>(
        `/api/logistics/route-plans/${planId}/metrics`,
        options,
      );
      return res.metrics ? [res.metrics] : [];
    } catch (error) {
      console.warn("[API] getRoutePlanMetrics: endpoint no disponible");
      if (readOptions.throwOnError) {
        throw error;
      }

      return [];
    }
  }

  console.warn("[API] getRoutePlanMetrics: requiere planId para usar endpoint real");
  return [];
}

type AdminReadOptions = {
  throwOnError?: boolean;
};

export async function getAuditEntries(
  options?: RequestInit,
  readOptions: AdminReadOptions = {},
): Promise<AuditEntry[]> {
  try {
    const res = await apiFetch<{ entries: AuditEntry[] }>(
      "/api/admin/audit-log",
      options,
    );
    return res.entries ?? [];
  } catch (error) {
    console.warn("[API] getAuditEntries: endpoint no disponible");
    if (readOptions.throwOnError) {
      throw error;
    }

    return [];
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


export type ClinicPublicProfilePublication = {
  hasRequiredPublicFields: boolean;
  hasQualitySupplement: boolean;
  qualityScore: number;
  minimumQualityScore: number;
  isSearchEligible: boolean;
  missingRequiredFields: string[];
  missingRecommendedFields: string[];
  publicationErrors: string[];
};

export type ClinicPublicProfile = {
  clinicId: number;
  clinicName: string;
  displayName: string;
  avatarUrl: string | null;
  avatarStoragePath: string | null;
  aboutText: string | null;
  specialtyText: string | null;
  servicesText: string | null;
  email: string | null;
  phone: string | null;
  locality: string | null;
  country: string | null;
  isPublic: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  publication: ClinicPublicProfilePublication;
};

export type ClinicPublicProfileSearchSnapshot = {
  clinicId?: number;
  isPublic?: boolean;
  hasRequiredPublicFields?: boolean;
  isSearchEligible?: boolean;
  profileQualityScore?: number;
  updatedAt?: string;
  searchText?: string;
};

export type ClinicPublicProfileSnapshot = {
  success: true;
  profile: ClinicPublicProfile;
  search: ClinicPublicProfileSearchSnapshot | null;
};

export type ClinicPublicProfileUpdatePayload = {
  displayName?: string | null;
  aboutText?: string | null;
  specialtyText?: string | null;
  servicesText?: string | null;
  email?: string | null;
  phone?: string | null;
  locality?: string | null;
  country?: string | null;
  isPublic?: boolean;
};

export type ClinicPublicProfileUpdateResponse = {
  success: true;
  message: string;
  profile: ClinicPublicProfile;
  search: ClinicPublicProfileSearchSnapshot | null;
};

export async function getClinicPublicProfile(
  options?: RequestInit,
): Promise<ClinicPublicProfileSnapshot> {
  return apiFetch<ClinicPublicProfileSnapshot>(
    "/api/clinic/profile",
    options,
  );
}

export async function updateClinicPublicProfile(
  payload: ClinicPublicProfileUpdatePayload,
  options?: RequestInit,
): Promise<ClinicPublicProfileUpdateResponse> {
  return apiFetch<ClinicPublicProfileUpdateResponse>(
    "/api/clinic/profile",
    {
      ...options,
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function getDashboardStats(
  options?: RequestInit,
): Promise<DashboardStats> {
  const [reports, visits, routePlans] = await Promise.all([
    getReports(options, undefined, { throwOnError: true }),
    getLogisticsFieldVisits(options, { throwOnError: true }),
    getRoutePlans(options, { throwOnError: true }),
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
export type PublicProfessional = {
  clinicId: number;
  displayName: string;
  avatarUrl: string | null;
  specialtyText: string | null;
  servicesText: string | null;
  email: string | null;
  phone: string | null;
  locality: string | null;
  country: string | null;
  aboutText: string | null;
  updatedAt: string;
  relevance: {
    rank: number;
    similarity: number;
    score: number;
  };
  profileQualityScore: number | null;
};

export type PublicProfessionalsSearchSnapshot = {
  success: true;
  count: number;
  total: number;
  professionals: PublicProfessional[];
  filters: {
    query: string | null;
    locality: string | null;
    country: string | null;
  };
  pagination: {
    limit: number;
    offset: number;
  };
};

export async function searchPublicProfessionals(
  params: {
    query?: string;
    limit?: number;
    offset?: number;
  },
  options?: RequestInit,
): Promise<PublicProfessionalsSearchSnapshot> {
  const query = new URLSearchParams();

  if (params.query?.trim()) {
    query.set("q", params.query.trim());
  }

  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }

  if (typeof params.offset === "number") {
    query.set("offset", String(params.offset));
  }

  const qs = query.toString();

  return apiFetch<PublicProfessionalsSearchSnapshot>(
    `/api/public/professionals/search${qs ? `?${qs}` : ""}`,
    options,
  );
}
