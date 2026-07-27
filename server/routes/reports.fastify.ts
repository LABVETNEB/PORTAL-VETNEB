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
  serializeSafeReport,
} from "../features/reports/domain/index.ts";
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
    | "getReportsByClinicId"
    | "countReportsByClinicId"
    | "searchReports"
    | "countSearchReports"
    | "getStudyTypes"
    | "getClinicScopedReportById"
    | "getReportStatusHistory"
    | "createSignedReportUrl"
    | "createSignedReportDownloadUrl"
  >
>;

let defaultDepsPromise: Promise<NativeReportsDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeReportsDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const storage = await import("../lib/supabase.ts");

      return {
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        updateSessionLastAccess: db.updateSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        getReportsByClinicId: db.getReportsByClinicId,
        countReportsByClinicId: db.countReportsByClinicId,
        searchReports: db.searchReports,
        countSearchReports: db.countSearchReports,
        getStudyTypes: db.getStudyTypes,
        getClinicScopedReportById: db.getClinicScopedReportById,
        getReportStatusHistory: db.getReportStatusHistory,
        createSignedReportUrl: storage.createSignedReportUrl,
        createSignedReportDownloadUrl: storage.createSignedReportDownloadUrl,
      };
    })();
  }

  return defaultDepsPromise;
}

function hasAllInjectedDeps(options: ReportsNativeRoutesOptions) {
  return (
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.updateSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.getReportsByClinicId &&
    !!options.countReportsByClinicId &&
    !!options.searchReports &&
    !!options.countSearchReports &&
    !!options.getStudyTypes &&
    (!!options.getClinicScopedReportById || !!options.getReportById) &&
    !!options.getReportStatusHistory &&
    !!options.createSignedReportUrl &&
    !!options.createSignedReportDownloadUrl
  );
}

async function resolveDeps(
  options: ReportsNativeRoutesOptions,
): Promise<NativeReportsDeps> {
  const defaultDeps = hasAllInjectedDeps(options) ? undefined : await loadDefaultDeps();

  return {
    deleteActiveSession:
      options.deleteActiveSession ?? defaultDeps!.deleteActiveSession,
    getActiveSessionByToken:
      options.getActiveSessionByToken ?? defaultDeps!.getActiveSessionByToken,
    getClinicUserById:
      options.getClinicUserById ?? defaultDeps!.getClinicUserById,
    updateSessionLastAccess:
      options.updateSessionLastAccess ?? defaultDeps!.updateSessionLastAccess,
    hashSessionToken:
      options.hashSessionToken ?? defaultDeps!.hashSessionToken,
    getReportsByClinicId:
      options.getReportsByClinicId ?? defaultDeps!.getReportsByClinicId,
    countReportsByClinicId:
      options.countReportsByClinicId ?? defaultDeps!.countReportsByClinicId,
    searchReports: options.searchReports ?? defaultDeps!.searchReports,
    countSearchReports:
      options.countSearchReports ?? defaultDeps!.countSearchReports,
    getStudyTypes: options.getStudyTypes ?? defaultDeps!.getStudyTypes,
    getClinicScopedReportById:
      options.getClinicScopedReportById ??
      (options.getReportById
        ? async (reportId: number, clinicId: number) => {
            const report = await options.getReportById!(reportId);
            return report?.clinicId === clinicId ? report : null;
          }
        : defaultDeps!.getClinicScopedReportById),
    getReportStatusHistory:
      options.getReportStatusHistory ?? defaultDeps!.getReportStatusHistory,
    createSignedReportUrl:
      options.createSignedReportUrl ?? defaultDeps!.createSignedReportUrl,
    createSignedReportDownloadUrl:
      options.createSignedReportDownloadUrl ??
      defaultDeps!.createSignedReportDownloadUrl,
  };
}

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

function serializeReports(reports: Report[], _deps: NativeReportsDeps) {
  return reports.map((report) => serializeSafeReport(report));
}

