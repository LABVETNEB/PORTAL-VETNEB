import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import fastifyExpress from "@fastify/express";

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
  studyTrackingNativeRoutes,
  type StudyTrackingNativeRoutesOptions,
} from "./routes/study-tracking.fastify.ts";

type HealthCheckResponse = {
  statusCode: number;
  payload: Record<string, unknown>;
};

type LegacyExpressHandler = (
  req: unknown,
  res: unknown,
  next: (error?: unknown) => void,
) => unknown;

type LegacyAppFactory =
  () => LegacyExpressHandler | Promise<LegacyExpressHandler>;
type HealthCheckFactory = () => Promise<HealthCheckResponse>;
type ServiceInfoFactory = () => Record<string, unknown>;

export type CreateFastifyAppOptions = {
  createLegacyApp?: LegacyAppFactory;
  getNativeHealthCheckResponse?: HealthCheckFactory;
  getServiceInfoPayload?: ServiceInfoFactory;
  adminAuditRoutes?: AdminAuditNativeRoutesOptions;
  adminAuthRoutes?: AdminAuthNativeRoutesOptions;
  adminParticularTokensRoutes?: AdminParticularTokensNativeRoutesOptions;
  adminReportAccessTokensRoutes?: AdminReportAccessTokensNativeRoutesOptions;
  adminStudyTrackingRoutes?: AdminStudyTrackingNativeRoutesOptions;
  clinicAuthRoutes?: AuthNativeRoutesOptions;
  clinicAuditRoutes?: ClinicAuditNativeRoutesOptions;
  clinicPublicProfileRoutes?: ClinicPublicProfileNativeRoutesOptions;
  particularAuthRoutes?: ParticularAuthNativeRoutesOptions;
  particularStudyTrackingRoutes?: ParticularStudyTrackingNativeRoutesOptions;
  particularTokensRoutes?: ParticularTokensNativeRoutesOptions;
  publicProfessionalsRoutes?: PublicProfessionalsNativeRoutesOptions;
  publicReportAccessRoutes?: PublicReportAccessNativeRoutesOptions;
  reportAccessTokensRoutes?: ReportAccessTokensNativeRoutesOptions;
  reportsRoutes?: ReportsNativeRoutesOptions;
  studyTrackingRoutes?: StudyTrackingNativeRoutesOptions;
};

const NATIVE_API_BRIDGE_BYPASS_PREFIXES = [
  "/health",
  "/admin/audit-log",
  "/admin/auth",
  "/admin/particular/tokens",
  "/admin/particular-tokens",
  "/admin/report-access-tokens",
  "/admin/study-tracking",
  "/auth",
  "/clinic/audit-log",
  "/clinic/profile",
  "/particular/auth",
  "/particular/study-tracking",
  "/particular/tokens",
  "/particular-tokens",
  "/public/professionals",
  "/public/report-access",
  "/report-access-tokens",
  "/reports",
  "/study-tracking",
];

function shouldBypassLegacyApi(url: unknown) {
  if (typeof url !== "string") {
    return false;
  }

  const path = url.split("?")[0];

  return NATIVE_API_BRIDGE_BYPASS_PREFIXES.some((prefix) => {
    return (
      path === prefix ||
      path === `${prefix}/` ||
      path.startsWith(`${prefix}/`)
    );
  });
}

export async function createFastifyApp(
  options: CreateFastifyAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: ENV.trustProxy,
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

  await app.register(studyTrackingNativeRoutes, {
    prefix: "/api/study-tracking",
    ...(options.studyTrackingRoutes ?? {}),
  });

  await app.register(fastifyExpress);

  const legacyExpressApp = options.createLegacyApp
    ? await options.createLegacyApp()
    : ((await import("./app.ts")).createExpressApp({
        apiBasePath: "",
        includeRootRoute: false,
        includeHealthRoutes: false,
      }) as unknown as LegacyExpressHandler);

  app.use("/api", (req, res, next) => {
    if (shouldBypassLegacyApi((req as { url?: unknown }).url)) {
      next();
      return;
    }

    legacyExpressApp(req, res, next);
  });

  return app;
}
