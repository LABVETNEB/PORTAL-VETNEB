import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type { Report, ReportStatus } from "../../drizzle/schema";
import { AUDIT_EVENTS } from "../lib/audit.ts";
import { ENV } from "../lib/env.ts";
import {
  normalizeOptionalNote,
  parseReportId,
  parseReportStatus,
} from "../lib/reports.ts";
import {
  REPORT_STATUSES,
  canTransitionReportStatus,
} from "../lib/report-status.ts";
import {
  getClinicPermissions,
  normalizeClinicUserRole,
} from "../lib/permissions.ts";
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
  permissions: ReturnType<typeof getClinicPermissions>;
  canUploadReports: boolean;
  canManageClinicUsers: boolean;
  sessionToken: string;
};

type AuditWriteInput = {
  event: string;
  clinicId?: number | null;
  reportId?: number | null;
  metadata?: Record<string, unknown>;
  actor?: {
    type: string;
    clinicUserId?: number | null;
  };
};

export type ReportsStatusNativeRoutesOptions = {
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<ActiveSessionRecord | null>;
  getClinicUserById?: (
    clinicUserId: number,
  ) => Promise<ClinicUserRecord | null>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  getReportById?: (reportId: number) => Promise<Report | null>;
  updateReportStatus?: (input: {
    reportId: number;
    toStatus: ReportStatus;
    note: string | null;
    changedByClinicUserId?: number | null;
    changedByAdminUserId?: number | null;
  }) => Promise<Report | null | undefined>;
  createSignedReportUrl?: (storagePath: string) => Promise<string>;
  createSignedReportDownloadUrl?: (
    storagePath: string,
    fileName?: string,
  ) => Promise<string>;
  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;
  now?: () => number;
};

const REQUEST_START_TIME_KEY = "__reportsStatusRequestStartTimeNs";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

type ReportsStatusFastifyRequest = FastifyRequest & {
  [REQUEST_START_TIME_KEY]?: bigint;
};

type NativeReportsStatusDeps = Required<
  Pick<
    ReportsStatusNativeRoutesOptions,
    | "deleteActiveSession"
    | "getActiveSessionByToken"
    | "getClinicUserById"
    | "updateSessionLastAccess"
    | "hashSessionToken"
    | "getReportById"
    | "updateReportStatus"
    | "createSignedReportUrl"
    | "createSignedReportDownloadUrl"
    | "writeAuditLog"
  >
>;

let defaultDepsPromise: Promise<NativeReportsStatusDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeReportsStatusDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const storage = await import("../lib/supabase.ts");
      const audit = await import("../lib/audit.ts");

      return {
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        updateSessionLastAccess: db.updateSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        getReportById: db.getReportById,
        updateReportStatus: db.updateReportStatus,
        createSignedReportUrl: storage.createSignedReportUrl,
        createSignedReportDownloadUrl: storage.createSignedReportDownloadUrl,
        writeAuditLog: audit.writeAuditLog as (
          req: unknown,
          input: AuditWriteInput,
        ) => Promise<void>,
      };
    })();
  }

  return defaultDepsPromise!;
}

function hasAllInjectedDeps(options: ReportsStatusNativeRoutesOptions) {
  return (
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.updateSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.getReportById &&
    !!options.updateReportStatus &&
    !!options.createSignedReportUrl &&
    !!options.createSignedReportDownloadUrl &&
    !!options.writeAuditLog
  );
}

async function resolveDeps(
  options: ReportsStatusNativeRoutesOptions,
): Promise<NativeReportsStatusDeps> {
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
    getReportById: options.getReportById ?? defaultDeps!.getReportById,
    updateReportStatus:
      options.updateReportStatus ?? defaultDeps!.updateReportStatus,
    createSignedReportUrl:
      options.createSignedReportUrl ?? defaultDeps!.createSignedReportUrl,
    createSignedReportDownloadUrl:
      options.createSignedReportDownloadUrl ??
      defaultDeps!.createSignedReportDownloadUrl,
    writeAuditLog: options.writeAuditLog ?? defaultDeps!.writeAuditLog,
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

function enforceTrustedOrigin(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: ReadonlySet<string>,
) {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) {
    return true;
  }

  const requestOrigin = getRequestOrigin(request);

  if (!requestOrigin) {
    return true;
  }

  if (allowedOrigins.has(requestOrigin)) {
    return true;
  }

  reply.code(403).send({
    success: false,
    error: "Origen no permitido",
  });

  return false;
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

function createAuditRequestLike(
  request: FastifyRequest,
  auth: AuthenticatedClinicUser,
) {
  return {
    method: request.method,
    originalUrl: request.url,
    ip: request.ip,
    headers: request.headers,
    auth: {
      id: auth.id,
      clinicId: auth.clinicId,
      username: auth.username,
      role: auth.role,
      canManageClinicUsers: auth.canManageClinicUsers,
      canUploadReports: auth.canUploadReports,
    },
  };
}

async function authenticateClinicUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeReportsStatusDeps,
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
  const permissions = getClinicPermissions(role);

  return {
    id: clinicUser.id,
    clinicId: clinicUser.clinicId,
    username: clinicUser.username,
    authProId: clinicUser.authProId ?? null,
    role,
    permissions,
    canUploadReports: permissions.canUploadReports,
    canManageClinicUsers: permissions.canManageClinicUsers,
    sessionToken: token,
  };
}

