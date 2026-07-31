import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { ENV } from "./lib/env.ts";
import {
  normalizeRouteTemplate,
  sanitizeUrlForLogs,
} from "./middlewares/request-logger.ts";
import {
  adminAuditNativeRoutes,
  type AdminAuditNativeRoutesOptions,
} from "./routes/admin-audit.fastify.ts";
import {
  adminAuthNativeRoutes,
  type AdminAuthNativeRoutesOptions,
} from "./routes/admin-auth.fastify.ts";
import {
  adminClinicsNativeRoutes,
  type AdminClinicsNativeRoutesOptions,
} from "./routes/admin-clinics.fastify.ts";
import {
  adminFailedLoginAlertsNativeRoutes,
  type AdminFailedLoginAlertsNativeRoutesOptions,
} from "./routes/admin-failed-login-alerts.fastify.ts";
import {
  adminPricingNativeRoutes,
  type AdminPricingNativeRoutesOptions,
} from "./routes/admin-pricing.fastify.ts";
import {
  adminParticularTokensNativeRoutes,
  type AdminParticularTokensNativeRoutesOptions,
} from "./routes/admin-particular-tokens.fastify.ts";
import {
  adminReportAccessTokensNativeRoutes,
  type AdminReportAccessTokensNativeRoutesOptions,
} from "./routes/admin-report-access-tokens.fastify.ts";
import {
  adminReportsNativeRoutes,
  type AdminReportsNativeRoutesOptions,
} from "./routes/admin-reports.fastify.ts";
import {
  adminReportWorkflowNativeRoutes,
  type AdminReportWorkflowNativeRoutesOptions,
} from "./routes/admin-report-workflow.fastify.ts";
import {
  adminSessionsNativeRoutes,
  type AdminSessionsNativeRoutesOptions,
} from "./routes/admin-sessions.fastify.ts";
import {
  adminStudyTrackingNativeRoutes,
  type AdminStudyTrackingNativeRoutesOptions,
} from "./routes/admin-study-tracking.fastify.ts";
import {
  adminSystemHealthNativeRoutes,
  type AdminSystemHealthNativeRoutesOptions,
} from "./routes/admin-system-health.fastify.ts";
import {
  adminUsersRolesNativeRoutes,
  type AdminUsersRolesNativeRoutesOptions,
} from "./routes/admin-users-roles.fastify.ts";
import {
  adminSystemMaintenanceNativeRoutes,
  type AdminSystemMaintenanceNativeRoutesOptions,
} from "./routes/admin-system-maintenance.fastify.ts";
import {
  adminSystemSchemaHealthNativeRoutes,
  type AdminSystemSchemaHealthNativeRoutesOptions,
} from "./routes/admin-system-schema-health.fastify.ts";
import {
  appVersionNativeRoutes,
  type AppVersionNativeRoutesOptions,
} from "./routes/app-version.fastify.ts";
import {
  clinicAuthNativeRoutes,
  type AuthNativeRoutesOptions,
} from "./routes/auth.fastify.ts";
import {
  contactNativeRoutes,
  type ContactNativeRoutesOptions,
} from "./routes/contact.fastify.ts";
import {
  clinicAuditNativeRoutes,
  type ClinicAuditNativeRoutesOptions,
} from "./routes/clinic-audit.fastify.ts";
import {
  clinicPublicProfileNativeRoutes,
  type ClinicPublicProfileNativeRoutesOptions,
} from "./routes/clinic-public-profile.fastify.ts";
import {
  particularAuditNativeRoutes,
  type ParticularAuditNativeRoutesOptions,
} from "./routes/particular-audit.fastify.ts";
import {
  particularAuthNativeRoutes,
  type ParticularAuthNativeRoutesOptions,
} from "./routes/particular-auth.fastify.ts";
import {
  particularStudyTrackingNativeRoutes,
  type ParticularStudyTrackingNativeRoutesOptions,
} from "./routes/particular-study-tracking.fastify.ts";
import {
  particularTokensNativeRoutes,
  type ParticularTokensNativeRoutesOptions,
} from "./routes/particular-tokens.fastify.ts";
import {
  publicProfessionalsNativeRoutes,
  type PublicProfessionalsNativeRoutesOptions,
} from "./routes/public-professionals.fastify.ts";
import {
  publicPricingNativeRoutes,
  type PublicPricingNativeRoutesOptions,
} from "./routes/public-pricing.fastify.ts";
import {
  publicReportAccessNativeRoutes,
  type PublicReportAccessNativeRoutesOptions,
} from "./routes/public-report-access.fastify.ts";
import {
  reportAccessTokensNativeRoutes,
  type ReportAccessTokensNativeRoutesOptions,
} from "./routes/report-access-tokens.fastify.ts";
import {
  reportsNativeRoutes,
  type ReportsNativeRoutesOptions,
} from "./routes/reports.fastify.ts";
import {
  reportsStatusNativeRoutes,
  type ReportsStatusNativeRoutesOptions,
} from "./routes/reports-status.fastify.ts";
import {
  studyTrackingNativeRoutes,
  type StudyTrackingNativeRoutesOptions,
} from "./routes/study-tracking.fastify.ts";
import {
  logisticsFieldVisitsNativeRoutes,
  type LogisticsFieldVisitsNativeRoutesOptions,
} from "./routes/logistics-field-visits.fastify.ts";
import {
  logisticsRoutePlansNativeRoutes,
  type LogisticsRoutePlansNativeRoutesOptions,
} from "./routes/logistics-route-plans.fastify.ts";
import {
  logisticsRouteEventsNativeRoutes,
  type LogisticsRouteEventsNativeRoutesOptions,
} from "./routes/logistics-route-events.fastify.ts";
import {
  logisticsSlaNativeRoutes,
  type LogisticsSlaNativeRoutesOptions,
} from "./routes/logistics-sla.fastify.ts";
import { requireTrustedOriginForFastify } from "./middlewares/trusted-origin.ts";
import { requireMinimumClientVersionForFastify } from "./middlewares/version-gate.ts";
import { applySensitiveApiNoStoreHeaders } from "./lib/http/sensitive-response-cache.ts";
import { applyApiSecurityHeaders } from "./lib/http/api-response-security.ts";
import {
  applyApiRequestIdHeader,
  generateFastifyRequestId,
  getSafeApiResponseRequestId,
} from "./lib/http/api-request-id.ts";
import { logError, serializeError } from "./lib/logger.ts";
import {
  createObservabilityRequestFinalizer,
  getObservabilityMetricsRegistry,
  type ObservabilityMetricsRegistry,
  type ObservabilityRequestFinalizer,
} from "./lib/observability-metrics.ts";
import { createRuntimeTimer, type RuntimeTimer } from "./lib/runtime-timing.ts";

