import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { ENV } from "../lib/env.ts";
import {
  buildAdminAuditCsv as defaultBuildAdminAuditCsv,
  buildAdminAuditCsvFilename as defaultBuildAdminAuditCsvFilename,
  buildAdminAuditListFilters as defaultBuildAdminAuditListFilters,
  type AdminAuditListFilters,
  type AuditLogListItem,
} from "../lib/admin-audit.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";

type AdminUserRecord = {
  id: number;
  username: string;
};

type AdminSessionRecord = {
  adminUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type AuthenticatedAdminUser = {
  id: number;
  username: string;
  sessionToken: string;
};

type AuditListResult = {
  items: AuditLogListItem[];
  total: number;
};

export type AdminAuditNativeRoutesOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken?: (
    tokenHash: string,
  ) => Promise<AdminSessionRecord | null>;
  getAdminUserById?: (adminUserId: number) => Promise<AdminUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  listAuditLog?: (filters: AdminAuditListFilters) => Promise<AuditListResult>;
  buildAdminAuditListFilters?: (
    query: Record<string, unknown>,
  ) => {
    filters: AdminAuditListFilters;
    errors: string[];
  };
  buildAdminAuditCsv?: (items: AuditLogListItem[]) => string;
  buildAdminAuditCsvFilename?: (now?: Date) => string;
  now?: () => number;
};

const REQUEST_START_TIME_KEY = "__adminAuditRequestStartTimeNs";
const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;
const ADMIN_AUDIT_CSV_EXPORT_MAX_ROWS = 10_000;

type AdminAuditFastifyRequest = FastifyRequest & {
  [REQUEST_START_TIME_KEY]?: bigint;
};

type NativeAdminAuditDeps = Required<
  Pick<
    AdminAuditNativeRoutesOptions,
    | "deleteAdminSession"
    | "getAdminSessionByToken"
    | "getAdminUserById"
    | "updateAdminSessionLastAccess"
    | "hashSessionToken"
    | "listAuditLog"
    | "buildAdminAuditListFilters"
    | "buildAdminAuditCsv"
    | "buildAdminAuditCsvFilename"
  >
>;

let defaultDepsPromise: Promise<NativeAdminAuditDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeAdminAuditDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const dbAudit = await import("../db-audit.ts");

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        listAuditLog: dbAudit.listAuditLog,
        buildAdminAuditListFilters: defaultBuildAdminAuditListFilters,
        buildAdminAuditCsv: defaultBuildAdminAuditCsv,
        buildAdminAuditCsvFilename: defaultBuildAdminAuditCsvFilename,
      };
    })();
  }

  return defaultDepsPromise!;
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

