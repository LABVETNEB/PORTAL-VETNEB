import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { AUDIT_EVENTS } from "../lib/audit.ts";
import { ENV } from "../lib/env.ts";
import {
  authenticateFastifyAdmin,
  clearRequestAdminAuthContext,
} from "../lib/fastify-admin-auth.ts";
import {
  buildLoginRateLimitResponse,
  buildLoginRateLimitHeaders,
  buildLoginRateLimitKey,
  buildMissingCredentialsLoginRateLimitKey,
  getLoginRateLimitKeyMetadata,
  LOGIN_RATE_LIMIT_EXPOSED_HEADERS,
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
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";

type VerifyPasswordResult = {
  valid: boolean;
  needsRehash: boolean;
};

type AdminUserRecord = {
  id: number;
  username: string;
  passwordHash: string;
};

type SessionAdminUserRecord = {
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

type AuditWriteInput = {
  event: string;
  targetAdminUserId?: number | null;
  metadata?: Record<string, unknown>;
  actor?: {
    type: string;
    adminUserId?: number | null;
  };
};

type LoginFailedAttemptReason =
  | "missing_credentials"
  | "invalid_credentials"
  | "rate_limited";

type RecordLoginFailedAttemptInput = {
  surface: "admin";
  username?: string | null;
  reason: LoginFailedAttemptReason;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
};

export type AdminAuthNativeRoutesOptions = {
  createAdminSession?: (input: {
    adminUserId: number;
    tokenHash: string;
    expiresAt: Date;
  }) => Promise<unknown>;
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken?: (
    tokenHash: string,
  ) => Promise<AdminSessionRecord | null>;
  getAdminUserById?: (
    adminUserId: number,
  ) => Promise<SessionAdminUserRecord | null>;
  getAdminUserByUsername?: (
    username: string,
  ) => Promise<AdminUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  generateSessionToken?: () => string;
  hashSessionToken?: (token: string) => string;
  verifyPassword?: (
    password: string,
    passwordHash: string,
  ) => Promise<VerifyPasswordResult>;
  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;
  recordLoginFailedAttempt?: (
    input: RecordLoginFailedAttemptInput,
  ) => Promise<unknown>;
  loginRateLimitWindowMs?: number;
  loginRateLimitMaxAttempts?: number;
  loginRateLimitStore?: RateLimitStore;
  now?: () => number;
};

const REQUEST_TIMER_KEY = "__adminAuthRequestTimer";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type AdminAuthFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
};

type NativeAdminAuthDeps = Required<
  Pick<
    AdminAuthNativeRoutesOptions,
    | "createAdminSession"
    | "deleteAdminSession"
    | "getAdminSessionByToken"
    | "getAdminUserById"
    | "getAdminUserByUsername"
    | "updateAdminSessionLastAccess"
    | "generateSessionToken"
    | "hashSessionToken"
    | "verifyPassword"
    | "writeAuditLog"
    | "recordLoginFailedAttempt"
  >
>;

type NativeAdminAuthDefaultDeps = NativeAdminAuthDeps & {
  loginRateLimitStore: RateLimitStore;
};

let defaultDepsPromise: Promise<NativeAdminAuthDefaultDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeAdminAuthDefaultDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const audit = await import("../lib/audit.ts");

      return {
        createAdminSession: db.createAdminSession,
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        getAdminUserByUsername: db.getAdminUserByUsername,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        generateSessionToken: authSecurity.generateSessionToken,
        hashSessionToken: authSecurity.hashSessionToken,
        verifyPassword: authSecurity.verifyPassword,
        writeAuditLog: audit.writeAuditLog as (
          req: unknown,
          input: AuditWriteInput,
        ) => Promise<void>,
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
    LOGIN_RATE_LIMIT_EXPOSED_HEADERS,
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

function buildAdminSessionCookie(token: string) {
  return serializeCookie({
    name: ENV.adminCookieName,
    value: token,
    maxAgeSeconds: ENV.sessionTtlHours * 60 * 60,
  });
}

function buildClearAdminSessionCookie() {
  return serializeCookie({
    name: ENV.adminCookieName,
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
  deps: NativeAdminAuthDeps,
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

export const adminAuthNativeRoutes: FastifyPluginAsync<
  AdminAuthNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.createAdminSession &&
    !!options.deleteAdminSession &&
    !!options.getAdminSessionByToken &&
    !!options.getAdminUserById &&
    !!options.getAdminUserByUsername &&
    !!options.updateAdminSessionLastAccess &&
    !!options.generateSessionToken &&
    !!options.hashSessionToken &&
    !!options.verifyPassword &&
    !!options.writeAuditLog;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeAdminAuthDeps = {
    createAdminSession:
      options.createAdminSession ?? defaultDeps!.createAdminSession,
    deleteAdminSession:
      options.deleteAdminSession ?? defaultDeps!.deleteAdminSession,
    getAdminSessionByToken:
      options.getAdminSessionByToken ?? defaultDeps!.getAdminSessionByToken,
    getAdminUserById:
      options.getAdminUserById ?? defaultDeps!.getAdminUserById,
    getAdminUserByUsername:
      options.getAdminUserByUsername ?? defaultDeps!.getAdminUserByUsername,
    updateAdminSessionLastAccess:
      options.updateAdminSessionLastAccess ??
      defaultDeps!.updateAdminSessionLastAccess,
    generateSessionToken:
      options.generateSessionToken ?? defaultDeps!.generateSessionToken,
    hashSessionToken:
      options.hashSessionToken ?? defaultDeps!.hashSessionToken,
    verifyPassword: options.verifyPassword ?? defaultDeps!.verifyPassword,
    writeAuditLog: options.writeAuditLog ?? defaultDeps!.writeAuditLog,
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
    (request as AdminAuthFastifyRequest)[REQUEST_TIMER_KEY] =
      createRuntimeTimer();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const timer =
      (request as AdminAuthFastifyRequest)[REQUEST_TIMER_KEY] ??
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

  app.post<{
    Body: {
      username?: unknown;
      password?: unknown;
    };
  }>("/login", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const currentTime = now();

    const username =
      typeof request.body?.username === "string"
        ? request.body.username.trim()
        : "";
    const password =
      typeof request.body?.password === "string" ? request.body.password : "";

    const recordFailedLoginAttempt = async (input: {
      username?: string | null;
      reason: LoginFailedAttemptReason;
    }) => {
      try {
        await deps.recordLoginFailedAttempt({
          surface: "admin",
          username: input.username?.trim() || null,
          reason: input.reason,
          ipAddress: request.ip || null,
          userAgent: getUserAgent(request),
          createdAt: new Date(currentTime),
        });
      } catch (error) {
        request.log.warn(
          {
            err: error,
            code: "ADMIN_LOGIN_FAILED_ATTEMPT_RECORD_FAILED",
            surface: "admin",
            reason: input.reason,
          },
          "No se pudo persistir intento fallido de login admin",
        );
      }
    };

    const markMissingCredentials = async () => {
      const missingRateLimitKey = buildMissingCredentialsLoginRateLimitKey({
        surface: "admin",
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
            code: "ADMIN_LOGIN_MISSING_CREDENTIALS_RATE_LIMIT_FAILED",
            route: "/api/admin/auth/login",
          },
          "No se pudo actualizar el rate limit de credenciales faltantes admin",
        );
      }

      await recordFailedLoginAttempt({
        username: null,
        reason: "missing_credentials",
      });
    };

    if (!username || !password) {
      await markMissingCredentials();

      return reply.code(400).send({
        success: false,
        error: "Usuario y contraseña requeridos",
      });
    }

    const rateLimitKey = buildLoginRateLimitKey({
      surface: "admin",
      identifier: username,
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
          code: "ADMIN_LOGIN_RATE_LIMIT_GET_FAILED",
          route: "/api/admin/auth/login",
        },
        "No se pudo leer el rate limit de login admin",
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
        username,
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
      username?: string | null;
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
              code: "ADMIN_LOGIN_RATE_LIMIT_INCREMENT_FAILED",
              route: "/api/admin/auth/login",
            },
            "No se pudo actualizar el rate limit de login admin",
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
              code: "ADMIN_LOGIN_RATE_LIMIT_RESET_FAILED",
              route: "/api/admin/auth/login",
            },
            "No se pudo limpiar el rate limit de login admin tras login exitoso",
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

    const admin = await deps.getAdminUserByUsername(username);

    if (!admin) {
      await markFailure({
        username,
        reason: "invalid_credentials",
      });

      return reply.code(401).send({
        success: false,
        error: "Credenciales inválidas",
      });
    }

    const valid = await deps.verifyPassword(password, admin.passwordHash);

    if (!valid.valid) {
      await markFailure({
        username,
        reason: "invalid_credentials",
      });

      return reply.code(401).send({
        success: false,
        error: "Credenciales inválidas",
      });
    }

    const token = deps.generateSessionToken();
    const tokenHash = deps.hashSessionToken(token);
    const expiresAt = new Date(
      currentTime + ENV.sessionTtlHours * 60 * 60 * 1000,
    );

    await deps.createAdminSession({
      adminUserId: admin.id,
      tokenHash,
      expiresAt,
    });

    await deps.writeAuditLog(createAuditRequestLike(request), {
      event: AUDIT_EVENTS.ADMIN_LOGIN_SUCCEEDED,
      targetAdminUserId: admin.id,
      metadata: {
        username: admin.username,
        sessionExpiresAt: expiresAt,
      },
      actor: {
        type: "admin_user",
        adminUserId: admin.id,
      },
    });

    reply.header("set-cookie", buildAdminSessionCookie(token));
    await markSuccess();

    return reply.code(200).send({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
      },
    });
  });

  app.get("/me", async (request, reply) => {
    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    return reply.code(200).send({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
      },
    });
  });

  app.post("/logout", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const tokenHash = deps.hashSessionToken(admin.sessionToken);
    await deps.deleteAdminSession(tokenHash);
    clearRequestAdminAuthContext(request);

    reply.header("set-cookie", buildClearAdminSessionCookie());

    return reply.code(200).send({
      success: true,
      message: "Sesión admin cerrada correctamente",
    });
  });
};