type HealthCheckResponse = {
  statusCode: number;
  payload: Record<string, unknown>;
};

type HealthCheckFactory = () => Promise<HealthCheckResponse>;
type ServiceInfoFactory = () => Record<string, unknown>;

function getFastifyErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unexpected error";
}

const SAFE_ERROR_CODE_PATTERN = /^[A-Za-z0-9_]{1,64}$/;

/**
 * Sólo se exporta un `code` con forma de identificador corto (p. ej. SQLSTATE o
 * un código de librería). Cualquier otra cosa se descarta para no filtrar
 * mensajes ni detalle de driver DB. Esta regex sintáctica es deliberadamente
 * distinta de la allowlist finita de nombres de Error de serializeError: un
 * `code` corto no es un nombre de clase y no exige lista cerrada.
 */
function getFastifyErrorSafeCode(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;

  return typeof code === "string" && SAFE_ERROR_CODE_PATTERN.test(code)
    ? code
    : undefined;
}

function getFastifyErrorStatus(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: number }).status === "number"
  ) {
    return normalizeFastifyErrorStatus((error as { status: number }).status);
  }

  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof (error as { statusCode?: number }).statusCode === "number"
  ) {
    return normalizeFastifyErrorStatus(
      (error as { statusCode: number }).statusCode,
    );
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: string }).code === "string"
  ) {
    const code = (error as { code: string }).code;

    if (["23505", "23503", "22P02", "42703"].includes(code)) {
      return 400;
    }
  }

  return 500;
}

