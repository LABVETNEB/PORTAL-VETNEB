import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type { Report, ReportStatus } from "../../drizzle/schema.ts";
import { ENV } from "../lib/env.ts";
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
import { normalizeClinicUserRole } from "../lib/permissions.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";
import { shouldRefreshSessionLastAccess } from "../lib/session-last-access.ts";

type ClinicUserRecord = {
  id: number;
  clinicId: number;
  username: string;
  authProId?: string | null;
  role: unknown;
};

type ActiveSessionRecord = {
  clinicUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type AuthenticatedClinicUser = {
  id: number;
  clinicId: number;
  username: string;
  authProId: string | null;
  role: ReturnType<typeof normalizeClinicUserRole>;
  sessionToken: string;
};

export type ReportsNativeRoutesOptions = {
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<ActiveSessionRecord | null>;
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

type NativeReportsDeps = Required<
  Pick<
    ReportsNativeRoutesOptions,
    | "deleteActiveSession"
    | "getActiveSessionByToken"
    | "getClinicUserById"
    | "updateSessionLastAccess"
    | "hashSessionToken"
  >
>;

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

function parseCookies(cookieHeader: string | undefined) {
  const result: Record<string, string> = {};

  if (!cookieHeader) {
    return result;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = part.split("=");

    if (!rawName) {
      continue;
    }

    const name = rawName.trim();

    if (!name) {
      continue;
    }

    const rawValue = rawValueParts.join("=").trim();

    try {
      result[name] = decodeURIComponent(rawValue);
    } catch {
      result[name] = rawValue;
    }
  }

  return result;
}

function getSessionToken(request: FastifyRequest) {
  const cookieHeader =
    typeof request.headers.cookie === "string"
      ? request.headers.cookie
      : undefined;

  const cookies = parseCookies(cookieHeader);
  const raw = cookies[ENV.cookieName];

  if (typeof raw !== "string") {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
}

function serializeCookie(input: {
  name: string;
  value: string;
  maxAgeSeconds?: number;
  expires?: string;
}) {
  const parts = [
    `${input.name}=${encodeURIComponent(input.value)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${ENV.cookieSameSite}`,
  ];

  if (ENV.cookieSecure) {
    parts.push("Secure");
  }

  if (typeof input.maxAgeSeconds === "number") {
    parts.push(`Max-Age=${input.maxAgeSeconds}`);
  }

  if (input.expires) {
    parts.push(`Expires=${input.expires}`);
  }

  return parts.join("; ");
}

function buildClearSessionCookie() {
  return serializeCookie({
    name: ENV.cookieName,
    value: "",
    maxAgeSeconds: 0,
    expires: "Thu, 01 Jan 1970 00:00:00 GMT",
  });
}


async function authenticateClinicUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeReportsDeps,
  now: () => number,
): Promise<AuthenticatedClinicUser | null> {
  const token = getSessionToken(request);

  if (!token) {
    reply.code(401).send({
      success: false,
      error: "No autenticado",
    });
    return null;
  }

  const tokenHash = deps.hashSessionToken(token);
  const session = await deps.getActiveSessionByToken(tokenHash);

  if (!session) {
    reply.code(401).send({
      success: false,
      error: "Sesión inválida",
    });
    return null;
  }

  if (session.expiresAt && session.expiresAt.getTime() <= now()) {
    await deps.deleteActiveSession(tokenHash);

    reply.header("set-cookie", buildClearSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Sesión expirada",
    });
    return null;
  }

  const clinicUser = await deps.getClinicUserById(session.clinicUserId);

  if (!clinicUser) {
    await deps.deleteActiveSession(tokenHash);

    reply.header("set-cookie", buildClearSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Usuario de sesión no encontrado",
    });
    return null;
  }

  if (shouldRefreshSessionLastAccess(session.lastAccess ?? null, now())) {
    await deps.updateSessionLastAccess(tokenHash);
  }

  const role = normalizeClinicUserRole(clinicUser.role, "clinic_staff");
  return {
    id: clinicUser.id,
    clinicId: clinicUser.clinicId,
    username: clinicUser.username,
    authProId: clinicUser.authProId ?? null,
    role,
    sessionToken: token,
  };
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
      const safeUrl = sanitizeUrlForLogs(request.url);

      console.log(
        buildRequestLogLine({
          timestamp: new Date().toISOString(),
          method: request.method,
          url: safeUrl,
          statusCode: reply.statusCode,
          durationMs,
        }),
      );
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
      const auth = await authenticateClinicUser(
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
      const auth = await authenticateClinicUser(
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
      const auth = await authenticateClinicUser(
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
      const auth = await authenticateClinicUser(
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
      const auth = await authenticateClinicUser(
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
      const auth = await authenticateClinicUser(
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
