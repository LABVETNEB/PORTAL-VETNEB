import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { AUDIT_EVENTS } from "../lib/audit.ts";
import { ENV } from "../lib/env.ts";
import {
  LOGIN_RATE_LIMIT_ERROR_MESSAGE,
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  LOGIN_RATE_LIMIT_WINDOW_MS,
} from "../lib/login-rate-limit.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";

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
  loginRateLimitWindowMs?: number;
  loginRateLimitMaxAttempts?: number;
  now?: () => number;
};

const REQUEST_START_TIME_KEY = "__adminAuthRequestStartTimeNs";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

type AdminAuthFastifyRequest = FastifyRequest & {
  [REQUEST_START_TIME_KEY]?: bigint;
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
  >
>;

let defaultDepsPromise: Promise<NativeAdminAuthDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeAdminAuthDeps> {
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
  },
) {
  reply.header(
    "RateLimit-Policy",
    `${input.max};w=${Math.ceil(input.windowMs / 1000)}`,
  );
  reply.header("RateLimit-Limit", String(input.max));
  reply.header(
    "RateLimit-Remaining",
    String(Math.max(input.max - input.failedCount, 0)),
  );
  reply.header(
    "RateLimit-Reset",
    String(Math.max(Math.ceil((input.resetAt - input.now) / 1000), 0)),
  );
}

function getFailureEntry(
  failures: Map<string, { count: number; resetAt: number }>,
  key: string,
  windowMs: number,
  now: number,
) {
  const current = failures.get(key);

  if (!current || current.resetAt <= now) {
    const fresh = {
      count: 0,
      resetAt: now + windowMs,
    };
    failures.set(key, fresh);
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
  };

  const now = options.now ?? (() => Date.now());
  const loginRateLimitWindowMs =
    options.loginRateLimitWindowMs ?? LOGIN_RATE_LIMIT_WINDOW_MS;
  const loginRateLimitMaxAttempts =
    options.loginRateLimitMaxAttempts ?? LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
  const allowedOrigins = new Set(getAllowedOrigins());
  const loginFailures = new Map<string, { count: number; resetAt: number }>();

  app.addHook("onRequest", async (request, reply) => {
    (request as AdminAuthFastifyRequest)[REQUEST_START_TIME_KEY] =
      process.hrtime.bigint();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt =
      (request as AdminAuthFastifyRequest)[REQUEST_START_TIME_KEY] ??
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

    const rateLimitKey = request.ip || "unknown";
    const currentTime = now();
    const failureEntry = getFailureEntry(
      loginFailures,
      rateLimitKey,
      loginRateLimitWindowMs,
      currentTime,
    );

    if (failureEntry.count >= loginRateLimitMaxAttempts) {
      setLoginRateLimitHeaders(reply, {
        max: loginRateLimitMaxAttempts,
        windowMs: loginRateLimitWindowMs,
        failedCount: failureEntry.count,
        resetAt: failureEntry.resetAt,
        now: currentTime,
      });

      return reply.code(429).send({
        success: false,
        error: LOGIN_RATE_LIMIT_ERROR_MESSAGE,
      });
    }

    const markFailure = () => {
      failureEntry.count += 1;

      setLoginRateLimitHeaders(reply, {
        max: loginRateLimitMaxAttempts,
        windowMs: loginRateLimitWindowMs,
        failedCount: failureEntry.count,
        resetAt: failureEntry.resetAt,
        now: currentTime,
      });
    };

    const markSuccess = () => {
      setLoginRateLimitHeaders(reply, {
        max: loginRateLimitMaxAttempts,
        windowMs: loginRateLimitWindowMs,
        failedCount: failureEntry.count,
        resetAt: failureEntry.resetAt,
        now: currentTime,
      });
    };

    const username =
      typeof request.body?.username === "string"
        ? request.body.username.trim()
        : "";
    const password =
      typeof request.body?.password === "string" ? request.body.password : "";

    if (!username || !password) {
      markFailure();

      return reply.code(400).send({
        success: false,
        error: "Usuario y contraseña requeridos",
      });
    }

    const admin = await deps.getAdminUserByUsername(username);

    if (!admin) {
      markFailure();

      return reply.code(401).send({
        success: false,
        error: "Credenciales inválidas",
      });
    }

    const valid = await deps.verifyPassword(password, admin.passwordHash);

    if (!valid.valid) {
      markFailure();

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
    markSuccess();

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

    reply.header("set-cookie", buildClearAdminSessionCookie());

    return reply.code(200).send({
      success: true,
      message: "Sesión admin cerrada correctamente",
    });
  });
};