function normalizeFastifyErrorStatus(status: number) {
  return Number.isInteger(status) && status >= 400 && status <= 599
    ? status
    : 500;
}

function getHeaderValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const stringValue = value.find((item) => typeof item === "string");

    return stringValue ?? null;
  }

  return null;
}

function isJsonResponse(reply: FastifyReply) {
  const contentType =
    getHeaderValue(reply.getHeader("content-type")) ??
    getHeaderValue(reply.raw.getHeader("content-type"));

  return contentType?.toLowerCase().includes("application/json") ?? false;
}

function getPayloadText(payload: unknown): string | null {
  if (typeof payload === "string") {
    return payload;
  }

  if (Buffer.isBuffer(payload)) {
    return payload.toString("utf8");
  }

  return null;
}

function getFastifyErrorResponsePath(request: FastifyRequest) {
  const url = sanitizeUrlForLogs(request.url ?? "");

  try {
    return new URL(url, "http://portal-vetneb.local").pathname;
  } catch {
    return url.split("?")[0] ?? "";
  }
}

function addApiErrorRequestIdToJsonPayload(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
) {
  if (reply.statusCode < 400 || !isJsonResponse(reply)) {
    return payload;
  }

  const requestId = getSafeApiResponseRequestId(request, reply);
  const payloadText = getPayloadText(payload);

  if (!requestId || !payloadText) {
    return payload;
  }

  let body: unknown;

  try {
    body = JSON.parse(payloadText);
  } catch {
    return payload;
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return payload;
  }

  return JSON.stringify({
    ...body,
    requestId,
  });
}

const REQUEST_OBSERVABILITY_KEY = "__observabilityRequestState";

type ObservabilityRequestState = {
  timer: RuntimeTimer;
  finalizer: ObservabilityRequestFinalizer;
};

type ObservabilityFastifyRequest = FastifyRequest & {
  [REQUEST_OBSERVABILITY_KEY]?: ObservabilityRequestState;
};

function getObservabilityRequestState(request: FastifyRequest) {
  return (request as ObservabilityFastifyRequest)[REQUEST_OBSERVABILITY_KEY];
}

function getFastifyRouteTemplate(request: FastifyRequest): string {
  return normalizeRouteTemplate(request.routeOptions?.url);
}

/**
 * La instrumentacion nunca debe alterar la respuesta: cualquier fallo interno
 * de metricas o logging se descarta en lugar de propagarse al request.
 */
function runFailSafe(operation: () => void) {
  try {
    operation();
  } catch {
    // fail-safe: la observabilidad no puede tumbar una respuesta HTTP
  }
}

