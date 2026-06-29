import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { ENV } from "../lib/env.ts";
import {
  getAllowedOrigins,
  getAllowedOriginForCors,
  getRequestOrigin,
} from "../lib/cors-headers.ts";
import { authenticateFastifyAdmin } from "../lib/fastify-admin-auth.ts";
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
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";

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

const REQUEST_TIMER_KEY = "__adminAuditRequestTimer";
const ADMIN_AUDIT_CSV_EXPORT_MAX_ROWS = 10_000;

type AdminAuditFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
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


async function authenticateAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeAdminAuditDeps,
  now: () => number,
): Promise<AuthenticatedAdminUser | null> {
  return authenticateFastifyAdmin(request, reply, {
    deleteAdminSession: deps.deleteAdminSession,
    getAdminSessionByToken: deps.getAdminSessionByToken,
    getAdminUserById: deps.getAdminUserById,
    updateAdminSessionLastAccess: deps.updateAdminSessionLastAccess,
    hashSessionToken: deps.hashSessionToken,
    now,
  });
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
  const allowedOrigins = new Set(getAllowedOrigins());

  app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply, allowedOrigins);
  });

  app.addHook("onRequest", async (request) => {
    (request as AdminAuditFastifyRequest)[REQUEST_TIMER_KEY] =
      createRuntimeTimer();

    return undefined;
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
  app.options("/export.csv", optionsHandler);

  app.addHook("onResponse", async (request, reply) => {
    const timer =
      (request as AdminAuditFastifyRequest)[REQUEST_TIMER_KEY] ??
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
