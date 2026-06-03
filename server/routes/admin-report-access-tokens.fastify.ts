import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type { Report, ReportAccessToken } from "../../drizzle/schema.ts";
import { AUDIT_EVENTS } from "../lib/audit.ts";
import { ENV } from "../lib/env.ts";
import { authenticateFastifyAdmin } from "../lib/fastify-admin-auth.ts";
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
  adminCreateReportAccessTokenSchema,
  buildPublicReportAccessPath,
  buildValidationError,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeReportAccessToken,
  serializeReportAccessTokenDetail,
} from "../lib/report-access-token.ts";
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

type ClinicRecord = {
  id: number;
};

type AuthenticatedAdminUser = {
  id: number;
  username: string;
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
    adminUserId?: number | null;
  };
};

export type AdminReportAccessTokensNativeRoutesOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken?: (
    tokenHash: string,
  ) => Promise<AdminSessionRecord | null>;
  getAdminUserById?: (
    adminUserId: number,
  ) => Promise<AdminUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  generateSessionToken?: () => string;
  hashSessionToken?: (token: string) => string;
  getClinicById?: (clinicId: number) => Promise<ClinicRecord | null>;
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
  getReportAccessTokenById?: (
    tokenId: number,
  ) => Promise<ReportAccessToken | null | undefined>;
  listReportAccessTokens?: (params: {
    clinicId?: number;
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

const REQUEST_TIMER_KEY = "__adminReportAccessTokensRequestTimer";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type AdminReportAccessTokensFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
};

type NativeAdminReportAccessTokensDeps = Required<
  Pick<
    AdminReportAccessTokensNativeRoutesOptions,
    | "deleteAdminSession"
    | "getAdminSessionByToken"
    | "getAdminUserById"
    | "updateAdminSessionLastAccess"
    | "generateSessionToken"
    | "hashSessionToken"
    | "getClinicById"
    | "getReportById"
    | "createReportAccessToken"
    | "getReportAccessTokenById"
    | "listReportAccessTokens"
    | "revokeReportAccessToken"
    | "writeAuditLog"
  >
>;

let defaultDepsPromise: Promise<NativeAdminReportAccessTokensDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeAdminReportAccessTokensDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const dbReportAccess = await import("../db-report-access.ts");
      const audit = await import("../lib/audit.ts");

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        generateSessionToken: authSecurity.generateSessionToken,
        hashSessionToken: authSecurity.hashSessionToken,
        getClinicById: db.getClinicById,
        getReportById: db.getReportById,
        createReportAccessToken: dbReportAccess.createReportAccessToken,
        getReportAccessTokenById: dbReportAccess.getReportAccessTokenById,
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
  admin?: Pick<AuthenticatedAdminUser, "id" | "username">,
) {
  return {
    method: request.method,
    originalUrl: request.url,
    ip: request.ip,
    headers: request.headers,
    adminAuth: admin
      ? {
          id: admin.id,
          username: admin.username,
        }
      : undefined,
  };
}

async function authenticateAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeAdminReportAccessTokensDeps,
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