async function getAuthorizedReport(
  reportId: number,
  clinicId: number,
  deps: NativeReportsDeps,
): Promise<{ report: Report } | { status: 404; error: string }> {
  const report = await deps.getClinicScopedReportById(reportId, clinicId);

  if (!report) {
    return {
      status: 404,
      error: "Informe no encontrado",
    };
  }

  return {
    report,
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
      const deps = await resolveDeps(options);
      const auth = await authenticateClinicUser(request, reply, deps, now);

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

      const [reports, total] = await Promise.all([
        deps.getReportsByClinicId(scope.clinicId, limit, offset, currentStatus),
        deps.countReportsByClinicId(scope.clinicId, currentStatus),
      ]);
      const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

      return reply.code(200).send({
        success: true,
        count: reports.length,
        total,
        totalPages,
        reports: await serializeReports(reports, deps),
        filters: {
          status: currentStatus ?? null,
        },
        pagination: {
          limit,
          offset,
        },
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
      const deps = await resolveDeps(options);
      const auth = await authenticateClinicUser(request, reply, deps, now);

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

      const [reports, total] = await Promise.all([
        deps.searchReports(scope.clinicId, query, studyType ?? undefined, limit, offset, currentStatus),
        deps.countSearchReports(scope.clinicId, query, studyType ?? undefined, currentStatus),
      ]);
      const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

      return reply.code(200).send({
        success: true,
        count: reports.length,
        total,
        totalPages,
        reports: await serializeReports(reports, deps),
        filters: {
          query: query ?? null,
          studyType: studyType ?? null,
          status: currentStatus ?? null,
        },
        pagination: {
          limit,
          offset,
        },
      });
    });

    app.get<{
      Querystring: {
        clinicId?: unknown;
      };
    }>("/study-types", async (request, reply) => {
      const deps = await resolveDeps(options);
      const auth = await authenticateClinicUser(request, reply, deps, now);

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

      const studyTypes = await deps.getStudyTypes(scope.clinicId);

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
      const deps = await resolveDeps(options);
      const auth = await authenticateClinicUser(request, reply, deps, now);

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

      const reportResult = await getAuthorizedReport(
        reportId,
        auth.clinicId,
        deps,
      );

      if (!("report" in reportResult)) {
        return reply.code(reportResult.status).send({
          success: false,
          error: reportResult.error,
        });
      }

      const history = await deps.getReportStatusHistory(reportId);

      return reply.code(200).send({
        success: true,
        reportId,
        currentStatus: reportResult.report.currentStatus,
        count: history.length,
        history,
      });
    });

    app.get<{
      Params: {
        reportId?: unknown;
      };
    }>("/:reportId/preview-url", async (request, reply) => {
      const deps = await resolveDeps(options);
      const auth = await authenticateClinicUser(request, reply, deps, now);

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

      const reportResult = await getAuthorizedReport(
        reportId,
        auth.clinicId,
        deps,
      );

      if (!("report" in reportResult)) {
        return reply.code(reportResult.status).send({
          success: false,
          error: reportResult.error,
        });
      }

      const previewUrl = await deps.createSignedReportUrl(
        reportResult.report.storagePath,
      );

      return reply.code(200).send({
        success: true,
        previewUrl,
      });
    });

    app.get<{
      Params: {
        reportId?: unknown;
      };
    }>("/:reportId/download-url", async (request, reply) => {
      const deps = await resolveDeps(options);
      const auth = await authenticateClinicUser(request, reply, deps, now);

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

      const reportResult = await getAuthorizedReport(
        reportId,
        auth.clinicId,
        deps,
      );

      if (!("report" in reportResult)) {
        return reply.code(reportResult.status).send({
          success: false,
          error: reportResult.error,
        });
      }

      const downloadUrl = await deps.createSignedReportDownloadUrl(
        reportResult.report.storagePath,
        reportResult.report.fileName ?? undefined,
      );

      return reply.code(200).send({
        success: true,
        downloadUrl,
      });
    });
  };
