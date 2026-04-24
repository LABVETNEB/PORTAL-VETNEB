import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type { Report, ReportAccessToken } from "../../drizzle/schema";
import { AUDIT_EVENTS } from "../lib/audit.ts";
import { ENV } from "../lib/env.ts";
import {
  REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_ERROR_MESSAGE,
  REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_MAX_ATTEMPTS,
  REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_WINDOW_MS,
} from "../lib/report-access-token-rate-limit.ts";
import {
  buildPublicReportAccessPath,
  buildValidationError,
  clinicCreateReportAccessTokenSchema,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeReportAccessToken,
  serializeReportAccessTokenDetail,
} from "../lib/report-access-token.ts";
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

type VerifyPasswordResult = {
  valid: boolean;
  needsRehash: boolean;
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
  targetReportAccessTokenId?: number | null;
  metadata?: Record<string, unknown>;
  actor?: {
    type: string;
    clinicUserId?: number | null;
  };
};

export type ReportAccessTokensNativeRoutesOptions = {
  createActiveSession?: (input: {
    clinicUserId: number;
    tokenHash: string;
    expiresAt: Date;
  }) => Promise<void>;
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<ActiveSessionRecord | null>;
  getClinicUserById?: (
    clinicUserId: number,
  ) => Promise<ClinicUserRecord | null>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  generateSessionToken?: () => string;
  hashPassword?: (password: string) => Promise<string>;
  hashSessionToken?: (token: string) => string;
  verifyPassword?: (
    password: string,
    passwordHash: string,
  ) => Promise<VerifyPasswordResult>;
  getReportById?: (reportId: number) => Promise<Report | null>;
  createReportAccessToken?: (input: {
    clinicId: number;
    reportId: number;
    tokenHash: string;
    tokenLast4: string;
    expiresAt: Date | null;
    createdByClinicUserId: number | null;
    createdByAdminUserId: number | null;
    revokedByClinicUserId: number | null;
    revokedByAdminUserId: number | null;
  }) => Promise<ReportAccessToken>;
  getClinicScopedReportAccessToken?: (
    tokenId: number,
    clinicId: number,
  ) => Promise<ReportAccessToken | null | undefined>;
  listReportAccessTokens?: (params: {
    clinicId: number;
    reportId?: number;
    limit: number;
    offset: number;
  }) => Promise<ReportAccessToken[]>;
  revokeReportAccessToken?: (input: {
    id: number;
    revokedByClinicUserId?: number | null;
    revokedByAdminUserId?: number | null;
  }) => Promise<ReportAccessToken | null | undefined>;
  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;
  mutationRateLimitWindowMs?: number;
  mutationRateLimitMaxAttempts?: number;
  now?: () => number;
};

const REQUEST_START_TIME_KEY = "__reportAccessTokensRequestStartTimeNs";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

type ReportAccessTokensFastifyRequest = FastifyRequest & {
  [REQUEST_START_TIME_KEY]?: bigint;
};

type NativeReportAccessTokensDeps = Required<
  Pick<
    ReportAccessTokensNativeRoutesOptions,
    | "deleteActiveSession"
    | "getActiveSessionByToken"
    | "getClinicUserById"
    | "updateSessionLastAccess"
    | "generateSessionToken"
    | "hashPassword"
    | "hashSessionToken"
    | "verifyPassword"
    | "getReportById"
    | "createReportAccessToken"
    | "getClinicScopedReportAccessToken"
    | "listReportAccessTokens"
    | "revokeReportAccessToken"
    | "writeAuditLog"
  >
>;

let defaultDepsPromise: Promise<NativeReportAccessTokensDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeReportAccessTokensDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const dbReportAccess = await import("../db-report-access.ts");
      const audit = await import("../lib/audit.ts");

      return {
        createActiveSession: db.createActiveSession,
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        updateSessionLastAccess: db.updateSessionLastAccess,
        generateSessionToken: authSecurity.generateSessionToken,
        hashPassword: authSecurity.hashPassword,
        hashSessionToken: authSecurity.hashSessionToken,
        verifyPassword: authSecurity.verifyPassword,
        getReportById: db.getReportById,
        createReportAccessToken: dbReportAccess.createReportAccessToken,
        getClinicScopedReportAccessToken:
          dbReportAccess.getClinicScopedReportAccessToken,
        listReportAccessTokens: dbReportAccess.listReportAccessTokens,
        revokeReportAccessToken: dbReportAccess.revokeReportAccessToken,
        writeAuditLog: audit.writeAuditLog as (
          req: unknown,
          input: AuditWriteInput,
        ) => Promise<void>,
      };
    })();
  }

  return defaultDepsPromise!;
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
  reply.header(
    "access-control-expose-headers",
    "RateLimit-Policy, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset",
  );
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

function setMutationRateLimitHeaders(
  reply: FastifyReply,
  input: {
    max: number;
    windowMs: number;
    count: number;
    resetAt: number;
    now: number;
  },
) {
  reply.header(
    "RateLimit-Policy",
    `${input.max};w=${Math.ceil(input.windowMs / 1000)}`,
  );
  reply.header("RateLimit-Limit", String(input.max));
  reply.header(
    "RateLimit-Remaining",
    String(Math.max(input.max - input.count, 0)),
  );
  reply.header(
    "RateLimit-Reset",
    String(Math.max(Math.ceil((input.resetAt - input.now) / 1000), 0)),
  );
}