export const adminReportAccessTokensNativeRoutes: FastifyPluginAsync<
  AdminReportAccessTokensNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.deleteAdminSession &&
    !!options.getAdminSessionByToken &&
    !!options.getAdminUserById &&
    !!options.updateAdminSessionLastAccess &&
    !!options.generateSessionToken &&
    !!options.hashSessionToken &&
    !!options.getClinicById &&
    !!options.getReportById &&
    !!options.createReportAccessToken &&
    !!options.getReportAccessTokenById &&
    !!options.listReportAccessTokens &&
    !!options.revokeReportAccessToken &&
    !!options.writeAuditLog;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeAdminReportAccessTokensDeps = {
    deleteAdminSession:
      options.deleteAdminSession ?? defaultDeps!.deleteAdminSession,
    getAdminSessionByToken:
      options.getAdminSessionByToken ?? defaultDeps!.getAdminSessionByToken,
    getAdminUserById:
      options.getAdminUserById ?? defaultDeps!.getAdminUserById,
    updateAdminSessionLastAccess:
      options.updateAdminSessionLastAccess ??
      defaultDeps!.updateAdminSessionLastAccess,
    generateSessionToken:
      options.generateSessionToken ?? defaultDeps!.generateSessionToken,
    hashSessionToken:
      options.hashSessionToken ?? defaultDeps!.hashSessionToken,
    getClinicById: options.getClinicById ?? defaultDeps!.getClinicById,
    getReportById: options.getReportById ?? defaultDeps!.getReportById,
    createReportAccessToken:
      options.createReportAccessToken ?? defaultDeps!.createReportAccessToken,
    getReportAccessTokenById:
      options.getReportAccessTokenById ??
      defaultDeps!.getReportAccessTokenById,
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
  const mutationRateLimitStore =
    options.mutationRateLimitStore ?? createMemoryRateLimitStore();

  app.addHook("onRequest", async (request, reply) => {
    (request as AdminReportAccessTokensFastifyRequest)[REQUEST_TIMER_KEY] =
      createRuntimeTimer();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const timer =
      (request as AdminReportAccessTokensFastifyRequest)[REQUEST_TIMER_KEY] ??
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
      clinicId?: unknown;
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

    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const parsed = adminCreateReportAccessTokenSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: buildValidationError(parsed.error),
      });
    }

    const clinic = await deps.getClinicById(parsed.data.clinicId);

    if (!clinic) {
      return reply.code(404).send({
        success: false,
        error: "Clínica no encontrada",
      });
    }

    const report = await deps.getReportById(parsed.data.reportId);

    if (!report) {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
      });
    }

    if (report.clinicId !== parsed.data.clinicId) {
      return reply.code(400).send({
        success: false,
        error: "El informe no pertenece a la clínica indicada",
      });
    }

    const rawToken = deps.generateSessionToken();
    const tokenHash = deps.hashSessionToken(rawToken);

    const reportAccessToken = await deps.createReportAccessToken({
      clinicId: parsed.data.clinicId,
      reportId: report.id,
      tokenHash,
      tokenLast4: rawToken.slice(-4),
      expiresAt: parsed.data.expiresAt ?? null,
      createdByClinicUserId: null,
      createdByAdminUserId: admin.id,
      revokedByClinicUserId: null,
      revokedByAdminUserId: null,
    });

    await deps.writeAuditLog(createAuditRequestLike(request, admin), {
      event: AUDIT_EVENTS.REPORT_ACCESS_TOKEN_CREATED,
      clinicId: reportAccessToken.clinicId,
      reportId: reportAccessToken.reportId,
      targetReportAccessTokenId: reportAccessToken.id,
      metadata: {
        tokenLast4: reportAccessToken.tokenLast4,
        expiresAt: reportAccessToken.expiresAt,
        createdVia: "admin",
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
      clinicId?: unknown;
      reportId?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
  }>("/", async (request, reply) => {
    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const clinicId = parseEntityId(request.query.clinicId);
    const reportId = parseEntityId(request.query.reportId);
    const limit = parsePositiveInt(request.query.limit, 50, 100);
    const offset = parseOffset(request.query.offset, 0);

    const tokens = await deps.listReportAccessTokens({
      clinicId,
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
        clinicId: clinicId ?? null,
        reportId: reportId ?? null,
      },
    });
  });

  app.get<{
    Params: {
      tokenId: string;
    };
  }>("/:tokenId", async (request, reply) => {
    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const tokenId = parseEntityId(request.params.tokenId);

    if (typeof tokenId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de token inválido",
      });
    }

    const token = await deps.getReportAccessTokenById(tokenId);

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

    if (!(await applyMutationRateLimit(request, reply))) {
      return reply;
    }

    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const tokenId = parseEntityId(request.params.tokenId);

    if (typeof tokenId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de token inválido",
      });
    }

    const existing = await deps.getReportAccessTokenById(tokenId);

    if (!existing) {
      return reply.code(404).send({
        success: false,
        error: "Token público de informe no encontrado",
      });
    }

    const revoked = await deps.revokeReportAccessToken({
      id: tokenId,
      revokedByClinicUserId: null,
      revokedByAdminUserId: admin.id,
    });

    const report = revoked ? await deps.getReportById(revoked.reportId) : null;

    if (revoked) {
      await deps.writeAuditLog(createAuditRequestLike(request, admin), {
        event: AUDIT_EVENTS.REPORT_ACCESS_TOKEN_REVOKED,
        clinicId: revoked.clinicId,
        reportId: revoked.reportId,
        targetReportAccessTokenId: revoked.id,
        metadata: {
          tokenLast4: revoked.tokenLast4,
          revokedAt: revoked.revokedAt,
          revokedVia: "admin",
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
