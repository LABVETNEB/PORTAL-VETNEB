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
  adminStudyTrackingNativeRoutes,
  type AdminStudyTrackingNativeRoutesOptions,
} from "./routes/admin-study-tracking.fastify.ts";
import {
  clinicAuthNativeRoutes,
  type AuthNativeRoutesOptions,
} from "./routes/auth.fastify.ts";
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

export type CreateFastifyAppOptions = {
  getNativeHealthCheckResponse?: HealthCheckFactory;
  getServiceInfoPayload?: ServiceInfoFactory;
  adminAuditRoutes?: AdminAuditNativeRoutesOptions;
  adminAuthRoutes?: AdminAuthNativeRoutesOptions;
  adminParticularTokensRoutes?: AdminParticularTokensNativeRoutesOptions;
  adminReportsRoutes?: AdminReportsNativeRoutesOptions;
  adminReportAccessTokensRoutes?: AdminReportAccessTokensNativeRoutesOptions;
  adminStudyTrackingRoutes?: AdminStudyTrackingNativeRoutesOptions;
  clinicAuthRoutes?: AuthNativeRoutesOptions;
  clinicAuditRoutes?: ClinicAuditNativeRoutesOptions;
  clinicPublicProfileRoutes?: ClinicPublicProfileNativeRoutesOptions;
  particularAuditRoutes?: ParticularAuditNativeRoutesOptions;
  particularAuthRoutes?: ParticularAuthNativeRoutesOptions;
  particularStudyTrackingRoutes?: ParticularStudyTrackingNativeRoutesOptions;
  particularTokensRoutes?: ParticularTokensNativeRoutesOptions;
  publicProfessionalsRoutes?: PublicProfessionalsNativeRoutesOptions;
  publicReportAccessRoutes?: PublicReportAccessNativeRoutesOptions;
  reportAccessTokensRoutes?: ReportAccessTokensNativeRoutesOptions;
  reportsRoutes?: ReportsNativeRoutesOptions;
  reportsStatusRoutes?: ReportsStatusNativeRoutesOptions;
  studyTrackingRoutes?: StudyTrackingNativeRoutesOptions;
};

export async function createFastifyApp(
  options: CreateFastifyAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: ENV.trustProxy,
  });

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

  await app.register(adminParticularTokensNativeRoutes, {
    prefix: "/api/admin/particular-tokens",
    ...(options.adminParticularTokensRoutes ?? {}),
  });

  await app.register(adminParticularTokensNativeRoutes, {
    prefix: "/api/admin/particular/tokens",
    ...(options.adminParticularTokensRoutes ?? {}),
  });

  await app.register(adminReportsNativeRoutes, {
    prefix: "/api/admin/reports",
    ...(options.adminReportsRoutes ?? {}),
  });

  await app.register(adminReportAccessTokensNativeRoutes, {
    prefix: "/api/admin/report-access-tokens",
    ...(options.adminReportAccessTokensRoutes ?? {}),
  });

  await app.register(adminStudyTrackingNativeRoutes, {
    prefix: "/api/admin/study-tracking",
    ...(options.adminStudyTrackingRoutes ?? {}),
  });

  await app.register(clinicAuthNativeRoutes, {
    prefix: "/api/auth",
    ...(options.clinicAuthRoutes ?? {}),
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

  await app.register(particularTokensNativeRoutes, {
    prefix: "/api/particular/tokens",
    ...(options.particularTokensRoutes ?? {}),
  });

  await app.register(publicProfessionalsNativeRoutes, {
    prefix: "/api/public/professionals",
    ...(options.publicProfessionalsRoutes ?? {}),
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

  return app;
}


