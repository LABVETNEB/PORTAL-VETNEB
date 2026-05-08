import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { ENV } from "../lib/env.ts";
import { shouldRefreshSessionLastAccess } from "../lib/session-last-access.ts";
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

async function authenticateAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeAdminSessionsDeps,
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
    sessionId: session.id,
    sessionToken: token,
  };
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