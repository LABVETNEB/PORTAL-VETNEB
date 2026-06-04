import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { ParticularToken, Report } from "../../drizzle/schema.ts";

import { ENV } from "../lib/env.ts";
import {
  buildLoginRateLimitResponse,
  buildLoginRateLimitHeaders,
  buildLoginRateLimitKey,
  buildMissingCredentialsLoginRateLimitKey,
  getLoginRateLimitKeyMetadata,
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  LOGIN_RATE_LIMIT_WINDOW_MS,
} from "../lib/login-rate-limit.ts";
import {
  createMemoryRateLimitStore,
  createPersistentRateLimitStore,
  getOrCreateRateLimitEntry,
  incrementRateLimitEntry,
  type RateLimitEntry,
  type RateLimitStore,
} from "../lib/rate-limit-store.ts";
import { serializeParticularTokenDetail } from "../lib/particular-token.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";
import { shouldRefreshSessionLastAccess } from "../lib/session-last-access.ts";

type ParticularSessionRecord = {
  particularTokenId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type ParticularTokenAuthRecord = {
  id: number;
  clinicId: number;
  reportId: number | null;
  isActive: boolean;
};

type AuthenticatedParticularUser = {
  tokenId: number;
  clinicId: number;
  reportId: number | null;
  sessionToken: string;
};

type LoginFailedAttemptReason =
  | "missing_credentials"
  | "invalid_credentials"
  | "rate_limited";

type RecordLoginFailedAttemptInput = {
  surface: "particular";
  username?: string | null;
  reason: LoginFailedAttemptReason;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
};

export type ParticularAuthNativeRoutesOptions = {
  createParticularSession?: (input: {
    particularTokenId: number;
    tokenHash: string;
    lastAccess: Date;
    expiresAt: Date;
  }) => Promise<unknown>;
  deleteParticularSession?: (tokenHash: string) => Promise<void>;
  getParticularSessionByToken?: (
    tokenHash: string,
  ) => Promise<ParticularSessionRecord | null>;
  getParticularTokenById?: (
    id: number,
  ) => Promise<ParticularToken | ParticularTokenAuthRecord | null>;
  getParticularTokenByTokenHash?: (
    tokenHash: string,
  ) => Promise<(ParticularToken & { isActive: boolean }) | null>;
  updateParticularSessionLastAccess?: (tokenHash: string) => Promise<void>;
  updateParticularTokenLastLogin?: (tokenId: number) => Promise<void>;
  getReportById?: (reportId: number) => Promise<Report | null>;
  createSignedReportUrl?: (storagePath: string) => Promise<string>;
  createSignedReportDownloadUrl?: (
    storagePath: string,
    fileName?: string,
  ) => Promise<string>;
  generateSessionToken?: () => string;
  hashSessionToken?: (token: string) => string;
  recordLoginFailedAttempt?: (
    input: RecordLoginFailedAttemptInput,
  ) => Promise<unknown>;
  loginRateLimitWindowMs?: number;
  loginRateLimitMaxAttempts?: number;
  loginRateLimitStore?: RateLimitStore;
  now?: () => number;
};

const REQUEST_TIMER_KEY = "__particularAuthRequestTimer";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type ParticularAuthFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
};

type NativeParticularAuthDeps = Required<
  Pick<
    ParticularAuthNativeRoutesOptions,
    | "createParticularSession"
    | "deleteParticularSession"
    | "getParticularSessionByToken"
    | "getParticularTokenById"
    | "getParticularTokenByTokenHash"
    | "updateParticularSessionLastAccess"
    | "updateParticularTokenLastLogin"
    | "getReportById"
    | "createSignedReportUrl"
    | "createSignedReportDownloadUrl"
    | "generateSessionToken"
    | "hashSessionToken"
    | "recordLoginFailedAttempt"
  >
>;

type NativeParticularAuthDefaultDeps = NativeParticularAuthDeps & {
  loginRateLimitStore: RateLimitStore;
};