function getAdminSessionToken(request: FastifyRequest) {
  const cookieHeader =
    typeof request.headers.cookie === "string"
      ? request.headers.cookie
      : undefined;

  const cookies = parseCookies(cookieHeader);
  const raw = cookies[ENV.adminCookieName];

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

function buildClearAdminSessionCookie() {
  return serializeCookie({
    name: ENV.adminCookieName,
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

async function authenticateAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeAdminAuditDeps,
  now: () => number,
): Promise<AuthenticatedAdminUser | null> {
  const token = getAdminSessionToken(request);

  if (!token) {
    reply.code(401).send({
      success: false,
      error: "Admin no autenticado",
    });
    return null;
  }

  const tokenHash = deps.hashSessionToken(token);
  const session = await deps.getAdminSessionByToken(tokenHash);

  if (!session) {
    reply.code(401).send({
      success: false,
      error: "Sesión admin inválida",
    });
    return null;
  }

  if (session.expiresAt && session.expiresAt.getTime() <= now()) {
    await deps.deleteAdminSession(tokenHash);

    reply.header("set-cookie", buildClearAdminSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Sesión admin expirada",
    });
    return null;
  }

  const adminUser = await deps.getAdminUserById(session.adminUserId);

  if (!adminUser) {
    await deps.deleteAdminSession(tokenHash);

    reply.header("set-cookie", buildClearAdminSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Usuario admin de sesión no encontrado",
    });
    return null;
  }

  if (shouldRefreshSessionLastAccess(session.lastAccess ?? null, now())) {
    await deps.updateAdminSessionLastAccess(tokenHash);
  }

  return {
    id: adminUser.id,
    username: adminUser.username,
    sessionToken: token,
  };
}

export const adminAuditNativeRoutes: FastifyPluginAsync<
  AdminAuditNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.deleteAdminSession &&
    !!options.getAdminSessionByToken &&
    !!options.getAdminUserById &&
    !!options.updateAdminSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.listAuditLog &&
    !!options.buildAdminAuditListFilters &&
    !!options.buildAdminAuditCsv &&
    !!options.buildAdminAuditCsvFilename;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeAdminAuditDeps = {
    deleteAdminSession:
      options.deleteAdminSession ?? defaultDeps!.deleteAdminSession,
    getAdminSessionByToken:
      options.getAdminSessionByToken ?? defaultDeps!.getAdminSessionByToken,
    getAdminUserById:
      options.getAdminUserById ?? defaultDeps!.getAdminUserById,
    updateAdminSessionLastAccess:
      options.updateAdminSessionLastAccess ??
      defaultDeps!.updateAdminSessionLastAccess,
    hashSessionToken:
      options.hashSessionToken ?? defaultDeps!.hashSessionToken,
    listAuditLog: options.listAuditLog ?? defaultDeps!.listAuditLog,
    buildAdminAuditListFilters:
      options.buildAdminAuditListFilters ??
      defaultDeps!.buildAdminAuditListFilters,
    buildAdminAuditCsv:
      options.buildAdminAuditCsv ?? defaultDeps!.buildAdminAuditCsv,
    buildAdminAuditCsvFilename:
      options.buildAdminAuditCsvFilename ??
      defaultDeps!.buildAdminAuditCsvFilename,
  };

  const now = options.now ?? (() => Date.now());

  app.addHook("onRequest", async (request) => {
    (request as AdminAuditFastifyRequest)[REQUEST_START_TIME_KEY] =
      process.hrtime.bigint();

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt =
      (request as AdminAuditFastifyRequest)[REQUEST_START_TIME_KEY] ??
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
    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const { filters, errors } = deps.buildAdminAuditListFilters(
      request.query ?? {},
    );

    if (errors.length > 0) {
      return reply.code(400).send({
        success: false,
        error: errors[0],
      });
    }

    const exportFilters: AdminAuditListFilters = {
      ...filters,
      limit: ADMIN_AUDIT_CSV_EXPORT_MAX_ROWS,
      offset: 0,
    };

    const result = await deps.listAuditLog(exportFilters);

    if (result.total > ADMIN_AUDIT_CSV_EXPORT_MAX_ROWS) {
      return reply.code(400).send({
        success: false,
        error: `Demasiados registros para exportar. Aplica filtros mas especificos (maximo ${ADMIN_AUDIT_CSV_EXPORT_MAX_ROWS}).`,
      });
    }

    const csv = deps.buildAdminAuditCsv(result.items);
    const filename = deps.buildAdminAuditCsvFilename();

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
    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const { filters, errors } = deps.buildAdminAuditListFilters(
      request.query ?? {},
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
        clinicId: filters.clinicId ?? null,
        reportId: filters.reportId ?? null,
        actorAdminUserId: filters.actorAdminUserId ?? null,
        actorClinicUserId: filters.actorClinicUserId ?? null,
        actorReportAccessTokenId: filters.actorReportAccessTokenId ?? null,
        targetReportAccessTokenId: filters.targetReportAccessTokenId ?? null,
        from: filters.from ?? null,
        to: filters.to ?? null,
      },
    });
  });
};
