import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  buildAdminAuditCsv as defaultBuildAdminAuditCsv,
  buildClinicAuditListFilters as defaultBuildClinicAuditListFilters,
  type AdminAuditListFilters,
  type AuditLogListItem,
} from "../lib/admin-audit.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";
import {
  getClinicPermissions,
  normalizeClinicUserRole,
} from "../lib/permissions.ts";

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

type AuditListResult = {
  items: AuditLogListItem[];
  total: number;
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

export type ClinicAuditNativeRoutesOptions = {
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<ActiveSessionRecord | null>;
  getClinicUserById?: (
    clinicUserId: number,
  ) => Promise<ClinicUserRecord | null>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  listAuditLog?: (filters: AdminAuditListFilters) => Promise<AuditListResult>;
  buildClinicAuditListFilters?: (
    query: Record<string, unknown>,
    clinicId: number,
  ) => {
    filters: AdminAuditListFilters;
    errors: string[];
  };
  buildAdminAuditCsv?: (items: AuditLogListItem[]) => string;
  now?: () => number;
};

const REQUEST_START_TIME_KEY = "__clinicAuditRequestStartTimeNs";
const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;
const CLINIC_AUDIT_CSV_EXPORT_MAX_ROWS = 10_000;

type ClinicAuditFastifyRequest = FastifyRequest & {
  [REQUEST_START_TIME_KEY]?: bigint;
};

type NativeClinicAuditDeps = Required<
  Pick<
    ClinicAuditNativeRoutesOptions,
    | "deleteActiveSession"
    | "getActiveSessionByToken"
    | "getClinicUserById"
    | "updateSessionLastAccess"
    | "hashSessionToken"
    | "listAuditLog"
    | "buildClinicAuditListFilters"
    | "buildAdminAuditCsv"
  >
>;

let defaultDepsPromise: Promise<NativeClinicAuditDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeClinicAuditDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const dbAudit = await import("../db-audit.ts");

      return {
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        updateSessionLastAccess: db.updateSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        listAuditLog: dbAudit.listAuditLog,
        buildClinicAuditListFilters: defaultBuildClinicAuditListFilters,
        buildAdminAuditCsv: defaultBuildAdminAuditCsv,
      };
    })();
  }

  return defaultDepsPromise!;
}

function buildClinicAuditCsvFilename(now = new Date()): string {
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  return `clinic-audit-log-${timestamp}.csv`;
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
  const envCookieName = process.env.COOKIE_NAME?.trim() || "vetneb_session";
  const raw = cookies[envCookieName];

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
  const sameSite = process.env.COOKIE_SAME_SITE?.trim() || "Lax";
  const secure =
    (process.env.COOKIE_SECURE?.trim() || "").toLowerCase() === "true";

  const parts = [
    `${input.name}=${encodeURIComponent(input.value)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${sameSite}`,
  ];

  if (secure) {
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
  const envCookieName = process.env.COOKIE_NAME?.trim() || "vetneb_session";

  return serializeCookie({
    name: envCookieName,
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
  deps: NativeClinicAuditDeps,
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

export const clinicAuditNativeRoutes: FastifyPluginAsync<
  ClinicAuditNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.updateSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.listAuditLog &&
    !!options.buildClinicAuditListFilters &&
    !!options.buildAdminAuditCsv;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeClinicAuditDeps = {
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
    listAuditLog: options.listAuditLog ?? defaultDeps!.listAuditLog,
    buildClinicAuditListFilters:
      options.buildClinicAuditListFilters ??
      defaultDeps!.buildClinicAuditListFilters,
    buildAdminAuditCsv:
      options.buildAdminAuditCsv ?? defaultDeps!.buildAdminAuditCsv,
  };

  const now = options.now ?? (() => Date.now());

  app.addHook("onRequest", async (request) => {
    (request as ClinicAuditFastifyRequest)[REQUEST_START_TIME_KEY] =
      process.hrtime.bigint();

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt =
      (request as ClinicAuditFastifyRequest)[REQUEST_START_TIME_KEY] ??
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

  app.get<{
    Querystring: Record<string, unknown>;
  }>("/export.csv", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const { filters, errors } = deps.buildClinicAuditListFilters(
      request.query ?? {},
      auth.clinicId,
    );

    if (errors.length > 0) {
      return reply.code(400).send({
        success: false,
        error: errors[0],
      });
    }

    const exportFilters: AdminAuditListFilters = {
      ...filters,
      limit: CLINIC_AUDIT_CSV_EXPORT_MAX_ROWS,
      offset: 0,
    };

    const result = await deps.listAuditLog(exportFilters);

    if (result.total > CLINIC_AUDIT_CSV_EXPORT_MAX_ROWS) {
      return reply.code(400).send({
        success: false,
        error: `Demasiados registros para exportar. Aplica filtros mas especificos (maximo ${CLINIC_AUDIT_CSV_EXPORT_MAX_ROWS}).`,
      });
    }

    const csv = deps.buildAdminAuditCsv(result.items);
    const filename = buildClinicAuditCsvFilename();

    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header(
      "content-disposition",
      `attachment; filename="${filename}"`,
    );

    return reply.code(200).send(csv);
  });

  app.get<{
    Querystring: Record<string, unknown>;
  }>("/", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const { filters, errors } = deps.buildClinicAuditListFilters(
      request.query ?? {},
      auth.clinicId,
    );

    if (errors.length > 0) {
      return reply.code(400).send({
        success: false,
        error: errors[0],
      });
    }

    const result = await deps.listAuditLog(filters);

    return reply.code(200).send({
      success: true,
      count: result.items.length,
      items: result.items,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: result.total,
      },
      filters: {
        event: filters.event ?? null,
        actorType: filters.actorType ?? null,
        clinicId: auth.clinicId,
        reportId: filters.reportId ?? null,
        actorClinicUserId: filters.actorClinicUserId ?? null,
        actorReportAccessTokenId: filters.actorReportAccessTokenId ?? null,
        targetReportAccessTokenId: filters.targetReportAccessTokenId ?? null,
        from: filters.from ?? null,
        to: filters.to ?? null,
      },
    });
  });
};
