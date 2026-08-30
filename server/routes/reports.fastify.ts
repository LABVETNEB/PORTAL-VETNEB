import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type { Report, ReportStatus } from "../../drizzle/schema.ts";
import {
  getAllowedOrigins,
  getAllowedOriginForCors,
  getRequestOrigin,
} from "../lib/cors-headers.ts";
import {
  REPORT_STATUSES,
  getReadClinicScope,
  normalizeSearchText,
  parseOffset,
  parsePositiveInt,
  parseReportId,
  parseReportStatus,
  parseReportStudyType,
} from "../features/reports/domain/index.ts";
import { createClinicReportsRouteComposition } from "../features/reports/composition/index.ts";
import {
  authenticateFastifyClinicUser,
  type FastifyClinicSessionRecord,
} from "../lib/fastify-clinic-auth.ts";
import { logRequestCompletion } from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";

type ClinicUserRecord = {
  id: number;
  clinicId: number;
  username: string;
  authProId?: string | null;
  role: unknown;
};

export type ReportsNativeRoutesOptions = {
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<FastifyClinicSessionRecord | null>;
  getClinicUserById?: (
    clinicUserId: number,
  ) => Promise<ClinicUserRecord | null>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  getReportsByClinicId?: (
    clinicId: number,
    limit: number,
    offset: number,
    currentStatus?: ReportStatus,
  ) => Promise<Report[]>;
  countReportsByClinicId?: (
    clinicId: number,
    currentStatus?: ReportStatus,
  ) => Promise<number>;
  searchReports?: (
    clinicId: number,
    query: string | undefined,
    studyType: string | undefined,
    limit: number,
    offset: number,
    currentStatus?: ReportStatus,
  ) => Promise<Report[]>;
  countSearchReports?: (
    clinicId: number,
    query: string | undefined,
    studyType: string | undefined,
    currentStatus?: ReportStatus,
  ) => Promise<number>;
  getStudyTypes?: (clinicId: number) => Promise<string[]>;
  getReportById?: (reportId: number) => Promise<Report | null>;
  getClinicScopedReportById?: (
    reportId: number,
    clinicId: number,
  ) => Promise<Report | null | undefined>;
  getReportStatusHistory?: (reportId: number) => Promise<unknown[]>;
  createSignedReportUrl?: (storagePath: string) => Promise<string>;
  createSignedReportDownloadUrl?: (
    storagePath: string,
    fileName?: string,
  ) => Promise<string>;
  now?: () => number;
};

const REQUEST_TIMER_KEY = "__reportsRequestTimer";

type ReportsFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
};

function applyCorsHeaders(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: ReadonlySet<string>,
) {
  const allowedOrigin = getAllowedOriginForCors(request, allowedOrigins);

  if (!allowedOrigin) {
    return;
  }

  reply.header("vary", "Origin");
  reply.header("access-control-allow-origin", allowedOrigin);
  reply.header("access-control-allow-credentials", "true");
}

function validateStatusQuery(status: unknown, currentStatus: ReportStatus | undefined) {
  return typeof status === "undefined" || !!currentStatus;
}

