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
  getClinicPermissions,
  normalizeClinicUserRole,
} from "../lib/permissions.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";

type VerifyPasswordResult = {
  valid: boolean;
  needsRehash: boolean;
};

type ClinicUserRecord = {
  id: number;
  clinicId: number;
  username: string;
  passwordHash: string;
  authProId?: string | null;
  role: unknown;
};

type SessionClinicUserRecord = {
  id: number;
  clinicId: number;
  username: string;
  authProId?: string | null;
  role: unknown;
};

type ActiveSessionRecord = {
  clinicUserId: number;
  expiresAt: Date | null;
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
  targetClinicUserId?: number | null;
  metadata?: Record<string, unknown>;
  actor?: {
    type: string;
    clinicUserId?: number | null;
  };
};

export type AuthNativeRoutesOptions = {
  createActiveSession?: (input: {
    clinicUserId: number;
    tokenHash: string;
    expiresAt: Date;
  }) => Promise<unknown>;
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<ActiveSessionRecord | null>;
  getClinicUserById?: (
    clinicUserId: number,
  ) => Promise<SessionClinicUserRecord | null>;
  getClinicUserByUsername?: (
    username: string,
  ) => Promise<ClinicUserRecord | null>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  upsertClinicUser?: (input: {
    clinicId: number;
    username: string;
    passwordHash: string;
    authProId: string | null;
    role: ReturnType<typeof normalizeClinicUserRole>;
  }) => Promise<unknown>;
  generateSessionToken?: () => string;
  hashPassword?: (password: string) => Promise<string>;
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

const REQUEST_START_TIME_KEY = "__clinicAuthRequestStartTimeNs";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type AuthFastifyRequest = FastifyRequest & {
  [REQUEST_START_TIME_KEY]?: bigint;
};

type NativeAuthDeps = Required<
  Pick<
    AuthNativeRoutesOptions,
    | "createActiveSession"
    | "deleteActiveSession"
    | "getActiveSessionByToken"
    | "getClinicUserById"
    | "getClinicUserByUsername"
    | "updateSessionLastAccess"
    | "upsertClinicUser"
    | "generateSessionToken"
    | "hashPassword"
    | "hashSessionToken"
    | "verifyPassword"
    | "writeAuditLog"
  >
>;

let defaultDepsPromise: Promise<NativeAuthDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeAuthDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const audit = await import("../lib/audit.ts");

      return {
        createActiveSession: db.createActiveSession,
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        getClinicUserByUsername: db.getClinicUserByUsername,
        updateSessionLastAccess: db.updateSessionLastAccess,
        upsertClinicUser: db.upsertClinicUser,
        generateSessionToken: authSecurity.generateSessionToken,
        hashPassword: authSecurity.hashPassword,
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

function getSessionToken(request: FastifyRequest) {
  const cookieHeader =
    typeof request.headers.cookie === "string" ? request.headers.cookie : undefined;

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

function buildSessionCookie(token: string) {
  return serializeCookie({
    name: ENV.cookieName,
    value: token,
    maxAgeSeconds: ENV.sessionTtlHours * 60 * 60,
  });
}

function buildClearSessionCookie() {
  return serializeCookie({
    name: ENV.cookieName,
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

function createAuditRequestLike(
  request: FastifyRequest,
  auth?: Pick<AuthenticatedClinicUser, "id" | "clinicId" | "username" | "role">,
) {
  return {
    method: request.method,
    originalUrl: request.url,
    ip: request.ip,
    headers: request.headers,
    auth,
  };
}

async function authenticateClinicUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeAuthDeps,
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

  await deps.updateSessionLastAccess(tokenHash);

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

export const clinicAuthNativeRoutes: FastifyPluginAsync<
  AuthNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.createActiveSession &&
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.getClinicUserByUsername &&
    !!options.updateSessionLastAccess &&
    !!options.upsertClinicUser &&
    !!options.generateSessionToken &&
    !!options.hashPassword &&
    !!options.hashSessionToken &&
    !!options.verifyPassword &&
    !!options.writeAuditLog;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeAuthDeps = {
    createActiveSession:
      options.createActiveSession ?? defaultDeps!.createActiveSession,
    deleteActiveSession:
      options.deleteActiveSession ?? defaultDeps!.deleteActiveSession,
    getActiveSessionByToken:
      options.getActiveSessionByToken ?? defaultDeps!.getActiveSessionByToken,
    getClinicUserById:
      options.getClinicUserById ?? defaultDeps!.getClinicUserById,
    getClinicUserByUsername:
      options.getClinicUserByUsername ?? defaultDeps!.getClinicUserByUsername,
    updateSessionLastAccess:
      options.updateSessionLastAccess ?? defaultDeps!.updateSessionLastAccess,
    upsertClinicUser:
      options.upsertClinicUser ?? defaultDeps!.upsertClinicUser,
    generateSessionToken:
      options.generateSessionToken ?? defaultDeps!.generateSessionToken,
    hashPassword: options.hashPassword ?? defaultDeps!.hashPassword,
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
    (request as AuthFastifyRequest)[REQUEST_START_TIME_KEY] =
      process.hrtime.bigint();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt =
      (request as AuthFastifyRequest)[REQUEST_START_TIME_KEY] ??
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

  const optionsHandler = async (request: FastifyRequest, reply: FastifyReply) => {
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
        error: "Usuario y contrasena son obligatorios",
      });
    }

    const clinicUser = await deps.getClinicUserByUsername(username);

    if (!clinicUser) {
      markFailure();

      return reply.code(401).send({
        success: false,
        error: "Usuario o contraseña inválidos",
      });
    }

    const passwordCheck = await deps.verifyPassword(
      password,
      clinicUser.passwordHash,
    );

    if (!passwordCheck.valid) {
      markFailure();

      return reply.code(401).send({
        success: false,
        error: "Usuario o contraseña inválidos",
      });
    }

    const role = normalizeClinicUserRole(clinicUser.role, "clinic_staff");

    if (passwordCheck.needsRehash) {
      const newHash = await deps.hashPassword(password);

      await deps.upsertClinicUser({
        clinicId: clinicUser.clinicId,
        username: clinicUser.username,
        passwordHash: newHash,
        authProId: clinicUser.authProId ?? null,
        role,
      });
    }

    const token = deps.generateSessionToken();
    const tokenHash = deps.hashSessionToken(token);
    const expiresAt = new Date(
      currentTime + ENV.sessionTtlHours * 60 * 60 * 1000,
    );

    await deps.createActiveSession({
      clinicUserId: clinicUser.id,
      tokenHash,
      expiresAt,
    });

    await deps.writeAuditLog(createAuditRequestLike(request), {
      event: AUDIT_EVENTS.CLINIC_LOGIN_SUCCEEDED,
      clinicId: clinicUser.clinicId,
      targetClinicUserId: clinicUser.id,
      metadata: {
        username: clinicUser.username,
        role,
        sessionExpiresAt: expiresAt,
      },
      actor: {
        type: "clinic_user",
        clinicUserId: clinicUser.id,
      },
    });

    reply.header("set-cookie", buildSessionCookie(token));
    markSuccess();

    return reply.code(200).send({
      success: true,
      clinicUser: {
        id: clinicUser.id,
        clinicId: clinicUser.clinicId,
        username: clinicUser.username,
        authProId: clinicUser.authProId ?? null,
        role,
      },
      permissions: getClinicPermissions(role),
    });
  });

  app.get("/me", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    return reply.code(200).send({
      success: true,
      clinicUser: {
        id: auth.id,
        clinicId: auth.clinicId,
        username: auth.username,
        authProId: auth.authProId,
        role: auth.role,
      },
      permissions: auth.permissions,
    });
  });

  app.post("/logout", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const tokenHash = deps.hashSessionToken(auth.sessionToken);
    await deps.deleteActiveSession(tokenHash);

    reply.header("set-cookie", buildClearSessionCookie());

    return reply.code(200).send({
      success: true,
      message: "Sesión cerrada correctamente",
    });
  });
};


