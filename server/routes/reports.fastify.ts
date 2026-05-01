import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type { Report, ReportStatus } from "../../drizzle/schema";
import { ENV } from "../lib/env.ts";
import {
  getReadClinicScope,
  normalizeSearchText,
  parseOffset,
  parsePositiveInt,
  parseReportId,
  parseReportStatus,
} from "../lib/reports.ts";
import { REPORT_STATUSES } from "../lib/report-status.ts";
import { normalizeClinicUserRole } from "../lib/permissions.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";

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
  searchReports?: (
    clinicId: number,
    query: string | undefined,
    studyType: string | undefined,
    limit: number,
    offset: number,
    currentStatus?: ReportStatus,
  ) => Promise<Report[]>;
  getStudyTypes?: (clinicId: number) => Promise<string[]>;
  getReportById?: (reportId: number) => Promise<Report | null>;
  getReportStatusHistory?: (reportId: number) => Promise<unknown[]>;
  createSignedReportUrl?: (storagePath: string) => Promise<string>;
  createSignedReportDownloadUrl?: (
    storagePath: string,
    fileName?: string,
  ) => Promise<string>;
  now?: () => number;
};

const REQUEST_START_TIME_KEY = "__reportsRequestStartTimeNs";
const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

type ReportsFastifyRequest = FastifyRequest & {
  [REQUEST_START_TIME_KEY]?: bigint;
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
    | "searchReports"
    | "getStudyTypes"
    | "getReportById"
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
        searchReports: db.searchReports,
        getStudyTypes: db.getStudyTypes,
        getReportById: db.getReportById,
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
    !!options.searchReports &&
    !!options.getStudyTypes &&
    !!options.getReportById &&
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
    searchReports: options.searchReports ?? defaultDeps!.searchReports,
    getStudyTypes: options.getStudyTypes ?? defaultDeps!.getStudyTypes,
    getReportById: options.getReportById ?? defaultDeps!.getReportById,
    getReportStatusHistory:
      options.getReportStatusHistory ?? defaultDeps!.getReportStatusHistory,
    createSignedReportUrl:
      options.createSignedReportUrl ?? defaultDeps!.createSignedReportUrl,
    createSignedReportDownloadUrl:
      options.createSignedReportDownloadUrl ??
      defaultDeps!.createSignedReportDownloadUrl,
  };
}

function getAllowedOrigins(): string[] {
  const configuredOrigins = ENV.corsOrigins.map((origin) =>
    origin.trim().toLowerCase(),
  );

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  if (ENV.isDevelopment) {
    return [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ];
  }

  return [];
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin.trim().toLowerCase();
  } catch {
    return null;
  }
}

function getOriginHeader(request: FastifyRequest) {
  return typeof request.headers.origin === "string"
    ? request.headers.origin.trim()
    : "";
}

function getAllowedOriginForCors(
  request: FastifyRequest,
  allowedOrigins: ReadonlySet<string>,
) {
  const rawOrigin = getOriginHeader(request);

  if (!rawOrigin) {
    return null;
  }

  const normalizedOrigin = normalizeOrigin(rawOrigin);

  if (!normalizedOrigin || !allowedOrigins.has(normalizedOrigin)) {
    return null;
  }

  return rawOrigin;
}

function getRequestOrigin(request: FastifyRequest): string | null {
  const originHeader = getOriginHeader(request);

  if (originHeader) {
    return normalizeOrigin(originHeader);
  }

  const refererHeader =
    typeof request.headers.referer === "string"
      ? request.headers.referer.trim()
      : "";

  if (refererHeader) {
    return normalizeOrigin(refererHeader);
  }

  return null;
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

function shouldRefreshSessionLastAccess(
  lastAccess: Date | null | undefined,
  nowMs: number,
) {
  if (!(lastAccess instanceof Date)) {
    return true;
  }

  return nowMs - lastAccess.getTime() >= SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS;
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

async function serializeReport(report: Report, deps: NativeReportsDeps) {
  const [previewUrl, downloadUrl] = await Promise.all([
    deps.createSignedReportUrl(report.storagePath),
    deps.createSignedReportDownloadUrl(
      report.storagePath,
      report.fileName ?? undefined,
    ),
  ]);

  return {
    ...report,
    previewUrl,
    downloadUrl,
  };
}

async function serializeReports(reports: Report[], deps: NativeReportsDeps) {
  return Promise.all(reports.map((report) => serializeReport(report, deps)));
}

async function getAuthorizedReport(
  reportId: number,
  clinicId: number,
  unauthorizedMessage: string,
  deps: NativeReportsDeps,
): Promise<{ report: Report } | { status: 403 | 404; error: string }> {
  const report = await deps.getReportById(reportId);

  if (!report) {
    return {
      status: 404,
      error: "Informe no encontrado",
    };
  }

  if (report.clinicId !== clinicId) {
    return {
      status: 403,
      error: unauthorizedMessage,
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
      (request as ReportsFastifyRequest)[REQUEST_START_TIME_KEY] =
        process.hrtime.bigint();

      applyCorsHeaders(request, reply, allowedOrigins);

      return undefined;
    });

    app.addHook("onResponse", async (request, reply) => {
      const startedAt =
        (request as ReportsFastifyRequest)[REQUEST_START_TIME_KEY] ??
        process.hrtime.bigint();

      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
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

      const reports = await deps.getReportsByClinicId(
        scope.clinicId,
        limit,
        offset,
        currentStatus,
      );

      return reply.code(200).send({
        success: true,
        count: reports.length,
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
      const studyType = normalizeSearchText(request.query.studyType);
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

      const reports = await deps.searchReports(
        scope.clinicId,
        query,
        studyType,
        limit,
        offset,
        currentStatus,
      );

      return reply.code(200).send({
        success: true,
        count: reports.length,
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
        "No autorizado para consultar el historial de este informe",
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
        "No autorizado para previsualizar este informe",
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
        "No autorizado para descargar este informe",
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