let defaultDepsPromise: Promise<NativeParticularAuthDefaultDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeParticularAuthDefaultDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const dbParticular = await import("../db-particular.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const supabase = await import("../lib/supabase.ts");

      return {
        createParticularSession: dbParticular.createParticularSession,
        deleteParticularSession: dbParticular.deleteParticularSession,
        getParticularSessionByToken: dbParticular.getParticularSessionByToken,
        getParticularTokenById: dbParticular.getParticularTokenById,
        getParticularTokenByTokenHash:
          dbParticular.getParticularTokenByTokenHash,
        updateParticularSessionLastAccess:
          dbParticular.updateParticularSessionLastAccess,
        updateParticularTokenLastLogin:
          dbParticular.updateParticularTokenLastLogin,
        getReportById: db.getReportById,
        createSignedReportUrl: supabase.createSignedReportUrl,
        createSignedReportDownloadUrl:
          supabase.createSignedReportDownloadUrl,
        generateSessionToken: authSecurity.generateSessionToken,
        hashSessionToken: authSecurity.hashSessionToken,
        recordLoginFailedAttempt: db.recordLoginFailedAttempt,
        loginRateLimitStore: createPersistentRateLimitStore(
          {
            get: db.getLoginRateLimitEntry,
            set: db.setLoginRateLimitEntry,
            increment: db.incrementLoginRateLimitEntry,
            cleanupExpired: db.deleteExpiredLoginRateLimitEntries,
            delete: db.deleteLoginRateLimitEntry,
          },
          {
            metadataForKey: getLoginRateLimitKeyMetadata,
          },
        ),
      };
    })();
  }

  return defaultDepsPromise;
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
    "RateLimit-Policy, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After",
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

function getParticularSessionToken(request: FastifyRequest) {
  const cookieHeader =
    typeof request.headers.cookie === "string"
      ? request.headers.cookie
      : undefined;

  const cookies = parseCookies(cookieHeader);
  const raw = cookies[ENV.particularCookieName];

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

function buildParticularSessionCookie(token: string) {
  return serializeCookie({
    name: ENV.particularCookieName,
    value: token,
    maxAgeSeconds: ENV.sessionTtlHours * 60 * 60,
  });
}

function buildClearParticularSessionCookie() {
  return serializeCookie({
    name: ENV.particularCookieName,
    value: "",
    maxAgeSeconds: 0,
    expires: "Thu, 01 Jan 1970 00:00:00 GMT",
  });
}

function setLoginRateLimitHeaders(
  reply: FastifyReply,
  input: {
    max: number;
    windowMs: number;
    failedCount: number;
    resetAt: number;
    now: number;
    includeRetryAfter?: boolean;
  },
) {
  for (const [headerName, headerValue] of Object.entries(
    buildLoginRateLimitHeaders(input),
  )) {
    reply.header(headerName, headerValue);
  }
}

function getUserAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];

  return typeof value === "string" && value.trim() ? value : null;
}

async function buildParticularResponse(
  deps: NativeParticularAuthDeps,
  tokenId: number,
) {
  const particularToken = await deps.getParticularTokenById(tokenId);

  if (!particularToken) {
    return null;
  }

  const report =
    typeof particularToken.reportId === "number"
      ? await deps.getReportById(particularToken.reportId)
      : null;

  return serializeParticularTokenDetail(
    particularToken as ParticularToken,
    report,
  );
}

async function authenticateParticularUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeParticularAuthDeps,
  now: () => number,
): Promise<AuthenticatedParticularUser | null> {
  const token = getParticularSessionToken(request);

  if (!token) {
    reply.code(401).send({
      success: false,
      error: "Particular no autenticado",
    });
    return null;
  }

  const tokenHash = deps.hashSessionToken(token);
  const session = await deps.getParticularSessionByToken(tokenHash);

  if (!session) {
    reply.code(401).send({
      success: false,
      error: "Sesión particular inválida",
    });
    return null;
  }

  if (session.expiresAt && session.expiresAt.getTime() <= now()) {
    await deps.deleteParticularSession(tokenHash);

    reply.header("set-cookie", buildClearParticularSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Sesión particular expirada",
    });
    return null;
  }

  const particularToken = await deps.getParticularTokenById(
    session.particularTokenId,
  );

  if (!particularToken || !particularToken.isActive) {
    await deps.deleteParticularSession(tokenHash);

    reply.header("set-cookie", buildClearParticularSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Token particular inválido o inactivo",
    });
    return null;
  }

  if (shouldRefreshSessionLastAccess(session.lastAccess ?? null, now())) {
    await deps.updateParticularSessionLastAccess(tokenHash);
  }

  return {
    tokenId: particularToken.id,
    clinicId: particularToken.clinicId,
    reportId: particularToken.reportId ?? null,
    sessionToken: token,
  };
}