export type CreateFastifyAppOptions = {
  observabilityMetricsRegistry?: ObservabilityMetricsRegistry;
  getNativeHealthCheckResponse?: HealthCheckFactory;
  getServiceInfoPayload?: ServiceInfoFactory;
  appVersionRoutes?: AppVersionNativeRoutesOptions;
  adminAuditRoutes?: AdminAuditNativeRoutesOptions;
  adminAuthRoutes?: AdminAuthNativeRoutesOptions;
  adminClinicsRoutes?: AdminClinicsNativeRoutesOptions;
  adminFailedLoginAlertsRoutes?: AdminFailedLoginAlertsNativeRoutesOptions;
  adminPricingRoutes?: AdminPricingNativeRoutesOptions;
  adminParticularTokensRoutes?: AdminParticularTokensNativeRoutesOptions;
  adminReportsRoutes?: AdminReportsNativeRoutesOptions;
  adminReportWorkflowRoutes?: AdminReportWorkflowNativeRoutesOptions;
  adminSessionsRoutes?: AdminSessionsNativeRoutesOptions;
  adminReportAccessTokensRoutes?: AdminReportAccessTokensNativeRoutesOptions;
  adminStudyTrackingRoutes?: AdminStudyTrackingNativeRoutesOptions;
  adminSystemHealthRoutes?: AdminSystemHealthNativeRoutesOptions;
  adminSystemMaintenanceRoutes?: AdminSystemMaintenanceNativeRoutesOptions;
  adminSystemSchemaHealthRoutes?: AdminSystemSchemaHealthNativeRoutesOptions;
  adminUsersRolesRoutes?: AdminUsersRolesNativeRoutesOptions;
  clinicAuthRoutes?: AuthNativeRoutesOptions;
  contactRoutes?: ContactNativeRoutesOptions;
  clinicAuditRoutes?: ClinicAuditNativeRoutesOptions;
  clinicPublicProfileRoutes?: ClinicPublicProfileNativeRoutesOptions;
  particularAuditRoutes?: ParticularAuditNativeRoutesOptions;
  particularAuthRoutes?: ParticularAuthNativeRoutesOptions;
  particularStudyTrackingRoutes?: ParticularStudyTrackingNativeRoutesOptions;
  particularTokensRoutes?: ParticularTokensNativeRoutesOptions;
  publicPricingRoutes?: PublicPricingNativeRoutesOptions;
  publicProfessionalsRoutes?: PublicProfessionalsNativeRoutesOptions;
  publicReportAccessRoutes?: PublicReportAccessNativeRoutesOptions;
  reportAccessTokensRoutes?: ReportAccessTokensNativeRoutesOptions;
  reportsRoutes?: ReportsNativeRoutesOptions;
  reportsStatusRoutes?: ReportsStatusNativeRoutesOptions;
  studyTrackingRoutes?: StudyTrackingNativeRoutesOptions;
  logisticsFieldVisitsRoutes?: LogisticsFieldVisitsNativeRoutesOptions;
  logisticsRoutePlansRoutes?: LogisticsRoutePlansNativeRoutesOptions;
  logisticsRouteEventsRoutes?: LogisticsRouteEventsNativeRoutesOptions;
  logisticsSlaRoutes?: LogisticsSlaNativeRoutesOptions;
};

