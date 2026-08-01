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
  enforceTrustedOrigin,
} from "../lib/cors-headers.ts";
import { authenticateFastifyAdmin } from "../lib/fastify-admin-auth.ts";
import { logError, serializeError } from "../lib/logger.ts";
import type {
  AdminSessionsQuery,
  AdminSessionsSnapshot,
  AdminSessionRevocationResult,
  AdminSessionStatus,
  AdminSessionType,
} from "../db-admin-sessions.ts";

type AdminSessionRecord = {
  id: number;
  adminUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type SessionAdminUserRecord = {
  id: number;
  username: string;
};

type AuthenticatedAdminUser = {
  id: number;
  username: string;
  sessionId: number;
  sessionToken: string;
};

type AdminSessionsRequestQuery = {
  sessionType?: string;
  status?: string;
  limit?: string;
  offset?: string;
};

type AdminSessionRevokeParams = {
  sessionType?: string;
  sessionId?: string;
};

type CreateSessionAuditLogInput = {
  event: "auth.session.revoked";
  actorType: "admin_user";
  actorAdminUserId: number;
  targetAdminUserId?: number | null;
  targetClinicUserId?: number | null;
  requestMethod?: string | null;
  requestPath?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  action?: string | null;
  entity?: string | null;
  entityId?: number | null;
};

export type AdminSessionsNativeRoutesOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken?: (
    tokenHash: string,
  ) => Promise<AdminSessionRecord | null>;
  getAdminUserById?: (
    adminUserId: number,
  ) => Promise<SessionAdminUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  getAdminSessionsSnapshot?: (
    params: AdminSessionsQuery,
    now: Date,
  ) => Promise<AdminSessionsSnapshot>;
  revokeAdminSessionById?: (
    target: { sessionType: AdminSessionType; sessionId: number },
    now: Date,
  ) => Promise<AdminSessionRevocationResult | null>;
  createAuditLog?: (input: CreateSessionAuditLogInput) => Promise<unknown>;
  now?: () => number;
};

type NativeAdminSessionsDeps = Required<
  Pick<
    AdminSessionsNativeRoutesOptions,
    | "deleteAdminSession"
    | "getAdminSessionByToken"
    | "getAdminUserById"
    | "updateAdminSessionLastAccess"
    | "hashSessionToken"
    | "getAdminSessionsSnapshot"
    | "revokeAdminSessionById"
    | "createAuditLog"
  >
>;

let defaultDepsPromise: Promise<NativeAdminSessionsDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeAdminSessionsDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const adminSessions = await import("../db-admin-sessions.ts");
      const audit = await import("../db-audit.ts");

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        getAdminSessionsSnapshot: adminSessions.getAdminSessionsSnapshot,
        revokeAdminSessionById: adminSessions.revokeAdminSessionById,
        createAuditLog: audit.createAuditLog,
      };
    })();
  }

  return defaultDepsPromise;
}

