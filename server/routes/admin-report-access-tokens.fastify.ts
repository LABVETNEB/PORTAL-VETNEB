import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type { Report, ReportAccessToken } from "../../drizzle/schema.ts";
import { createAdminReportAccessOperations } from "../features/report-access/application/index.ts";
import { loadReportAccessRepository } from "../features/report-access/composition/report-access-route-composition.ts";
import { ENV } from "../lib/env.ts";
import {
  getAllowedOrigins,
  getAllowedOriginForCors,
  getRequestOrigin,
  enforceTrustedOrigin,
} from "../lib/cors-headers.ts";
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
      const reportCommands = await import(
        "../features/reports/composition/index.ts"
      );
      const reportAccessRepository = await loadReportAccessRepository();
      const audit = await import("../lib/audit.ts");

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        generateSessionToken: authSecurity.generateSessionToken,
        hashSessionToken: authSecurity.hashSessionToken,
        getClinicById: db.getClinicById,
        getReportById: reportCommands.getReportById,
        createReportAccessToken:
          reportAccessRepository.createReportAccessToken,
        getReportAccessTokenById:
          reportAccessRepository.getReportAccessTokenById,
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
  const reportAccess = createAdminReportAccessOperations(deps);
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

    const result = await reportAccess.createToken(
      {
        clinicId: parsed.data.clinicId,
        reportId: parsed.data.reportId,
        expiresAt: parsed.data.expiresAt ?? null,
      },
      admin,
      createAuditRequestLike(request, admin),
    );

    if (result.kind === "clinic_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Clínica no encontrada",
      });
    }
    if (result.kind === "report_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
      });
    }
    if (result.kind === "report_wrong_clinic") {
      return reply.code(400).send({
        success: false,
        error: "El informe no pertenece a la clínica indicada",
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

    const tokens = await reportAccess.listTokens({
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

    const result = await reportAccess.getToken(tokenId);

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

    const result = await reportAccess.revokeToken(
      tokenId,
      admin,
      createAuditRequestLike(request, admin),
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
