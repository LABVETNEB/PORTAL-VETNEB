import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { ENV } from "./lib/env.ts";
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
import { applySensitiveApiNoStoreHeaders } from "./lib/sensitive-response-cache.ts";
import { applyApiSecurityHeaders } from "./lib/api-response-security.ts";
import {
  applyApiRequestIdHeader,
  generateFastifyRequestId,
  getSafeApiResponseRequestId,
} from "./lib/api-request-id.ts";

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

export type CreateFastifyAppOptions = {
  getNativeHealthCheckResponse?: HealthCheckFactory;
  getServiceInfoPayload?: ServiceInfoFactory;
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

  app.addHook("onRequest", async (request, reply) => {
    applyApiRequestIdHeader(request, reply);
    applyApiSecurityHeaders(request, reply);
  });

  app.addHook("onRequest", requireTrustedOriginForFastify);

  app.addHook(
    "onSend",
    async (request: FastifyRequest, reply: FastifyReply, payload) => {
      applySensitiveApiNoStoreHeaders(request, reply);

      return addApiErrorRequestIdToJsonPayload(request, reply, payload);
    },
  );

  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      success: false,
      error: "Ruta no encontrada",
      path: request.url,
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const status = getFastifyErrorStatus(error);
    const message = getFastifyErrorMessage(error);

    console.error("[API ERROR]", {
      method: request.method,
      path: request.url,
      status,
      message,
      error,
    });

    return reply.code(status).send({
      success: false,
      error: status >= 500 ? "Error interno del servidor" : message,
      details: status >= 500 ? undefined : message,
      path: request.url,
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