export const particularAuthNativeRoutes: FastifyPluginAsync<
  ParticularAuthNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.createParticularSession &&
    !!options.deleteParticularSession &&
    !!options.getParticularSessionByToken &&
    !!options.getParticularTokenById &&
    !!options.getParticularTokenByTokenHash &&
    !!options.updateParticularSessionLastAccess &&
    !!options.updateParticularTokenLastLogin &&
    !!options.getReportById &&
    !!options.createSignedReportUrl &&
    !!options.createSignedReportDownloadUrl &&
    !!options.generateSessionToken &&
    !!options.hashSessionToken;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeParticularAuthDeps = {
    createParticularSession:
      options.createParticularSession ?? defaultDeps!.createParticularSession,
    deleteParticularSession:
      options.deleteParticularSession ?? defaultDeps!.deleteParticularSession,
    getParticularSessionByToken:
      options.getParticularSessionByToken ??
      defaultDeps!.getParticularSessionByToken,
    getParticularTokenById:
      options.getParticularTokenById ?? defaultDeps!.getParticularTokenById,
    getParticularTokenByTokenHash:
      options.getParticularTokenByTokenHash ??
      defaultDeps!.getParticularTokenByTokenHash,
    updateParticularSessionLastAccess:
      options.updateParticularSessionLastAccess ??
      defaultDeps!.updateParticularSessionLastAccess,
    updateParticularTokenLastLogin:
      options.updateParticularTokenLastLogin ??
      defaultDeps!.updateParticularTokenLastLogin,
    getReportById: options.getReportById ?? defaultDeps!.getReportById,
    createSignedReportUrl:
      options.createSignedReportUrl ?? defaultDeps!.createSignedReportUrl,
    createSignedReportDownloadUrl:
      options.createSignedReportDownloadUrl ??
      defaultDeps!.createSignedReportDownloadUrl,
    generateSessionToken:
      options.generateSessionToken ?? defaultDeps!.generateSessionToken,
    hashSessionToken:
      options.hashSessionToken ?? defaultDeps!.hashSessionToken,
    recordLoginFailedAttempt:
      options.recordLoginFailedAttempt ??
      defaultDeps?.recordLoginFailedAttempt ??
      (async () => undefined),
  };

  const now = options.now ?? (() => Date.now());
  const loginRateLimitWindowMs =
    options.loginRateLimitWindowMs ?? LOGIN_RATE_LIMIT_WINDOW_MS;
  const loginRateLimitMaxAttempts =
    options.loginRateLimitMaxAttempts ?? LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
  const allowedOrigins = new Set(getAllowedOrigins());
  const loginRateLimitStore =
    options.loginRateLimitStore ??
    defaultDeps?.loginRateLimitStore ??
    createMemoryRateLimitStore();

  app.addHook("onRequest", async (request, reply) => {
    (request as ParticularAuthFastifyRequest)[REQUEST_TIMER_KEY] =
      createRuntimeTimer();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const timer =
      (request as ParticularAuthFastifyRequest)[REQUEST_TIMER_KEY] ??
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
    reply.header("access-control-allow-methods", "GET,POST,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/login", optionsHandler);
  app.options("/me", optionsHandler);
  app.options("/logout", optionsHandler);
  app.options("/report/preview-url", optionsHandler);
  app.options("/report/download-url", optionsHandler);

  app.post<{
    Body: {
      token?: unknown;
    };
  }>("/login", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const currentTime = now();

    // Leer token antes de la clave para poder aislar por identifier
    const providedToken =
      typeof request.body?.token === "string" ? request.body.token.trim() : "";

    const recordFailedLoginAttempt = async (input: {
      reason: LoginFailedAttemptReason;
    }) => {
      try {
        await deps.recordLoginFailedAttempt({
          surface: "particular",
          username: null,
          reason: input.reason,
          ipAddress: request.ip || null,
          userAgent: getUserAgent(request),
          createdAt: new Date(currentTime),
        });
      } catch (error) {
        request.log.warn(
          {
            err: error,
            code: "PARTICULAR_LOGIN_FAILED_ATTEMPT_RECORD_FAILED",
            surface: "particular",
            reason: input.reason,
          },
          "No se pudo persistir intento fallido de login particular",
        );
      }
    };

    const markMissingCredentials = async () => {
      const missingRateLimitKey = buildMissingCredentialsLoginRateLimitKey({
        surface: "particular",
        ipAddress: request.ip || null,
      });

      try {
        const missingEntry = await getOrCreateRateLimitEntry(
          loginRateLimitStore,
          missingRateLimitKey,
          loginRateLimitWindowMs,
          currentTime,
        );
        const updatedMissingEntry = await incrementRateLimitEntry(
          loginRateLimitStore,
          missingRateLimitKey,
          missingEntry,
          currentTime,
        );

        setLoginRateLimitHeaders(reply, {
          max: loginRateLimitMaxAttempts,
          windowMs: loginRateLimitWindowMs,
          failedCount: updatedMissingEntry.count,
          resetAt: updatedMissingEntry.resetAt,
          now: currentTime,
        });
      } catch (error) {
        request.log.error(
          {
            err: error,
            code: "PARTICULAR_LOGIN_MISSING_CREDENTIALS_RATE_LIMIT_FAILED",
            route: "/api/particular/auth/login",
          },
          "No se pudo actualizar el rate limit de token faltante particular",
        );
      }

      await recordFailedLoginAttempt({
        reason: "missing_credentials",
      });
    };

    if (!providedToken) {
      await markMissingCredentials();

      return reply.code(400).send({
        success: false,
        error: "Token obligatorio",
      });
    }

    const rateLimitKey = buildLoginRateLimitKey({
      surface: "particular",
      identifier: providedToken,
      ipAddress: request.ip || null,
    });

    const failureEntry: RateLimitEntry = {
      count: 0,
      resetAt: currentTime + loginRateLimitWindowMs,
    };
    let canUseRateLimitStore = true;

    try {
      const existingEntry = await getOrCreateRateLimitEntry(
        loginRateLimitStore,
        rateLimitKey,
        loginRateLimitWindowMs,
        currentTime,
      );

      failureEntry.count = existingEntry.count;
      failureEntry.resetAt = existingEntry.resetAt;
    } catch (error) {
      canUseRateLimitStore = false;
      request.log.error(
        {
          err: error,
          code: "PARTICULAR_LOGIN_RATE_LIMIT_GET_FAILED",
          route: "/api/particular/auth/login",
        },
        "No se pudo leer el rate limit de login particular",
      );
    }

    if (canUseRateLimitStore && failureEntry.count >= loginRateLimitMaxAttempts) {
      setLoginRateLimitHeaders(reply, {
        max: loginRateLimitMaxAttempts,
        windowMs: loginRateLimitWindowMs,
        failedCount: failureEntry.count,
        resetAt: failureEntry.resetAt,
        now: currentTime,
        includeRetryAfter: true,
      });

      await recordFailedLoginAttempt({
        reason: "rate_limited",
      });

      return reply.code(429).send(
        buildLoginRateLimitResponse({
          resetAt: failureEntry.resetAt,
          now: currentTime,
        }),
      );
    }

    const markFailure = async (input: {
      reason: LoginFailedAttemptReason;
    }) => {
      if (canUseRateLimitStore) {
        try {
          const updatedEntry = await incrementRateLimitEntry(
            loginRateLimitStore,
            rateLimitKey,
            failureEntry,
            currentTime,
          );

          failureEntry.count = updatedEntry.count;
          failureEntry.resetAt = updatedEntry.resetAt;

          setLoginRateLimitHeaders(reply, {
            max: loginRateLimitMaxAttempts,
            windowMs: loginRateLimitWindowMs,
            failedCount: failureEntry.count,
            resetAt: failureEntry.resetAt,
            now: currentTime,
          });
        } catch (error) {
          canUseRateLimitStore = false;
          request.log.error(
            {
              err: error,
              code: "PARTICULAR_LOGIN_RATE_LIMIT_INCREMENT_FAILED",
              route: "/api/particular/auth/login",
            },
            "No se pudo actualizar el rate limit de login particular",
          );
        }
      }

      await recordFailedLoginAttempt(input);
    };

    const markSuccess = async () => {
      if (!canUseRateLimitStore) {
        return;
      }

      if (loginRateLimitStore.delete) {
        try {
          await loginRateLimitStore.delete(rateLimitKey);
        } catch (error) {
          request.log.warn(
            {
              err: error,
              code: "PARTICULAR_LOGIN_RATE_LIMIT_RESET_FAILED",
              route: "/api/particular/auth/login",
            },
            "No se pudo limpiar el rate limit de login particular tras login exitoso",
          );
        }
      }

      setLoginRateLimitHeaders(reply, {
        max: loginRateLimitMaxAttempts,
        windowMs: loginRateLimitWindowMs,
        failedCount: 0,
        resetAt: currentTime + loginRateLimitWindowMs,
        now: currentTime,
      });
    };

    const tokenHash = deps.hashSessionToken(providedToken);
    const particularToken = await deps.getParticularTokenByTokenHash(tokenHash);

    if (!particularToken || !particularToken.isActive) {
      await markFailure({
        reason: "invalid_credentials",
      });

      return reply.code(401).send({
        success: false,
        error: "Token inválido",
      });
    }

    const sessionToken = deps.generateSessionToken();
    const sessionTokenHash = deps.hashSessionToken(sessionToken);
    const expiresAt = new Date(
      currentTime + ENV.sessionTtlHours * 60 * 60 * 1000,
    );

    await deps.createParticularSession({
      particularTokenId: particularToken.id,
      tokenHash: sessionTokenHash,
      lastAccess: new Date(currentTime),
      expiresAt,
    });

    await deps.updateParticularTokenLastLogin(particularToken.id);

    reply.header("set-cookie", buildParticularSessionCookie(sessionToken));
    await markSuccess();

    return reply.code(200).send({
      success: true,
      particular: await buildParticularResponse(deps, particularToken.id),
    });
  });

  app.get("/me", async (request, reply) => {
    const particular = await authenticateParticularUser(request, reply, deps, now);

    if (!particular) {
      return reply;
    }

    const response = await buildParticularResponse(deps, particular.tokenId);

    if (!response) {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    return reply.code(200).send({
      success: true,
      particular: response,
    });
  });

  app.post("/logout", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const particular = await authenticateParticularUser(
      request,
      reply,
      deps,
      now,
    );

    if (!particular) {
      return reply;
    }

    const tokenHash = deps.hashSessionToken(particular.sessionToken);
    await deps.deleteParticularSession(tokenHash);

    reply.header("set-cookie", buildClearParticularSessionCookie());

    return reply.code(200).send({
      success: true,
      message: "Sesión particular cerrada correctamente",
    });
  });

  app.get("/report/preview-url", async (request, reply) => {
    const particular = await authenticateParticularUser(
      request,
      reply,
      deps,
      now,
    );

    if (!particular) {
      return reply;
    }

    const reportId = particular.reportId;

    if (typeof reportId !== "number") {
      return reply.code(409).send({
        success: false,
        error: "El token particular no tiene un informe vinculado",
      });
    }

    const report = await deps.getReportById(reportId);

    if (!report || report.clinicId !== particular.clinicId) {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
      });
    }

    const previewUrl = await deps.createSignedReportUrl(report.storagePath);

    return reply.code(200).send({
      success: true,
      previewUrl,
    });
  });

  app.get("/report/download-url", async (request, reply) => {
    const particular = await authenticateParticularUser(
      request,
      reply,
      deps,
      now,
    );

    if (!particular) {
      return reply;
    }

    const reportId = particular.reportId;

    if (typeof reportId !== "number") {
      return reply.code(409).send({
        success: false,
        error: "El token particular no tiene un informe vinculado",
      });
    }

    const report = await deps.getReportById(reportId);

    if (!report || report.clinicId !== particular.clinicId) {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
      });
    }

    const downloadUrl = await deps.createSignedReportDownloadUrl(
      report.storagePath,
      report.fileName ?? undefined,
    );

    return reply.code(200).send({
      success: true,
      downloadUrl,
    });
  });
};