async function authenticateAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeAdminSessionsDeps,
  now: () => number,
): Promise<AuthenticatedAdminUser | null> {
  const admin = await authenticateFastifyAdmin(request, reply, {
    deleteAdminSession: deps.deleteAdminSession,
    getAdminSessionByToken: deps.getAdminSessionByToken,
    getAdminUserById: deps.getAdminUserById,
    updateAdminSessionLastAccess: deps.updateAdminSessionLastAccess,
    hashSessionToken: deps.hashSessionToken,
    now,
  });

  return admin
    ? {
        id: admin.id,
        username: admin.username,
        sessionId: admin.sessionId!,
        sessionToken: admin.sessionToken,
      }
    : null;
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

function parseSessionType(
  value: string | undefined,
): AdminSessionType | undefined | null {
  if (value === undefined) return undefined;

  if (value === "admin" || value === "clinic" || value === "particular") {
    return value;
  }

  return null;
}

function parseSessionStatus(
  value: string | undefined,
): AdminSessionStatus | undefined | null {
  if (value === undefined) return undefined;

  if (value === "active" || value === "expired") {
    return value;
  }

  return null;
}

function parseIntegerParam(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  return Math.min(Math.max(parsed, min), max);
}

function parseSessionId(value: string | undefined) {
  if (value === undefined || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function getRequestUserAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];

  return typeof value === "string" ? value : null;
}
function parseSessionsQuery(
  query: AdminSessionsRequestQuery,
): AdminSessionsQuery | null {
  const sessionType = parseSessionType(query.sessionType);
  const status = parseSessionStatus(query.status);
  const limit = parseIntegerParam(query.limit, 50, 1, 100);
  const offset = parseIntegerParam(query.offset, 0, 0, 100_000);

  if (
    sessionType === null ||
    status === null ||
    limit === null ||
    offset === null
  ) {
    return null;
  }

  return {
    ...(sessionType ? { sessionType } : {}),
    ...(status ? { status } : {}),
    limit,
    offset,
  };
}

export const adminSessionsNativeRoutes: FastifyPluginAsync<
  AdminSessionsNativeRoutesOptions
> = async (app, options) => {
  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(getAllowedOrigins());

  async function resolveDeps(): Promise<NativeAdminSessionsDeps> {
    const hasAllInjectedDeps =
      !!options.deleteAdminSession &&
      !!options.getAdminSessionByToken &&
      !!options.getAdminUserById &&
      !!options.updateAdminSessionLastAccess &&
      !!options.hashSessionToken &&
      !!options.getAdminSessionsSnapshot &&
      !!options.revokeAdminSessionById &&
      !!options.createAuditLog;

    const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

    return {
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
      getAdminSessionsSnapshot:
        options.getAdminSessionsSnapshot ??
        defaultDeps!.getAdminSessionsSnapshot,
      revokeAdminSessionById:
        options.revokeAdminSessionById ?? defaultDeps!.revokeAdminSessionById,
      createAuditLog: options.createAuditLog ?? defaultDeps!.createAuditLog,
    };
  }

  app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply, allowedOrigins);
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
    reply.header("access-control-allow-methods", "GET,POST,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/", optionsHandler);
  app.options("/:sessionType/:sessionId/revoke", optionsHandler);

  app.get<{ Querystring: AdminSessionsRequestQuery }>(
    "/",
    async (request, reply) => {
      const deps = await resolveDeps();
      const admin = await authenticateAdminUser(request, reply, deps, now);

      if (!admin) {
        return reply;
      }

      const params = parseSessionsQuery(request.query);

      if (!params) {
        return reply.code(400).send({
          success: false,
          error:
            "Query inválida. sessionType debe ser admin, clinic o particular; status debe ser active o expired; limit/offset deben ser enteros válidos.",
        });
      }

      const snapshot = await deps.getAdminSessionsSnapshot(
        params,
        new Date(now()),
      );

      return reply.code(200).send({
        ...snapshot,
        currentAdminSessionId: admin.sessionId,
        checkedBy: {
          adminUserId: admin.id,
          username: admin.username,
        },
      });
    },
  );

  app.post<{ Params: AdminSessionRevokeParams }>(
    "/:sessionType/:sessionId/revoke",
    async (request, reply) => {
      if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
        return reply;
      }

      const deps = await resolveDeps();
      const admin = await authenticateAdminUser(request, reply, deps, now);

      if (!admin) {
        return reply;
      }

      const sessionType = parseSessionType(request.params.sessionType);
      const sessionId = parseSessionId(request.params.sessionId);

      if (!sessionType || sessionId === null) {
        return reply.code(400).send({
          success: false,
          error:
            "Parámetros inválidos. sessionType debe ser admin, clinic o particular; sessionId debe ser entero positivo.",
        });
      }

      if (sessionType === "admin" && sessionId === admin.sessionId) {
        return reply.code(400).send({
          success: false,
          error: "No se puede revocar la sesión admin actual.",
        });
      }

      const revokedSession = await deps.revokeAdminSessionById(
        { sessionType, sessionId },
        new Date(now()),
      );

      if (!revokedSession) {
        return reply.code(404).send({
          success: false,
          error: "Sesión no encontrada",
        });
      }

      try {
        await deps.createAuditLog({
          event: "auth.session.revoked",
          actorType: "admin_user",
          actorAdminUserId: admin.id,
          targetAdminUserId:
            revokedSession.actorType === "admin_user"
              ? revokedSession.actorId
              : null,
          targetClinicUserId:
            revokedSession.actorType === "clinic_user"
              ? revokedSession.actorId
              : null,
          requestMethod: request.method,
          requestPath: request.url,
          ipAddress: request.ip,
          userAgent: getRequestUserAgent(request),
          metadata: {
            sessionType: revokedSession.sessionType,
            sessionId: revokedSession.sessionId,
            actorType: revokedSession.actorType,
            actorId: revokedSession.actorId,
            statusAtRevocation: revokedSession.status,
            createdAt: revokedSession.createdAt,
            lastAccess: revokedSession.lastAccess,
            expiresAt: revokedSession.expiresAt,
            revokedAt: revokedSession.revokedAt,
          },
          action: "auth.session.revoked",
          entity: "session",
          entityId: revokedSession.sessionId,
        });
      } catch (error) {
        logError("ADMIN_SESSION_REVOKE_AUDIT_WRITE_ERROR", {
          requestId: request.id,
          event: "auth.session.revoked",
          error: serializeError(error),
        });
      }

      return reply.code(200).send({
        success: true,
        revokedSession,
        revokedBy: {
          adminUserId: admin.id,
          username: admin.username,
        },
      });
    },
  );
};