function requireReportStatusWritePermission(
  auth: AuthenticatedClinicUser,
  reply: FastifyReply,
) {
  if (auth.canManageClinicUsers) {
    return true;
  }

  reply.code(403).send({
    success: false,
    error: "No autorizado para cambiar el estado de informes",
  });

  return false;
}

async function getAuthorizedReport(
  reportId: number,
  clinicId: number,
  unauthorizedMessage: string,
  deps: NativeReportsStatusDeps,
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

async function serializeReport(report: Report, deps: NativeReportsStatusDeps) {
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

export const reportsStatusNativeRoutes: FastifyPluginAsync<
  ReportsStatusNativeRoutesOptions
> = async (app, options) => {
  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(getAllowedOrigins());

  app.addHook("onRequest", async (request, reply) => {
    (request as ReportsStatusFastifyRequest)[REQUEST_START_TIME_KEY] =
      process.hrtime.bigint();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt =
      (request as ReportsStatusFastifyRequest)[REQUEST_START_TIME_KEY] ??
      process.hrtime.bigint();

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
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
    reply.header("access-control-allow-methods", "PATCH,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/:reportId/status", optionsHandler);

  app.patch<{
    Params: {
      reportId?: unknown;
    };
    Body: {
      status?: unknown;
      note?: unknown;
    };
  }>("/:reportId/status", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const deps = await resolveDeps(options);
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    if (!requireReportStatusWritePermission(auth, reply)) {
      return reply;
    }

    const reportId = parseReportId(request.params.reportId);
    const nextStatus = parseReportStatus(request.body?.status);
    const note = normalizeOptionalNote(request.body?.note);

    if (typeof reportId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de informe invalido",
      });
    }

    if (!nextStatus) {
      return reply.code(400).send({
        success: false,
        error: "Estado de informe invalido",
        allowedStatuses: REPORT_STATUSES,
      });
    }

    const reportResult = await getAuthorizedReport(
      reportId,
      auth.clinicId,
      "No autorizado para cambiar el estado de este informe",
      deps,
    );

    if (!("report" in reportResult)) {
      return reply.code(reportResult.status).send({
        success: false,
        error: reportResult.error,
      });
    }

    if (reportResult.report.currentStatus === nextStatus) {
      return reply.code(400).send({
        success: false,
        error: "El informe ya se encuentra en ese estado",
      });
    }

    if (!canTransitionReportStatus(reportResult.report.currentStatus, nextStatus)) {
      return reply.code(400).send({
        success: false,
        error: "La transición de estado no está permitida",
        currentStatus: reportResult.report.currentStatus,
        requestedStatus: nextStatus,
        allowedStatuses: REPORT_STATUSES,
      });
    }

    const updated = await deps.updateReportStatus({
      reportId,
      toStatus: nextStatus,
      note,
      changedByClinicUserId: auth.id,
      changedByAdminUserId: null,
    });

    if (!updated) {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
      });
    }

    await deps.writeAuditLog(createAuditRequestLike(request, auth), {
      event: AUDIT_EVENTS.REPORT_STATUS_CHANGED,
      clinicId: updated.clinicId,
      reportId: updated.id,
      metadata: {
        fromStatus: reportResult.report.currentStatus,
        toStatus: nextStatus,
        note,
      },
    });

    return reply.code(200).send({
      success: true,
      message: "Estado de informe actualizado correctamente",
      report: await serializeReport(updated, deps),
    });
  });
};