function getMutationEntry(
  attempts: Map<string, { count: number; resetAt: number }>,
  key: string,
  windowMs: number,
  now: number,
) {
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    const fresh = {
      count: 0,
      resetAt: now + windowMs,
    };
    attempts.set(key, fresh);
    return fresh;
  }

  return current;
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
  auth?: Pick<
    AuthenticatedClinicUser,
    "id" | "clinicId" | "username" | "role" | "canManageClinicUsers" | "canUploadReports"
  >,
) {
  return {
    method: request.method,
    originalUrl: request.url,
    ip: request.ip,
    headers: request.headers,
    auth: auth
      ? {
          id: auth.id,
          clinicId: auth.clinicId,
          username: auth.username,
          role: auth.role,
          canManageClinicUsers: auth.canManageClinicUsers,
          canUploadReports: auth.canUploadReports,
        }
      : undefined,
  };
}

async function authenticateClinicUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeReportAccessTokensDeps,
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

function requireReportAccessTokenManagementPermission(
  auth: AuthenticatedClinicUser,
  reply: FastifyReply,
) {
  if (auth.canManageClinicUsers) {
    return true;
  }

  reply.code(403).send({
    success: false,
    error: "No autorizado para administrar tokens públicos de informes",
  });

  return false;
}

export const reportAccessTokensNativeRoutes: FastifyPluginAsync<
  ReportAccessTokensNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.updateSessionLastAccess &&
    !!options.generateSessionToken &&
    !!options.hashPassword &&
    !!options.hashSessionToken &&
    !!options.verifyPassword &&
    !!options.getReportById &&
    !!options.createReportAccessToken &&
    !!options.getClinicScopedReportAccessToken &&
    !!options.listReportAccessTokens &&
    !!options.revokeReportAccessToken &&
    !!options.writeAuditLog;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeReportAccessTokensDeps = {
    deleteActiveSession:
      options.deleteActiveSession ?? defaultDeps!.deleteActiveSession,
    getActiveSessionByToken:
      options.getActiveSessionByToken ?? defaultDeps!.getActiveSessionByToken,
    getClinicUserById:
      options.getClinicUserById ?? defaultDeps!.getClinicUserById,
    updateSessionLastAccess:
      options.updateSessionLastAccess ?? defaultDeps!.updateSessionLastAccess,
    generateSessionToken:
      options.generateSessionToken ?? defaultDeps!.generateSessionToken,
    hashPassword: options.hashPassword ?? defaultDeps!.hashPassword,
    hashSessionToken:
      options.hashSessionToken ?? defaultDeps!.hashSessionToken,
    verifyPassword: options.verifyPassword ?? defaultDeps!.verifyPassword,
    getReportById: options.getReportById ?? defaultDeps!.getReportById,
    createReportAccessToken:
      options.createReportAccessToken ?? defaultDeps!.createReportAccessToken,
    getClinicScopedReportAccessToken:
      options.getClinicScopedReportAccessToken ??
      defaultDeps!.getClinicScopedReportAccessToken,
    listReportAccessTokens:
      options.listReportAccessTokens ?? defaultDeps!.listReportAccessTokens,
    revokeReportAccessToken:
      options.revokeReportAccessToken ?? defaultDeps!.revokeReportAccessToken,
    writeAuditLog: options.writeAuditLog ?? defaultDeps!.writeAuditLog,
  };

  const now = options.now ?? (() => Date.now());
  const mutationRateLimitWindowMs =
    options.mutationRateLimitWindowMs ??
    REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_WINDOW_MS;
  const mutationRateLimitMaxAttempts =
    options.mutationRateLimitMaxAttempts ??
    REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_MAX_ATTEMPTS;
  const allowedOrigins = new Set(getAllowedOrigins());
  const mutationAttempts = new Map<string, { count: number; resetAt: number }>();

  app.addHook("onRequest", async (request, reply) => {
    (request as ReportAccessTokensFastifyRequest)[REQUEST_START_TIME_KEY] =
      process.hrtime.bigint();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt =
      (request as ReportAccessTokensFastifyRequest)[REQUEST_START_TIME_KEY] ??
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
    reply.header("access-control-allow-methods", "GET,POST,PATCH,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/", optionsHandler);
  app.options("/:tokenId", optionsHandler);
  app.options("/:tokenId/revoke", optionsHandler);

  const applyMutationRateLimit = (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const rateLimitKey = request.ip || "unknown";
    const currentTime = now();
    const entry = getMutationEntry(
      mutationAttempts,
      rateLimitKey,
      mutationRateLimitWindowMs,
      currentTime,
    );

    if (entry.count >= mutationRateLimitMaxAttempts) {
      setMutationRateLimitHeaders(reply, {
        max: mutationRateLimitMaxAttempts,
        windowMs: mutationRateLimitWindowMs,
        count: entry.count,
        resetAt: entry.resetAt,
        now: currentTime,
      });

      reply.code(429).send({
        success: false,
        error: REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_ERROR_MESSAGE,
      });

      return null;
    }

    entry.count += 1;

    setMutationRateLimitHeaders(reply, {
      max: mutationRateLimitMaxAttempts,
      windowMs: mutationRateLimitWindowMs,
      count: entry.count,
      resetAt: entry.resetAt,
      now: currentTime,
    });

    return entry;
  };

  app.post<{
    Body: {
      reportId?: unknown;
      expiresAt?: unknown;
    };
  }>("/", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    if (!applyMutationRateLimit(request, reply)) {
      return reply;
    }

    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    if (!requireReportAccessTokenManagementPermission(auth, reply)) {
      return reply;
    }

    const parsed = clinicCreateReportAccessTokenSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: buildValidationError(parsed.error),
      });
    }

    const report = await deps.getReportById(parsed.data.reportId);

    if (!report || report.clinicId !== auth.clinicId) {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado para la clínica autenticada",
      });
    }

    const rawToken = deps.generateSessionToken();
    const tokenHash = deps.hashSessionToken(rawToken);

    const reportAccessToken = await deps.createReportAccessToken({
      clinicId: auth.clinicId,
      reportId: report.id,
      tokenHash,
      tokenLast4: rawToken.slice(-4),
      expiresAt: parsed.data.expiresAt ?? null,
      createdByClinicUserId: auth.id,
      createdByAdminUserId: null,
      revokedByClinicUserId: null,
      revokedByAdminUserId: null,
    });

    await deps.writeAuditLog(createAuditRequestLike(request, auth), {
      event: AUDIT_EVENTS.REPORT_ACCESS_TOKEN_CREATED,
      clinicId: reportAccessToken.clinicId,
      reportId: reportAccessToken.reportId,
      targetReportAccessTokenId: reportAccessToken.id,
      metadata: {
        tokenLast4: reportAccessToken.tokenLast4,
        expiresAt: reportAccessToken.expiresAt,
        createdVia: "clinic",
      },
    });

    return reply.code(201).send({
      success: true,
      message: "Token público de informe creado correctamente",
      token: rawToken,
      publicAccessPath: buildPublicReportAccessPath(rawToken),
      reportAccessToken: serializeReportAccessToken(reportAccessToken),
    });
  });

  app.get<{
    Querystring: {
      reportId?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
  }>("/", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const reportId = parseEntityId(request.query.reportId);
    const limit = parsePositiveInt(request.query.limit, 50, 100);
    const offset = parseOffset(request.query.offset, 0);

    const tokens = await deps.listReportAccessTokens({
      clinicId: auth.clinicId,
      reportId,
      limit,
      offset,
    });

    return reply.code(200).send({
      success: true,
      count: tokens.length,
      reportAccessTokens: tokens.map((token) => serializeReportAccessToken(token)),
      pagination: {
        limit,
        offset,
      },
      filters: {
        reportId: reportId ?? null,
      },
    });
  });

  app.get<{
    Params: {
      tokenId: string;
    };
  }>("/:tokenId", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const tokenId = parseEntityId(request.params.tokenId);

    if (typeof tokenId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de token inválido",
      });
    }

    const token = await deps.getClinicScopedReportAccessToken(
      tokenId,
      auth.clinicId,
    );

    if (!token) {
      return reply.code(404).send({
        success: false,
        error: "Token público de informe no encontrado",
      });
    }

    const report = await deps.getReportById(token.reportId);

    return reply.code(200).send({
      success: true,
      reportAccessToken: serializeReportAccessTokenDetail(token, report),
    });
  });

  app.patch<{
    Params: {
      tokenId: string;
    };
  }>("/:tokenId/revoke", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    if (!applyMutationRateLimit(request, reply)) {
      return reply;
    }

    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    if (!requireReportAccessTokenManagementPermission(auth, reply)) {
      return reply;
    }

    const tokenId = parseEntityId(request.params.tokenId);

    if (typeof tokenId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de token inválido",
      });
    }

    const existing = await deps.getClinicScopedReportAccessToken(
      tokenId,
      auth.clinicId,
    );

    if (!existing) {
      return reply.code(404).send({
        success: false,
        error: "Token público de informe no encontrado",
      });
    }

    const revoked = await deps.revokeReportAccessToken({
      id: tokenId,
      revokedByClinicUserId: auth.id,
      revokedByAdminUserId: null,
    });

    const report = revoked ? await deps.getReportById(revoked.reportId) : null;

    if (revoked) {
      await deps.writeAuditLog(createAuditRequestLike(request, auth), {
        event: AUDIT_EVENTS.REPORT_ACCESS_TOKEN_REVOKED,
        clinicId: revoked.clinicId,
        reportId: revoked.reportId,
        targetReportAccessTokenId: revoked.id,
        metadata: {
          tokenLast4: revoked.tokenLast4,
          revokedAt: revoked.revokedAt,
          revokedVia: "clinic",
        },
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Token público de informe revocado correctamente",
      reportAccessToken: revoked
        ? serializeReportAccessTokenDetail(revoked, report)
        : null,
    });
  });
};

