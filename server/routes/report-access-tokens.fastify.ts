import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type { Report, ReportAccessToken } from "../../drizzle/schema.ts";
import { createClinicReportAccessOperations } from "../features/report-access/application/index.ts";
import { loadReportAccessRepository } from "../features/report-access/composition/report-access-route-composition.ts";
import { ENV } from "../lib/env.ts";
import {
  enforceTrustedOrigin,
  getAllowedOrigins,
  getAllowedOriginForCors,
  getRequestOrigin,
} from "../lib/cors-headers.ts";
import {
  REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_ERROR_MESSAGE,
  REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_MAX_ATTEMPTS,
  REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_WINDOW_MS,
} from "../lib/report-access-token-rate-limit.ts";
import {
  createMemoryRateLimitStore,
  getOrCreateRateLimitEntry,
  incrementRateLimitEntry,
  type RateLimitStore,
} from "../lib/rate-limit-store.ts";
import {
  buildPublicReportAccessPath,
  buildValidationError,
  clinicCreateReportAccessTokenSchema,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeReportAccessToken,
  serializeReportAccessTokenDetail,
} from "../features/report-access/index.ts";
import {
  getClinicPermissions,
  normalizeClinicUserRole,
} from "../lib/permissions.ts";
import { logRequestCompletion } from "../middlewares/request-logger.ts";
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
  getClinicScopedReportById?: (
    reportId: number,
    clinicId: number,
  ) => Promise<Report | null | undefined>;
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
  mutationRateLimitStore?: RateLimitStore;
  now?: () => number;
};

const REQUEST_TIMER_KEY = "__reportAccessTokensRequestTimer";

type ReportAccessTokensFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
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
    | "getClinicScopedReportById"
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
      const reportCommands = await import(
        "../features/reports/composition/index.ts"
      );
      const reportAccessRepository = await loadReportAccessRepository();
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
        getClinicScopedReportById:
          reportCommands.getClinicScopedReportById,
        createReportAccessToken:
          reportAccessRepository.createReportAccessToken,
        getClinicScopedReportAccessToken:
          reportAccessRepository.getClinicScopedReportAccessToken,
        listReportAccessTokens:
          reportAccessRepository.listReportAccessTokens,
        revokeReportAccessToken:
          reportAccessRepository.revokeReportAccessToken,
        writeAuditLog: audit.writeAuditLog as (
          req: unknown,
          input: AuditWriteInput,
        ) => Promise<void>,
      };
    })();
  }

  return defaultDepsPromise!;
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
    (!!options.getClinicScopedReportById || !!options.getReportById) &&
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
    getClinicScopedReportById:
      options.getClinicScopedReportById ??
      (options.getReportById
        ? async (reportId: number, clinicId: number) => {
            const report = await options.getReportById!(reportId);
            return report?.clinicId === clinicId ? report : null;
          }
        : defaultDeps!.getClinicScopedReportById),
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
  const reportAccess = createClinicReportAccessOperations(deps);
  const mutationRateLimitWindowMs =
    options.mutationRateLimitWindowMs ??
    REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_WINDOW_MS;
  const mutationRateLimitMaxAttempts =
    options.mutationRateLimitMaxAttempts ??
    REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_MAX_ATTEMPTS;
  const allowedOrigins = new Set(getAllowedOrigins());
  const mutationRateLimitStore =
    options.mutationRateLimitStore ?? createMemoryRateLimitStore();

  app.addHook("onRequest", async (request, reply) => {
    (request as ReportAccessTokensFastifyRequest)[REQUEST_TIMER_KEY] =
      createRuntimeTimer();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const timer =
      (request as ReportAccessTokensFastifyRequest)[REQUEST_TIMER_KEY] ??
      createRuntimeTimer();

    const durationMs = timer.elapsedMs();

    logRequestCompletion({
      method: request.method,
      routeTemplate: request.routeOptions?.url,
      statusCode: reply.statusCode,
      durationMs,
      requestId: request.id,
    });
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

  const applyMutationRateLimit = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const rateLimitKey = request.ip || "unknown";
    const currentTime = now();
    const entry = await getOrCreateRateLimitEntry(
      mutationRateLimitStore,
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

    const updatedEntry = await incrementRateLimitEntry(
      mutationRateLimitStore,
      rateLimitKey,
      entry,
    );

    entry.count = updatedEntry.count;
    entry.resetAt = updatedEntry.resetAt;

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

    if (!(await applyMutationRateLimit(request, reply))) {
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

    const result = await reportAccess.createToken(
      {
        reportId: parsed.data.reportId,
        expiresAt: parsed.data.expiresAt ?? null,
      },
      { clinicId: auth.clinicId, clinicUserId: auth.id },
      createAuditRequestLike(request, auth),
    );

    if (result.kind === "report_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
      });
    }

    return reply.code(201).send({
      success: true,
      message: "Token público de informe creado correctamente",
      token: result.rawToken,
      publicAccessPath: buildPublicReportAccessPath(result.rawToken),
      reportAccessToken: serializeReportAccessToken(result.token),
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

    const tokens = await reportAccess.listTokens(
      auth.clinicId,
      reportId,
      limit,
      offset,
    );

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

    const result = await reportAccess.getToken(
      tokenId,
      auth.clinicId,
    );

    if (result.kind === "not_found") {
      return reply.code(404).send({
        success: false,
        error: "Token público de informe no encontrado",
      });
    }

    return reply.code(200).send({
      success: true,
      reportAccessToken: serializeReportAccessTokenDetail(
        result.token,
        result.report,
      ),
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

    if (!(await applyMutationRateLimit(request, reply))) {
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

    const result = await reportAccess.revokeToken(
      tokenId,
      { clinicId: auth.clinicId, clinicUserId: auth.id },
      createAuditRequestLike(request, auth),
    );

    if (result.kind === "not_found") {
      return reply.code(404).send({
        success: false,
        error: "Token público de informe no encontrado",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Token público de informe revocado correctamente",
      reportAccessToken: result.token
        ? serializeReportAccessTokenDetail(result.token, result.report)
        : null,
    });
  });
};