export async function createFastifyApp(
  options: CreateFastifyAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    genReqId: generateFastifyRequestId,
    logger: false,
    trustProxy: ENV.trustProxy,
  });

  const metricsRegistry =
    options.observabilityMetricsRegistry ?? getObservabilityMetricsRegistry();

  app.addHook("onRequest", async (request, reply) => {
    runFailSafe(() => {
      const timer = createRuntimeTimer();

      metricsRegistry.recordRequestStarted();

      // El estado sólo se publica una vez que el inicio quedó contabilizado,
      // para que ninguna finalización pueda decrementar un in-flight que nunca
      // se incrementó.
      (request as ObservabilityFastifyRequest)[REQUEST_OBSERVABILITY_KEY] = {
        timer,
        finalizer: createObservabilityRequestFinalizer(metricsRegistry),
      };
    });

    applyApiRequestIdHeader(request, reply);
    applyApiSecurityHeaders(request, reply);
  });

  app.addHook("onRequest", requireTrustedOriginForFastify);
  app.addHook("onRequest", requireMinimumClientVersionForFastify);

  app.addHook(
    "onSend",
    async (request: FastifyRequest, reply: FastifyReply, payload) => {
      applySensitiveApiNoStoreHeaders(request, reply);

      return addApiErrorRequestIdToJsonPayload(request, reply, payload);
    },
  );

  app.addHook("onResponse", async (request, reply) => {
    runFailSafe(() => {
      const state = getObservabilityRequestState(request);

      if (!state) {
        return;
      }

      state.finalizer.recordCompleted({
        method: request.method,
        routeTemplate: getFastifyRouteTemplate(request),
        statusCode: reply.statusCode,
        durationMs: state.timer.elapsedMs(),
      });
    });
  });

  // El cliente cortó la conexión antes de la respuesta: se libera el in-flight
  // sin inventar un status code, porque no existe taxonomía aprobada para un
  // request abortado.
  app.addHook("onRequestAbort", async (request) => {
    runFailSafe(() => {
      getObservabilityRequestState(request)?.finalizer.recordAborted();
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      success: false,
      error: "Ruta no encontrada",
      path: getFastifyErrorResponsePath(request),
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const status = getFastifyErrorStatus(error);
    const message = getFastifyErrorMessage(error);
    const requestId = getSafeApiResponseRequestId(request, reply);
    const safeCode = getFastifyErrorSafeCode(error);

    // Metadata allowlisted: nunca URL, query, path con IDs, error crudo ni stack.
    logError("API_ERROR", {
      method: request.method,
      routeTemplate: getFastifyRouteTemplate(request),
      status,
      errorName: serializeError(error).name,
      ...(safeCode ? { safeCode } : {}),
      ...(requestId ? { requestId } : {}),
    });

    return reply.code(status).send({
      success: false,
      error: status >= 500 ? "Error interno del servidor" : message,
      details: status >= 500 ? undefined : message,
      path: getFastifyErrorResponsePath(request),
    });
  });

  const getNativeHealthCheckResponse =
    options.getNativeHealthCheckResponse ??
    (async () =>
      (await import("./lib/http-runtime.ts")).getHealthCheckResponse());

  const getServiceInfoPayload =
    options.getServiceInfoPayload ??
    (() => ({
      success: true,
      service: "portal-vetneb-api",
      environment: ENV.nodeEnv,
    }));

  app.get("/", async (_request: FastifyRequest, reply: FastifyReply) => {
    const payload = JSON.stringify(getServiceInfoPayload());

    reply.code(200);
    reply.header("content-type", "application/json; charset=utf-8");
    reply.raw.end(payload);
  });

  const nativeHealthHandler = async (
    _request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const health = await getNativeHealthCheckResponse();
    const payload = JSON.stringify(health.payload);

    reply.code(health.statusCode);
    reply.header("content-type", "application/json; charset=utf-8");
    reply.raw.end(payload);
  };

  app.get("/health", nativeHealthHandler);
  app.get("/api/health", nativeHealthHandler);

  await app.register(appVersionNativeRoutes, {
    prefix: "/api/app-version",
    ...(options.appVersionRoutes ?? {}),
  });

  await app.register(adminAuditNativeRoutes, {
    prefix: "/api/admin/audit-log",
    ...(options.adminAuditRoutes ?? {}),
  });

  await app.register(adminAuthNativeRoutes, {
    prefix: "/api/admin/auth",
    ...(options.adminAuthRoutes ?? {}),
  });

  await app.register(adminClinicsNativeRoutes, {
    prefix: "/api/admin/clinics",
    ...(options.adminClinicsRoutes ?? {}),
  });

  await app.register(adminFailedLoginAlertsNativeRoutes, {
    prefix: "/api/admin/failed-login-alerts",
    ...(options.adminFailedLoginAlertsRoutes ?? {}),
  });

  await app.register(adminPricingNativeRoutes, {
    prefix: "/api/admin/pricing",
    ...(options.adminPricingRoutes ?? {}),
  });

  await app.register(adminParticularTokensNativeRoutes, {
    prefix: "/api/admin/particular-tokens",
    ...(options.adminParticularTokensRoutes ?? {}),
  });

  await app.register(adminReportsNativeRoutes, {
    prefix: "/api/admin/reports",
    ...(options.adminReportsRoutes ?? {}),
  });

  await app.register(adminReportWorkflowNativeRoutes, {
    prefix: "/api/admin/report-workflow",
    ...(options.adminReportWorkflowRoutes ?? {}),
  });

  await app.register(adminReportAccessTokensNativeRoutes, {
    prefix: "/api/admin/report-access-tokens",
    ...(options.adminReportAccessTokensRoutes ?? {}),
  });

  await app.register(adminStudyTrackingNativeRoutes, {
    prefix: "/api/admin/study-tracking",
    ...(options.adminStudyTrackingRoutes ?? {}),
  });

  await app.register(adminSessionsNativeRoutes, {
    prefix: "/api/admin/sessions",
    ...(options.adminSessionsRoutes ?? {}),
  });

  await app.register(adminSystemHealthNativeRoutes, {
    prefix: "/api/admin/system/health",
    // La superficie privada de metricas debe leer la misma instancia que
    // instrumenta esta app; sin este getter el plugin caeria en el singleton de
    // proceso y podria reportar series distintas de las medidas aqui.
    getObservabilityMetricsSnapshot: () => metricsRegistry.getSnapshot(),
    ...(options.adminSystemHealthRoutes ?? {}),
  });

  await app.register(adminSystemMaintenanceNativeRoutes, {
    prefix: "/api/admin/system/maintenance",
    ...(options.adminSystemMaintenanceRoutes ?? {}),
  });

  await app.register(adminSystemSchemaHealthNativeRoutes, {
    prefix: "/api/admin/system/schema-health",
    ...(options.adminSystemSchemaHealthRoutes ?? {}),
  });

  await app.register(adminUsersRolesNativeRoutes, {
    prefix: "/api/admin/users-roles",
    ...(options.adminUsersRolesRoutes ?? {}),
  });

  await app.register(clinicAuthNativeRoutes, {
    prefix: "/api/auth",
    ...(options.clinicAuthRoutes ?? {}),
  });

  await app.register(contactNativeRoutes, {
    prefix: "/api/contact",
    ...(options.contactRoutes ?? {}),
  });

  await app.register(clinicAuditNativeRoutes, {
    prefix: "/api/clinic/audit-log",
    ...(options.clinicAuditRoutes ?? {}),
  });

  await app.register(clinicPublicProfileNativeRoutes, {
    prefix: "/api/clinic/profile",
    ...(options.clinicPublicProfileRoutes ?? {}),
  });

  await app.register(particularAuditNativeRoutes, {
    prefix: "/api/particular/audit-log",
    ...(options.particularAuditRoutes ?? {}),
  });

  await app.register(particularAuthNativeRoutes, {
    prefix: "/api/particular/auth",
    ...(options.particularAuthRoutes ?? {}),
  });

  await app.register(particularStudyTrackingNativeRoutes, {
    prefix: "/api/particular/study-tracking",
    ...(options.particularStudyTrackingRoutes ?? {}),
  });

  await app.register(particularTokensNativeRoutes, {
    prefix: "/api/particular-tokens",
    ...(options.particularTokensRoutes ?? {}),
  });

  await app.register(publicProfessionalsNativeRoutes, {
    prefix: "/api/public/professionals",
    ...(options.publicProfessionalsRoutes ?? {}),
  });

  await app.register(publicPricingNativeRoutes, {
    prefix: "/api/public/pricing",
    ...(options.publicPricingRoutes ?? {}),
  });

  await app.register(publicReportAccessNativeRoutes, {
    prefix: "/api/public/report-access",
    ...(options.publicReportAccessRoutes ?? {}),
  });

  await app.register(reportAccessTokensNativeRoutes, {
    prefix: "/api/report-access-tokens",
    ...(options.reportAccessTokensRoutes ?? {}),
  });

  await app.register(reportsNativeRoutes, {
    prefix: "/api/reports",
    ...(options.reportsRoutes ?? {}),
  });

  await app.register(reportsStatusNativeRoutes, {
    prefix: "/api/reports",
    ...(options.reportsStatusRoutes ?? {}),
  });

  await app.register(studyTrackingNativeRoutes, {
    prefix: "/api/study-tracking",
    ...(options.studyTrackingRoutes ?? {}),
  });

  await app.register(logisticsFieldVisitsNativeRoutes, {
    prefix: "/api/logistics/field-visits",
    ...(options.logisticsFieldVisitsRoutes ?? {}),
  });

  await app.register(logisticsRoutePlansNativeRoutes, {
    prefix: "/api/logistics/route-plans",
    ...(options.logisticsRoutePlansRoutes ?? {}),
  });

  await app.register(logisticsRouteEventsNativeRoutes, {
    prefix: "/api/logistics/route-events",
    ...(options.logisticsRouteEventsRoutes ?? {}),
  });

  await app.register(logisticsSlaNativeRoutes, {
    prefix: "/api/logistics/sla",
    ...(options.logisticsSlaRoutes ?? {}),
  });

  return app;
}