export const reportsNativeRoutes: FastifyPluginAsync<ReportsNativeRoutesOptions> =
  async (app, options) => {
    const now = options.now ?? (() => Date.now());
    const allowedOrigins = new Set(getAllowedOrigins());

    app.addHook("onRequest", async (request, reply) => {
      (request as ReportsFastifyRequest)[REQUEST_TIMER_KEY] =
        createRuntimeTimer();

      applyCorsHeaders(request, reply, allowedOrigins);

      return undefined;
    });

    app.addHook("onResponse", async (request, reply) => {
      const timer =
        (request as ReportsFastifyRequest)[REQUEST_TIMER_KEY] ??
        createRuntimeTimer();

      const durationMs = timer.elapsedMs();

      logRequestCompletion({
        method: request.method,
        routeTemplate: request.routeOptions?.url,
        statusCode: reply.statusCode,
        durationMs,
        requestId: request.id,
      });
    });

    const optionsHandler = async (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      const requestOrigin = getRequestOrigin(request);

      if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
        return reply.code(403).send({
          success: false,
          error: "Origen no permitido",
        });
      }

      applyCorsHeaders(request, reply, allowedOrigins);
      reply.header("access-control-allow-methods", "GET,OPTIONS");

      const requestedHeaders =
        typeof request.headers["access-control-request-headers"] === "string"
          ? request.headers["access-control-request-headers"]
          : "content-type";

      reply.header("access-control-allow-headers", requestedHeaders);
      return reply.code(204).send();
    };

    app.options("/", optionsHandler);
    app.options("/search", optionsHandler);
    app.options("/study-types", optionsHandler);
    app.options("/:reportId/history", optionsHandler);
    app.options("/:reportId/preview-url", optionsHandler);
    app.options("/:reportId/download-url", optionsHandler);

    app.get<{
      Querystring: {
        clinicId?: unknown;
        status?: unknown;
        limit?: unknown;
        offset?: unknown;
      };
    }>("/", async (request, reply) => {
      const composition = await createClinicReportsRouteComposition(options);
      const auth = await authenticateFastifyClinicUser(
        request,
        reply,
        composition.auth,
        now,
      );

      if (!auth) {
        return reply;
      }

      const scope = getReadClinicScope(request.query.clinicId, auth.clinicId);
      const currentStatus = parseReportStatus(request.query.status);
      const limit = parsePositiveInt(request.query.limit, 50, 100);
      const offset = parseOffset(request.query.offset, 0);

      if (scope.isForbidden) {
        return reply.code(403).send({
          success: false,
          error: "No autorizado para consultar otra clinica",
        });
      }

      if (!validateStatusQuery(request.query.status, currentStatus)) {
        return reply.code(400).send({
          success: false,
          error: "Estado de informe invalido",
          allowedStatuses: REPORT_STATUSES,
        });
      }

      const result = await composition.queries.listClinicReports({
        clinicId: scope.clinicId,
        limit,
        offset,
        currentStatus,
      });

      return reply.code(200).send({
        success: true,
        ...result,
      });
    });

    app.get<{
      Querystring: {
        clinicId?: unknown;
        query?: unknown;
        studyType?: unknown;
        status?: unknown;
        limit?: unknown;
        offset?: unknown;
      };
    }>("/search", async (request, reply) => {
      const composition = await createClinicReportsRouteComposition(options);
      const auth = await authenticateFastifyClinicUser(
        request,
        reply,
        composition.auth,
        now,
      );

      if (!auth) {
        return reply;
      }

      const scope = getReadClinicScope(request.query.clinicId, auth.clinicId);
      const query = normalizeSearchText(request.query.query);
      const studyType = parseReportStudyType(request.query.studyType);
      const currentStatus = parseReportStatus(request.query.status);
      const limit = parsePositiveInt(request.query.limit, 50, 100);
      const offset = parseOffset(request.query.offset, 0);

      if (scope.isForbidden) {
        return reply.code(403).send({
          success: false,
          error: "No autorizado para consultar otra clinica",
        });
      }

      if (!validateStatusQuery(request.query.status, currentStatus)) {
        return reply.code(400).send({
          success: false,
          error: "Estado de informe invalido",
          allowedStatuses: REPORT_STATUSES,
        });
      }

      const result = await composition.queries.searchClinicReports({
        clinicId: scope.clinicId,
        query,
        studyType: studyType ?? undefined,
        currentStatus,
        limit,
        offset,
      });

      return reply.code(200).send({
        success: true,
        ...result,
      });
    });

    app.get<{
      Querystring: {
        clinicId?: unknown;
      };
    }>("/study-types", async (request, reply) => {
      const composition = await createClinicReportsRouteComposition(options);
      const auth = await authenticateFastifyClinicUser(
        request,
        reply,
        composition.auth,
        now,
      );

      if (!auth) {
        return reply;
      }

      const scope = getReadClinicScope(request.query.clinicId, auth.clinicId);

      if (scope.isForbidden) {
        return reply.code(403).send({
          success: false,
          error: "No autorizado para consultar otra clinica",
        });
      }

      const studyTypes = await composition.queries.getStudyTypes(
        scope.clinicId,
      );

      return reply.code(200).send({
        success: true,
        studyTypes,
      });
    });

    app.get<{
      Params: {
        reportId?: unknown;
      };
    }>("/:reportId/history", async (request, reply) => {
      const composition = await createClinicReportsRouteComposition(options);
      const auth = await authenticateFastifyClinicUser(
        request,
        reply,
        composition.auth,
        now,
      );

      if (!auth) {
        return reply;
      }

      const reportId = parseReportId(request.params.reportId);

      if (typeof reportId !== "number") {
        return reply.code(400).send({
          success: false,
          error: "ID de informe invalido",
        });
      }

      const result = await composition.queries.getClinicReportHistory(
        reportId,
        auth.clinicId,
      );

      if (result.type === "not_found") {
        return reply.code(404).send({
          success: false,
          error: "Informe no encontrado",
        });
      }

      return reply.code(200).send({
        success: true,
        reportId: result.reportId,
        currentStatus: result.currentStatus,
        count: result.count,
        history: result.history,
      });
    });

    app.get<{
      Params: {
        reportId?: unknown;
      };
    }>("/:reportId/preview-url", async (request, reply) => {
      const composition = await createClinicReportsRouteComposition(options);
      const auth = await authenticateFastifyClinicUser(
        request,
        reply,
        composition.auth,
        now,
      );

      if (!auth) {
        return reply;
      }

      const reportId = parseReportId(request.params.reportId);

      if (typeof reportId !== "number") {
        return reply.code(400).send({
          success: false,
          error: "ID de informe invalido",
        });
      }

      const result = await composition.queries.getClinicReportPreview(
        reportId,
        auth.clinicId,
      );

      if (result.type === "not_found") {
        return reply.code(404).send({
          success: false,
          error: "Informe no encontrado",
        });
      }

      return reply.code(200).send({
        success: true,
        previewUrl: result.previewUrl,
      });
    });

    app.get<{
      Params: {
        reportId?: unknown;
      };
    }>("/:reportId/download-url", async (request, reply) => {
      const composition = await createClinicReportsRouteComposition(options);
      const auth = await authenticateFastifyClinicUser(
        request,
        reply,
        composition.auth,
        now,
      );

      if (!auth) {
        return reply;
      }

      const reportId = parseReportId(request.params.reportId);

      if (typeof reportId !== "number") {
        return reply.code(400).send({
          success: false,
          error: "ID de informe invalido",
        });
      }

      const result = await composition.queries.getClinicReportDownload(
        reportId,
        auth.clinicId,
      );

      if (result.type === "not_found") {
        return reply.code(404).send({
          success: false,
          error: "Informe no encontrado",
        });
      }

      return reply.code(200).send({
        success: true,
        downloadUrl: result.downloadUrl,
      });
    });
};
