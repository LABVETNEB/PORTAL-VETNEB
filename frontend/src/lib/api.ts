/**
 * API Client — Portal VETNEB Frontend
 *
 * Funciones wrapper para consumir el backend Fastify existente.
 * El backend corre en: process.env.NEXT_PUBLIC_API_URL.
 * En desarrollo local puede usar fallback a http://localhost:3000.
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
  UnifiedLoginCredentials,
  UnifiedLoginResponse,
  ParticularAuthResponse,
  ParticularLoginCredentials,
  DashboardStats,
  SystemHealth,
  AdminSchemaHealthSnapshot,
  MaintenancePurgeDryRunSnapshot,
  AdminSessionsQuery,
  AdminSessionsSnapshot,
  AdminUsersRolesQuery,
  AdminUsersRolesSnapshot,
  AdminClinicUserRoleChangeResponse,
  AdminClinicCreatePayload,
  AdminClinicCreateResponse,
  AdminClinicsSnapshot,
  AdminClinicUpdatePayload,
  AdminClinicUpdateResponse,
  AdminClinicUserCredentialsUpdatePayload,
  AdminClinicUserCredentialsUpdateResponse,
  ClinicUserRole,
  AdminSessionRevocationResponse,
  AdminSessionType,
  AdminFailedLoginAlertsQuery,
  AdminFailedLoginAlertsSnapshot,
} from "@/types";

const LOCAL_DEVELOPMENT_API_BASE_URL = "http://localhost:3000";
const SAME_ORIGIN_API_BASE_URL = "";

export const PUBLIC_API_CONFIGURATION_ERROR_MESSAGE =
  "El servicio público no está configurado para recibir solicitudes. Contacte a VETNEB por los canales oficiales.";
export const BACKEND_CONNECTION_ERROR_MESSAGE =
  "No se pudo conectar con el backend. Verifique sesión admin, CORS y despliegue backend/frontend.";
export const BACKEND_OPERATION_ERROR_MESSAGE =
  "El backend no pudo completar la operación. Reintentá y, si persiste, revisá estado del sistema y logs de backend.";
export const ADMIN_SCHEMA_HEALTH_UNAUTHORIZED_MESSAGE =
  "Sesión admin no autenticada o inválida. Iniciá sesión nuevamente.";
export const LOGIN_RATE_LIMIT_CLIENT_ERROR_MESSAGE =
  "Demasiados intentos de inicio de sesión. Intente más tarde.";

function isLocalOrLanHostname(hostname: string): boolean {
  const normalizedHost = hostname.trim().toLowerCase();

  if (
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1"
  ) {
    return true;
  }

  return normalizedHost.startsWith("192.168.");
}

function normalizeApiBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function resolveApiBaseUrlForRuntime(input: {
  nodeEnv?: string;
  nextPublicApiUrl?: string;
  isBrowserRuntime?: boolean;
} = {}): string {
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const nextPublicApiUrl = (
    input.nextPublicApiUrl ?? process.env.NEXT_PUBLIC_API_URL ?? ""
  ).trim();
  const isDevelopment = nodeEnv === "development";
  const isBrowserRuntime =
    input.isBrowserRuntime ?? typeof window !== "undefined";

  if (!nextPublicApiUrl) {
    if (isDevelopment) {
      return LOCAL_DEVELOPMENT_API_BASE_URL;
    }

    throw new Error(PUBLIC_API_CONFIGURATION_ERROR_MESSAGE);
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(nextPublicApiUrl);
  } catch {
    throw new Error(PUBLIC_API_CONFIGURATION_ERROR_MESSAGE);
  }

  if (!isDevelopment && isLocalOrLanHostname(parsedUrl.hostname)) {
    throw new Error(PUBLIC_API_CONFIGURATION_ERROR_MESSAGE);
  }

  // In browser runtime we intentionally keep API calls same-origin so Next rewrites
  // can proxy `/api/*` and session cookies stay bound to the frontend host.
  if (isBrowserRuntime) {
    return SAME_ORIGIN_API_BASE_URL;
  }

  return normalizeApiBaseUrl(nextPublicApiUrl);
}

function warnApiFallback(functionName: string, error: unknown): void {
  switch (functionName) {
    case "getReports":
      console.warn("[API] getReports: endpoint no disponible");
      break;
    case "searchReports":
      console.warn("[API] searchReports: endpoint no disponible");
      break;
    case "getLogisticsFieldVisits":
      console.warn("[API] getLogisticsFieldVisits: endpoint no disponible");
      break;
    case "getRoutePlans":
      console.warn("[API] getRoutePlans: endpoint no disponible");
      break;
    case "getRoutePlanMetrics":
      console.warn("[API] getRoutePlanMetrics: endpoint no disponible");
      break;
    case "getAuditEntries":
      console.warn("[API] getAuditEntries: endpoint no disponible");
      break;
    case "getAdminSystemHealth":
      console.warn("[API] getAdminSystemHealth: endpoint no disponible");
      break;
    default:
      console.warn(`[API] ${functionName}: endpoint no disponible`);
      break;
  }

  if (process.env.NODE_ENV === "development") {
    const errorDetail =
      error instanceof Error ? error.message : String(error);
    console.warn(`[API] ${functionName}: ${errorDetail}`);
  }
}

function readRetryAfterSeconds(headers: Headers): number | null {
  const retryAfterValue =
    headers.get("Retry-After") ?? headers.get("RateLimit-Reset");

  if (!retryAfterValue) {
    return null;
  }

  const retryAfterSeconds = Number.parseInt(retryAfterValue, 10);

  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) {
    return null;
  }

  return retryAfterSeconds;
}

function buildRateLimitErrorMessage(
  backendMessage: string | null,
  headers: Headers,
): string {
  const baseMessage = backendMessage ?? LOGIN_RATE_LIMIT_CLIENT_ERROR_MESSAGE;
  const retryAfterSeconds = readRetryAfterSeconds(headers);

  if (!retryAfterSeconds) {
    return baseMessage;
  }

  if (retryAfterSeconds >= 60) {
    const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);
    const unit = retryAfterMinutes === 1 ? "minuto" : "minutos";

    return `${baseMessage} Reintente en ${retryAfterMinutes} ${unit}.`;
  }

  const unit = retryAfterSeconds === 1 ? "segundo" : "segundos";

  return `${baseMessage} Reintente en ${retryAfterSeconds} ${unit}.`;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const apiBaseUrl = resolveApiBaseUrlForRuntime();
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

  let res: Response;

  try {
    res = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      credentials: options.credentials ?? "include",
      headers,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      const errorDetail =
        error instanceof Error ? error.message : String(error);
      console.warn(`[API] ${path}: ${errorDetail}`);
    }

    if (error instanceof TypeError) {
      throw new Error(BACKEND_CONNECTION_ERROR_MESSAGE);
    }

    throw error;
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: unknown;
      message?: unknown;
    };
    const backendMessage =
      typeof body.error === "string" && body.error.trim()
        ? body.error
        : typeof body.message === "string" && body.message.trim()
          ? body.message
          : null;

    if (res.status === 429) {
      throw new Error(buildRateLimitErrorMessage(backendMessage, res.headers));
    }

    if (backendMessage) {
      throw new Error(backendMessage);
    }

    if (res.status >= 500) {
      throw new Error(BACKEND_OPERATION_ERROR_MESSAGE);
    }

    throw new Error(`HTTP ${res.status}`);
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

export async function loginUnified(
  credentials: UnifiedLoginCredentials,
): Promise<UnifiedLoginResponse> {
  return apiFetch<UnifiedLoginResponse>("/api/auth/login", {
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

const PARTICULAR_SESSION_RECOVERABLE_ERRORS = new Set([
  "Particular no autenticado",
  "Sesión particular inválida",
  "Sesión particular expirada",
  "Token particular inválido o inactivo",
]);

export async function getParticularSession(): Promise<ParticularAuthResponse | null> {
  try {
    return await apiFetch<ParticularAuthResponse>("/api/particular/auth/me");
  } catch (error) {
    if (
      error instanceof Error &&
      PARTICULAR_SESSION_RECOVERABLE_ERRORS.has(error.message)
    ) {
      return null;
    }

    throw error;
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

const PARTICULAR_STUDY_TRACKING_RECOVERABLE_ERRORS = new Set([
  "Particular no autenticado",
  "Sesión particular inválida",
  "Sesión particular expirada",
  "Token particular inválido o inactivo",
  "Seguimiento no encontrado para el token particular autenticado",
]);

export async function getParticularStudyTrackingCase(): Promise<AdminStudyTrackingCaseSummary | null> {
  try {
    const response = await apiFetch<{
      success: true;
      trackingCase: AdminStudyTrackingCaseSummary;
    }>("/api/particular/study-tracking/me");
    return response.trackingCase;
  } catch (error) {
    if (
      error instanceof Error &&
      PARTICULAR_STUDY_TRACKING_RECOVERABLE_ERRORS.has(error.message)
    ) {
      return null;
    }

    throw error;
  }
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
    warnApiFallback("getReports", error);
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
    warnApiFallback("searchReports", error);
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
  recipientEmail: string;
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

export type AdminParticularTokenRevokeResponse = {
  success: true;
  message: string;
  particularToken: AdminParticularTokenDetail | null;
};

export async function revokeAdminParticularToken(
  tokenId: number,
  options?: RequestInit,
): Promise<AdminParticularTokenRevokeResponse> {
  return apiFetch<AdminParticularTokenRevokeResponse>(
    `/api/admin/particular-tokens/${tokenId}/revoke`,
    {
      ...options,
      method: "PATCH",
    },
  );
}

export type AdminParticularTokenDeleteResponse = {
  success: true;
  message: string;
  deletedTokenId: number;
};

export async function deleteAdminParticularToken(
  tokenId: number,
  options?: RequestInit,
): Promise<AdminParticularTokenDeleteResponse> {
  return apiFetch<AdminParticularTokenDeleteResponse>(
    `/api/admin/particular-tokens/${tokenId}`,
    {
      ...options,
      method: "DELETE",
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
  recipientEmail: string;
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

export type AdminStudyTrackingSnapshot = {
  success: true;
  count: number;
  trackingCases: AdminStudyTrackingCaseSummary[];
  pagination: {
    limit: number;
    offset: number;
  };
};

export type AdminStudyTrackingUpdatePayload = {
  reportId?: number | null;
  particularTokenId?: number | null;
  currentStage?: AdminStudyTrackingStage;
  specialStainRequired?: boolean;
  paymentUrl?: string | null;
  adminContactEmail?: string | null;
  adminContactPhone?: string | null;
  notes?: string | null;
};

export type AdminStudyTrackingUpdateResponse = {
  success: true;
  message: string;
  trackingCase: AdminStudyTrackingCaseSummary;
};

export async function getAdminStudyTrackingCases(
  params: {
    clinicId?: number;
    reportId?: number;
    particularTokenId?: number;
    limit?: number;
    offset?: number;
  } = {},
  options?: RequestInit,
): Promise<AdminStudyTrackingSnapshot> {
  const query = new URLSearchParams();

  if (typeof params.clinicId === "number") {
    query.set("clinicId", String(params.clinicId));
  }

  if (typeof params.reportId === "number") {
    query.set("reportId", String(params.reportId));
  }

  if (typeof params.particularTokenId === "number") {
    query.set("particularTokenId", String(params.particularTokenId));
  }

  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }

  if (typeof params.offset === "number") {
    query.set("offset", String(params.offset));
  }

  const qs = query.toString();

  return apiFetch<AdminStudyTrackingSnapshot>(
    `/api/admin/study-tracking${qs ? `?${qs}` : ""}`,
    options,
  );
}

export async function updateAdminStudyTrackingCase(
  trackingCaseId: number,
  payload: AdminStudyTrackingUpdatePayload,
  options?: RequestInit,
): Promise<AdminStudyTrackingUpdateResponse> {
  return apiFetch<AdminStudyTrackingUpdateResponse>(
    `/api/admin/study-tracking/${trackingCaseId}`,
    {
      ...options,
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export type AdminStudyTrackingNotificationSummary = {
  id: number;
  studyTrackingCaseId: number;
  clinicId: number;
  reportId: number | null;
  particularTokenId: number | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type AdminStudyTrackingNotificationsSnapshot = {
  success: true;
  count: number;
  notifications: AdminStudyTrackingNotificationSummary[];
  pagination: {
    limit: number;
    offset: number;
  };
};

export type AdminStudyTrackingNotificationReadResponse = {
  success: true;
  notification: AdminStudyTrackingNotificationSummary;
};

export type AdminStudyTrackingNotificationsReadAllResponse = {
  success: true;
  updatedCount: number;
};

export type DashboardNotificationSurface =
  | "admin"
  | "clinic"
  | "particular";

type DashboardNotificationsQuery = {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
};

function buildDashboardNotificationsPath(surface: DashboardNotificationSurface) {
  switch (surface) {
    case "admin":
      return "/api/admin/study-tracking/notifications";
    case "clinic":
      return "/api/study-tracking/notifications";
    case "particular":
      return "/api/particular/study-tracking/notifications";
    default:
      return "/api/admin/study-tracking/notifications";
  }
}

function buildDashboardNotificationsQuery(
  params: DashboardNotificationsQuery = {},
) {
  const query = new URLSearchParams();

  if (typeof params.unreadOnly === "boolean") {
    query.set("unreadOnly", String(params.unreadOnly));
  }

  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }

  if (typeof params.offset === "number") {
    query.set("offset", String(params.offset));
  }

  return query.toString();
}

export async function getDashboardNotifications(
  surface: DashboardNotificationSurface,
  params: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {},
  options?: RequestInit,
): Promise<AdminStudyTrackingNotificationsSnapshot> {
  const qs = buildDashboardNotificationsQuery(params);
  const basePath = buildDashboardNotificationsPath(surface);

  return apiFetch<AdminStudyTrackingNotificationsSnapshot>(
    `${basePath}${qs ? `?${qs}` : ""}`,
    options,
  );
}

export async function markDashboardNotificationRead(
  surface: DashboardNotificationSurface,
  notificationId: number,
  options?: RequestInit,
): Promise<AdminStudyTrackingNotificationReadResponse> {
  const basePath = buildDashboardNotificationsPath(surface);

  return apiFetch<AdminStudyTrackingNotificationReadResponse>(
    `${basePath}/${notificationId}/read`,
    {
      ...options,
      method: "PATCH",
    },
  );
}

export async function markAllDashboardNotificationsRead(
  surface: DashboardNotificationSurface,
  options?: RequestInit,
): Promise<AdminStudyTrackingNotificationsReadAllResponse> {
  const basePath = buildDashboardNotificationsPath(surface);

  return apiFetch<AdminStudyTrackingNotificationsReadAllResponse>(
    `${basePath}/read-all`,
    {
      ...options,
      method: "PATCH",
    },
  );
}

export async function getAdminStudyTrackingNotifications(
  params: DashboardNotificationsQuery = {},
  options?: RequestInit,
): Promise<AdminStudyTrackingNotificationsSnapshot> {
  return getDashboardNotifications("admin", params, options);
}

export async function markAdminStudyTrackingNotificationRead(
  notificationId: number,
  options?: RequestInit,
): Promise<AdminStudyTrackingNotificationReadResponse> {
  return markDashboardNotificationRead("admin", notificationId, options);
}

export async function markAllAdminStudyTrackingNotificationsRead(
  options?: RequestInit,
): Promise<AdminStudyTrackingNotificationsReadAllResponse> {
  return markAllDashboardNotificationsRead("admin", options);
}

export async function getClinicStudyTrackingNotifications(
  params: DashboardNotificationsQuery = {},
  options?: RequestInit,
): Promise<AdminStudyTrackingNotificationsSnapshot> {
  return getDashboardNotifications("clinic", params, options);
}

export async function markClinicStudyTrackingNotificationRead(
  notificationId: number,
  options?: RequestInit,
): Promise<AdminStudyTrackingNotificationReadResponse> {
  return markDashboardNotificationRead("clinic", notificationId, options);
}

export async function markAllClinicStudyTrackingNotificationsRead(
  options?: RequestInit,
): Promise<AdminStudyTrackingNotificationsReadAllResponse> {
  return markAllDashboardNotificationsRead("clinic", options);
}

export async function getParticularStudyTrackingNotifications(
  params: DashboardNotificationsQuery = {},
  options?: RequestInit,
): Promise<AdminStudyTrackingNotificationsSnapshot> {
  return getDashboardNotifications("particular", params, options);
}

export async function markParticularStudyTrackingNotificationRead(
  notificationId: number,
  options?: RequestInit,
): Promise<AdminStudyTrackingNotificationReadResponse> {
  return markDashboardNotificationRead("particular", notificationId, options);
}

export async function markAllParticularStudyTrackingNotificationsRead(
  options?: RequestInit,
): Promise<AdminStudyTrackingNotificationsReadAllResponse> {
  return markAllDashboardNotificationsRead("particular", options);
}

export type ClinicStudyTrackingCaseSummary = AdminStudyTrackingCaseSummary;

export type ClinicStudyTrackingSnapshot = {
  success: true;
  count: number;
  trackingCases: ClinicStudyTrackingCaseSummary[];
  pagination: {
    limit: number;
    offset: number;
  };
};

export async function getClinicStudyTrackingCases(
  params: {
    reportId?: number;
    particularTokenId?: number;
    limit?: number;
    offset?: number;
  } = {},
  options?: RequestInit,
): Promise<ClinicStudyTrackingSnapshot> {
  const query = new URLSearchParams();

  if (typeof params.reportId === "number") {
    query.set("reportId", String(params.reportId));
  }

  if (typeof params.particularTokenId === "number") {
    query.set("particularTokenId", String(params.particularTokenId));
  }

  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }

  if (typeof params.offset === "number") {
    query.set("offset", String(params.offset));
  }

  const qs = query.toString();

  return apiFetch<ClinicStudyTrackingSnapshot>(
    `/api/study-tracking${qs ? `?${qs}` : ""}`,
    options,
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
    warnApiFallback("getLogisticsFieldVisits", error);
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
    warnApiFallback("getRoutePlans", error);
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
      warnApiFallback("getRoutePlanMetrics", error);
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
    const res = await apiFetch<{ entries?: AuditEntry[]; items?: AuditEntry[] }>(
      "/api/admin/audit-log",
      options,
    );
    return res.items ?? res.entries ?? [];
  } catch (error) {
    warnApiFallback("getAuditEntries", error);
    if (readOptions.throwOnError) {
      throw error;
    }

    return [];
  }
}

export type AdminPricingCategoryItem = {
  id: number;
  studyName: string;
  priceLabel: string | null;
  displayOrder: number;
  isActive: boolean;
  updatedAt: string;
};

export type AdminPricingCategory = {
  category: string;
  items: AdminPricingCategoryItem[];
};

export type AdminPricingSnapshot = {
  success: true;
  categories: AdminPricingCategory[];
};

export type AdminPricingItem = {
  id: number;
  category: string;
  studyName: string;
  priceLabel: string | null;
  displayOrder: number;
  isActive: boolean;
  updatedAt: string;
};

export type AdminPricingUpdatePayload = {
  priceLabel?: string | null;
  isActive?: boolean;
  displayOrder?: number;
};

export type AdminPricingUpdateResponse = {
  success: true;
  pricingItem: AdminPricingItem;
};

function normalizeAdminPricingPriceLabel(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildAdminPricingUpdatePayload(
  payload: AdminPricingUpdatePayload,
): AdminPricingUpdatePayload {
  const normalizedPayload: AdminPricingUpdatePayload = {};

  if (Object.prototype.hasOwnProperty.call(payload, "priceLabel")) {
    normalizedPayload.priceLabel = normalizeAdminPricingPriceLabel(
      payload.priceLabel,
    );
  }

  if (Object.prototype.hasOwnProperty.call(payload, "isActive")) {
    normalizedPayload.isActive = payload.isActive;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "displayOrder")) {
    normalizedPayload.displayOrder = payload.displayOrder;
  }

  return normalizedPayload;
}

export async function getAdminPricing(
  options?: RequestInit,
): Promise<AdminPricingSnapshot> {
  return apiFetch<AdminPricingSnapshot>("/api/admin/pricing", options);
}

export async function updateAdminPricingItem(
  id: number,
  payload: AdminPricingUpdatePayload,
  options?: RequestInit,
): Promise<AdminPricingUpdateResponse> {
  const normalizedPayload = buildAdminPricingUpdatePayload(payload);

  return apiFetch<AdminPricingUpdateResponse>(`/api/admin/pricing/${id}`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify(normalizedPayload),
  });
}

export type AdminReportWorkflowStage =
  | "sample_received"
  | "processing"
  | "evaluation"
  | "report_development"
  | "delivered";

export type AdminReportWorkflowItem = {
  id: number;
  clinicId: number;
  clinicName: string | null;
  patientName: string | null;
  fileName: string | null;
  studyType: string | null;
  uploadDate: string | null;
  createdAt: string;
  workflowStage: AdminReportWorkflowStage;
  specialStainRequested: boolean;
  specialStainAt: string | null;
  workflowUpdatedAt: string | null;
};

export type AdminReportWorkflowSnapshot = {
  success: true;
  reports: AdminReportWorkflowItem[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

export type AdminReportWorkflowUpdateResponse = {
  success: true;
  report: AdminReportWorkflowItem;
};

export async function getAdminReportWorkflow(
  params: { limit?: number; offset?: number } = {},
  options?: RequestInit,
): Promise<AdminReportWorkflowSnapshot> {
  const query = new URLSearchParams();

  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }

  if (typeof params.offset === "number") {
    query.set("offset", String(params.offset));
  }

  const qs = query.toString();

  return apiFetch<AdminReportWorkflowSnapshot>(
    `/api/admin/report-workflow${qs ? `?${qs}` : ""}`,
    options,
  );
}

export async function updateAdminReportWorkflowStage(
  reportId: number,
  stage: AdminReportWorkflowStage,
  options?: RequestInit,
): Promise<AdminReportWorkflowUpdateResponse> {
  return apiFetch<AdminReportWorkflowUpdateResponse>(
    `/api/admin/report-workflow/${reportId}/stage`,
    {
      ...options,
      method: "PATCH",
      body: JSON.stringify({ stage }),
    },
  );
}

export async function updateAdminReportSpecialStain(
  reportId: number,
  requested: boolean,
  options?: RequestInit,
): Promise<AdminReportWorkflowUpdateResponse> {
  return apiFetch<AdminReportWorkflowUpdateResponse>(
    `/api/admin/report-workflow/${reportId}/special-stain`,
    {
      ...options,
      method: "PATCH",
      body: JSON.stringify({ requested }),
    },
  );
}


export async function getAdminSystemHealth(
  options?: RequestInit,
): Promise<SystemHealth | null> {
  try {
    return await apiFetch<SystemHealth>(
      "/api/admin/system/health",
      options,
    );
  } catch (error) {
    warnApiFallback("getAdminSystemHealth", error);
    return null;
  }
}

function readBackendMessageFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const bodyRecord = body as Record<string, unknown>;
  const errorValue = bodyRecord.error;
  const messageValue = bodyRecord.message;

  if (typeof errorValue === "string" && errorValue.trim()) {
    return errorValue;
  }

  if (typeof messageValue === "string" && messageValue.trim()) {
    return messageValue;
  }

  return null;
}

export async function getAdminSchemaHealth(
  options?: RequestInit,
): Promise<AdminSchemaHealthSnapshot> {
  const apiBaseUrl = resolveApiBaseUrlForRuntime();
  const headers = new Headers(options?.headers);

  let res: Response;

  try {
    res = await fetch(`${apiBaseUrl}/api/admin/system/schema-health`, {
      ...options,
      credentials: options?.credentials ?? "include",
      headers,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      const errorDetail =
        error instanceof Error ? error.message : String(error);
      console.warn(`[API] /api/admin/system/schema-health: ${errorDetail}`);
    }

    if (error instanceof TypeError) {
      throw new Error(BACKEND_CONNECTION_ERROR_MESSAGE);
    }

    throw error;
  }

  const body = (await res.json().catch(() => null)) as unknown;
  const backendMessage = readBackendMessageFromBody(body);

  if (res.status === 401) {
    throw new Error(ADMIN_SCHEMA_HEALTH_UNAUTHORIZED_MESSAGE);
  }

  const parsedSnapshot =
    body && typeof body === "object"
      ? (body as Partial<AdminSchemaHealthSnapshot>)
      : null;
  const parsedStatus = parsedSnapshot?.status;
  const hasValidSchemaHealthStatus =
    parsedStatus === "ok" || parsedStatus === "degraded";

  if (
    (res.status === 200 || res.status === 503) &&
    hasValidSchemaHealthStatus
  ) {
    return parsedSnapshot as AdminSchemaHealthSnapshot;
  }

  if (backendMessage) {
    throw new Error(backendMessage);
  }

  if (res.status >= 500) {
    throw new Error(BACKEND_OPERATION_ERROR_MESSAGE);
  }

  throw new Error(`HTTP ${res.status}`);
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

export async function getAdminClinics(
  params: {
    limit?: number;
    offset?: number;
  } = {},
  options?: RequestInit,
): Promise<AdminClinicsSnapshot> {
  const query = new URLSearchParams();

  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }

  if (typeof params.offset === "number") {
    query.set("offset", String(params.offset));
  }

  const qs = query.toString();

  return apiFetch<AdminClinicsSnapshot>(
    `/api/admin/clinics${qs ? `?${qs}` : ""}`,
    options,
  );
}

export async function createAdminClinicWithUser(
  payload: AdminClinicCreatePayload,
  options?: RequestInit,
): Promise<AdminClinicCreateResponse> {
  return apiFetch<AdminClinicCreateResponse>("/api/admin/clinics", {
    ...options,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminClinic(
  clinicId: number,
  payload: AdminClinicUpdatePayload,
  options?: RequestInit,
): Promise<AdminClinicUpdateResponse> {
  return apiFetch<AdminClinicUpdateResponse>(
    `/api/admin/clinics/${clinicId}`,
    {
      ...options,
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export type AdminClinicDeletePayload = {
  confirmClinicName: string;
};

export type AdminClinicDeleteResponse = {
  success: true;
  message: string;
  clinic: {
    clinicId: number;
    clinicName: string;
    contactEmail: string | null;
    contactPhone: string | null;
    createdAt: string;
    updatedAt: string;
  };
  deletedBy: {
    adminUserId: number;
    username: string;
  };
};

export async function deleteAdminClinic(
  clinicId: number,
  payload: AdminClinicDeletePayload,
  options?: RequestInit,
): Promise<AdminClinicDeleteResponse> {
  return apiFetch<AdminClinicDeleteResponse>(
    `/api/admin/clinics/${clinicId}`,
    {
      ...options,
      method: "DELETE",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateAdminClinicUserCredentials(
  clinicUserId: number,
  payload: AdminClinicUserCredentialsUpdatePayload,
  options?: RequestInit,
): Promise<AdminClinicUserCredentialsUpdateResponse> {
  return apiFetch<AdminClinicUserCredentialsUpdateResponse>(
    `/api/admin/users-roles/clinic/${clinicUserId}/credentials`,
    {
      ...options,
      method: "PATCH",
      body: JSON.stringify(payload),
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
  const apiBaseUrl = resolveApiBaseUrlForRuntime();
  const qs = buildAdminFailedLoginAlertsQueryString(params);

  return `${apiBaseUrl}/api/admin/failed-login-alerts/export.csv${qs ? `?${qs}` : ""}`;
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
  publicAddress: string | null;
  mapLink: string | null;
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
  publicAddress?: string | null;
  mapLink?: string | null;
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

export async function uploadClinicPublicProfileAvatar(
  file: File,
  options?: RequestInit,
): Promise<ClinicPublicProfileUpdateResponse> {
  const formData = new FormData();
  formData.append("avatar", file);

  return apiFetch<ClinicPublicProfileUpdateResponse>(
    "/api/clinic/profile/avatar",
    {
      ...options,
      method: "POST",
      body: formData,
    },
  );
}

export async function deleteClinicPublicProfileAvatar(
  options?: RequestInit,
): Promise<ClinicPublicProfileUpdateResponse> {
  return apiFetch<ClinicPublicProfileUpdateResponse>(
    "/api/clinic/profile/avatar",
    {
      ...options,
      method: "DELETE",
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

export type PublicPricingItem = {
  id: number;
  studyName: string;
  priceLabel: string | null;
  displayOrder: number;
};

export type PublicPricingCategory = {
  category: string;
  items: PublicPricingItem[];
};

export type PublicPricingSnapshot = {
  success: true;
  categories: PublicPricingCategory[];
};

type PublicPricingReadOptions = {
  throwOnError?: boolean;
};

export async function getPublicPricing(
  options?: RequestInit,
  readOptions: PublicPricingReadOptions = {},
): Promise<PublicPricingSnapshot> {
  try {
    return await apiFetch<PublicPricingSnapshot>(
      "/api/public/pricing",
      options,
    );
  } catch (error) {
    if (readOptions.throwOnError ?? true) {
      throw error;
    }

    return {
      success: true,
      categories: [],
    };
  }
}

export type PublicProfessional = {
  clinicId: number;
  displayName: string;
  avatarUrl: string | null;
  specialtyText: string | null;
  servicesText: string | null;
  email: string | null;
  phone: string | null;
  publicAddress?: string | null;
  mapLink?: string | null;
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
