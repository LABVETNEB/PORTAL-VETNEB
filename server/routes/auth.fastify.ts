import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { AUDIT_EVENTS } from "../lib/audit.ts";
import {
  enforceTrustedOrigin,
  getAllowedOriginForCors,
  getAllowedOrigins,
  getRequestOrigin,
} from "../lib/cors-headers.ts";
import { ENV } from "../lib/env.ts";
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
  consumeRateLimitAttempt,
  getOrCreateRateLimitEntry,
  type RateLimitEntry,
  type RateLimitStore,
} from "../lib/rate-limit-store.ts";
import {
  getClinicPermissions,
  normalizeClinicUserRole,
} from "../lib/permissions.ts";
import { logRequestCompletion } from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";
import {
  authenticateFastifyClinicUser,
  type FastifyAuthenticatedClinicUser,
} from "../lib/fastify-clinic-auth.ts";

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
  passwordHash?: string;
  authProId?: string | null;
  role: unknown;
};

type AdminUserRecord = {
  id: number;
  username: string;
  email?: string | null;
  passwordHash: string;
};

type ParticularTokenAuthRecord = {
  id: number;
  clinicId: number;
  reportId: number | null;
  isActive: boolean;
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
  canManageClinicUsers: boolean;
  passwordHash?: string;
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

type AdminAuditWriteInput = {
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
  surface: "clinic";
  username?: string | null;
  reason: LoginFailedAttemptReason;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
};

type UnifiedLoginRole = "admin" | "clinic" | "particular";

type AuthenticatedAdminCandidate = {
  role: "admin";
  redirectTo: string;
  setCookie: string;
};

type AuthenticatedClinicCandidate = {
  role: "clinic";
  redirectTo: string;
  setCookie: string;
  clinicUser: {
    id: number;
    clinicId: number;
    username: string;
    authProId: string | null;
    role: ReturnType<typeof normalizeClinicUserRole>;
  };
  permissions: ReturnType<typeof getClinicPermissions>;
};

type AuthenticatedParticularCandidate = {
  role: "particular";
  redirectTo: string;
  setCookie: string;
};

type UnifiedAuthenticatedCandidate =
  | AuthenticatedAdminCandidate
  | AuthenticatedClinicCandidate
  | AuthenticatedParticularCandidate;

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
  getClinicUserByIdentifier?: (
    identifier: string,
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
  createAdminSession?: (input: {
    adminUserId: number;
    tokenHash: string;
    expiresAt: Date;
  }) => Promise<unknown>;
  getAdminUserByUsername?: (
    username: string,
  ) => Promise<AdminUserRecord | null>;
  getAdminUserByIdentifier?: (
    identifier: string,
  ) => Promise<AdminUserRecord | null>;
  writeAdminAuditLog?: (
    req: unknown,
    input: AdminAuditWriteInput,
  ) => Promise<void>;
  createParticularSession?: (input: {
    particularTokenId: number;
    tokenHash: string;
    lastAccess: Date;
    expiresAt: Date;
  }) => Promise<unknown>;
  getParticularTokenByTokenHash?: (
    tokenHash: string,
  ) => Promise<ParticularTokenAuthRecord | null>;
  updateParticularTokenLastLogin?: (tokenId: number) => Promise<void>;
  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;
  recordLoginFailedAttempt?: (
    input: RecordLoginFailedAttemptInput,
  ) => Promise<unknown>;
  loginRateLimitWindowMs?: number;
  loginRateLimitMaxAttempts?: number;
  loginRateLimitStore?: RateLimitStore;
  now?: () => number;
};

const REQUEST_TIMER_KEY = "__clinicAuthRequestTimer";
const PASSWORD_CHANGE_MIN_LENGTH = 8;
const PASSWORD_CHANGE_ERROR_MESSAGE = "No se pudo actualizar la credencial.";

type AuthFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
};

type NativeAuthDeps = Required<
  Pick<
    AuthNativeRoutesOptions,
    | "createActiveSession"
    | "deleteActiveSession"
    | "getActiveSessionByToken"
    | "getClinicUserById"
    | "getClinicUserByUsername"
    | "getClinicUserByIdentifier"
    | "updateSessionLastAccess"
    | "upsertClinicUser"
    | "generateSessionToken"
    | "hashPassword"
    | "hashSessionToken"
    | "verifyPassword"
    | "createAdminSession"
    | "getAdminUserByUsername"
    | "getAdminUserByIdentifier"
    | "writeAdminAuditLog"
    | "createParticularSession"
    | "getParticularTokenByTokenHash"
    | "updateParticularTokenLastLogin"
    | "writeAuditLog"
    | "recordLoginFailedAttempt"
  >
>;
type NativeAuthDefaultDeps = NativeAuthDeps & {
  loginRateLimitStore: RateLimitStore;
};

let defaultDepsPromise: Promise<NativeAuthDefaultDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeAuthDefaultDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const dbParticular = await import("../features/particular-access/infrastructure/index.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const audit = await import("../lib/audit.ts");
      const getClinicUserByIdentifier = async (identifier: string) =>
        (await db.getClinicUserByIdentifier(identifier)) ?? null;
      const getAdminUserByIdentifier = async (identifier: string) =>
        (await db.getAdminUserByIdentifier(identifier)) ?? null;

      return {
        createActiveSession: db.createActiveSession,
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        getClinicUserByUsername: db.getClinicUserByUsername,
        getClinicUserByIdentifier,
        updateSessionLastAccess: db.updateSessionLastAccess,
        upsertClinicUser: db.upsertClinicUser,
        generateSessionToken: authSecurity.generateSessionToken,
        hashPassword: authSecurity.hashPassword,
        hashSessionToken: authSecurity.hashSessionToken,
        verifyPassword: authSecurity.verifyPassword,
        createAdminSession: db.createAdminSession,
        getAdminUserByUsername: db.getAdminUserByUsername,
        getAdminUserByIdentifier,
        writeAdminAuditLog: audit.writeAuditLog as (
          req: unknown,
          input: AdminAuditWriteInput,
        ) => Promise<void>,
        createParticularSession: dbParticular.createParticularSession,
        getParticularTokenByTokenHash:
          dbParticular.getParticularTokenByTokenHash,
        updateParticularTokenLastLogin:
          dbParticular.updateParticularTokenLastLogin,
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
            consume: db.consumeLoginRateLimitAttempt,
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

  const depsPromise = defaultDepsPromise;
  if (!depsPromise) {
    throw new Error("No se pudieron inicializar dependencias de autenticación");
  }

  return depsPromise;
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

function buildAdminSessionCookie(token: string) {
  return serializeCookie({
    name: ENV.adminCookieName,
    value: token,
    maxAgeSeconds: ENV.sessionTtlHours * 60 * 60,
  });
}

function buildParticularSessionCookie(token: string) {
  return serializeCookie({
    name: ENV.particularCookieName,
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
    includeRetryAfter?: boolean;
  },
) {
  for (const [headerName, headerValue] of Object.entries(
    buildLoginRateLimitHeaders(input),
  )) {
    reply.header(headerName, headerValue);
  }
}

function isPasswordChangeBody(
  body: unknown,
): body is { currentPassword: string; newPassword: string } {
  if (!body || typeof body !== "object") {
    return false;
  }

  const candidate = body as {
    currentPassword?: unknown;
    newPassword?: unknown;
  };

  return (
    typeof candidate.currentPassword === "string" &&
    candidate.currentPassword.length > 0 &&
    typeof candidate.newPassword === "string" &&
    candidate.newPassword.length >= PASSWORD_CHANGE_MIN_LENGTH &&
    candidate.newPassword.trim().length >= PASSWORD_CHANGE_MIN_LENGTH
  );
}

function sendPasswordChangeRejected(reply: FastifyReply) {
  return reply.code(400).send({
    success: false,
    error: PASSWORD_CHANGE_ERROR_MESSAGE,
  });
}

function getUserAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];

  return typeof value === "string" && value.trim() ? value : null;
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

function createAdminAuditRequestLike(
  request: FastifyRequest,
  admin: Pick<AdminUserRecord, "id" | "username">,
) {
  return {
    method: request.method,
    originalUrl: request.url,
    ip: request.ip,
    headers: request.headers,
    adminAuth: {
      id: admin.id,
      username: admin.username,
    },
  };
}

function normalizeLoginIdentifier(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveRoleRedirect(role: UnifiedLoginRole) {
  if (role === "admin") {
    return "/dashboard/admin";
  }

  if (role === "particular") {
    return "/particulares";
  }

  return "/dashboard";
}

async function authenticateAdminCandidate(
  request: FastifyRequest,
  deps: NativeAuthDeps,
  input: {
    identifier: string;
    password: string;
    currentTime: number;
  },
): Promise<AuthenticatedAdminCandidate | null> {
  const admin = await deps.getAdminUserByIdentifier(input.identifier);

  if (!admin) {
    return null;
  }

  const valid = await deps.verifyPassword(input.password, admin.passwordHash);

  if (!valid.valid) {
    return null;
  }

  const token = deps.generateSessionToken();
  const tokenHash = deps.hashSessionToken(token);
  const expiresAt = new Date(
    input.currentTime + ENV.sessionTtlHours * 60 * 60 * 1000,
  );

  await deps.createAdminSession({
    adminUserId: admin.id,
    tokenHash,
    expiresAt,
  });

  await deps.writeAdminAuditLog(createAdminAuditRequestLike(request, admin), {
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

  return {
    role: "admin",
    redirectTo: resolveRoleRedirect("admin"),
    setCookie: buildAdminSessionCookie(token),
  };
}

async function authenticateClinicCandidate(
  request: FastifyRequest,
  deps: NativeAuthDeps,
  input: {
    identifier: string;
    password: string;
    currentTime: number;
  },
): Promise<AuthenticatedClinicCandidate | null> {
  const clinicUser = await deps.getClinicUserByIdentifier(input.identifier);

  if (!clinicUser) {
    return null;
  }

  const passwordCheck = await deps.verifyPassword(
    input.password,
    clinicUser.passwordHash,
  );

  if (!passwordCheck.valid) {
    return null;
  }

  const role = normalizeClinicUserRole(clinicUser.role, "clinic_staff");

  if (passwordCheck.needsRehash) {
    const newHash = await deps.hashPassword(input.password);

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
    input.currentTime + ENV.sessionTtlHours * 60 * 60 * 1000,
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

  return {
    role: "clinic",
    redirectTo: resolveRoleRedirect("clinic"),
    setCookie: buildSessionCookie(token),
    clinicUser: {
      id: clinicUser.id,
      clinicId: clinicUser.clinicId,
      username: clinicUser.username,
      authProId: clinicUser.authProId ?? null,
      role,
    },
    permissions: getClinicPermissions(role),
  };
}

async function authenticateParticularCandidate(
  deps: NativeAuthDeps,
  input: {
    identifier: string;
    password: string;
    currentTime: number;
  },
): Promise<AuthenticatedParticularCandidate | null> {
  if (input.identifier !== input.password) {
    return null;
  }

  const tokenHash = deps.hashSessionToken(input.identifier);
  const particularToken = await deps.getParticularTokenByTokenHash(tokenHash);

  if (!particularToken || !particularToken.isActive) {
    return null;
  }

  const sessionToken = deps.generateSessionToken();
  const sessionTokenHash = deps.hashSessionToken(sessionToken);
  const expiresAt = new Date(
    input.currentTime + ENV.sessionTtlHours * 60 * 60 * 1000,
  );

  await deps.createParticularSession({
    particularTokenId: particularToken.id,
    tokenHash: sessionTokenHash,
    lastAccess: new Date(input.currentTime),
    expiresAt,
  });

  await deps.updateParticularTokenLastLogin(particularToken.id);

  return {
    role: "particular",
    redirectTo: resolveRoleRedirect("particular"),
    setCookie: buildParticularSessionCookie(sessionToken),
  };
}

function getAuthAuthorization(
  auth: FastifyAuthenticatedClinicUser,
): AuthenticatedClinicUser {
  const permissions = getClinicPermissions(auth.role);

  return {
    ...auth,
    permissions,
    canManageClinicUsers: permissions.canManageClinicUsers,
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
    getClinicUserByIdentifier:
      options.getClinicUserByIdentifier ??
      defaultDeps?.getClinicUserByIdentifier ??
      options.getClinicUserByUsername ??
      defaultDeps!.getClinicUserByUsername,
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
    createAdminSession:
      options.createAdminSession ??
      defaultDeps?.createAdminSession ??
      (async () => undefined),
    getAdminUserByUsername:
      options.getAdminUserByUsername ??
      defaultDeps?.getAdminUserByUsername ??
      (async () => null),
    getAdminUserByIdentifier:
      options.getAdminUserByIdentifier ??
      defaultDeps?.getAdminUserByIdentifier ??
      options.getAdminUserByUsername ??
      defaultDeps?.getAdminUserByUsername ??
      (async () => null),
    writeAdminAuditLog:
      options.writeAdminAuditLog ??
      defaultDeps?.writeAdminAuditLog ??
      (async () => undefined),
    createParticularSession:
      options.createParticularSession ??
      defaultDeps?.createParticularSession ??
      (async () => undefined),
    getParticularTokenByTokenHash:
      options.getParticularTokenByTokenHash ??
      defaultDeps?.getParticularTokenByTokenHash ??
      (async () => null),
    updateParticularTokenLastLogin:
      options.updateParticularTokenLastLogin ??
      defaultDeps?.updateParticularTokenLastLogin ??
      (async () => undefined),
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
  const memoryLoginRateLimitStore =
    options.loginRateLimitStore ?? createMemoryRateLimitStore();
  const loginRateLimitStore =
    options.loginRateLimitStore ??
    defaultDeps?.loginRateLimitStore ??
    memoryLoginRateLimitStore;

  app.addHook("onRequest", async (request, reply) => {
    (request as AuthFastifyRequest)[REQUEST_TIMER_KEY] =
      createRuntimeTimer();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const timer =
      (request as AuthFastifyRequest)[REQUEST_TIMER_KEY] ??
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
  app.options("/change-password", optionsHandler);

  app.post<{
    Body: {
      identifier?: unknown;
      username?: unknown;
      password?: unknown;
    };
  }>("/login", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const currentTime = now();
    const identifier = normalizeLoginIdentifier(request.body?.identifier);
    const username = normalizeLoginIdentifier(request.body?.username);
    const loginIdentifier = identifier || username;
    const isUnifiedPayload =
      !!request.body &&
      typeof request.body === "object" &&
      Object.prototype.hasOwnProperty.call(request.body, "identifier");
    const password =
      typeof request.body?.password === "string" ? request.body.password : "";

    const recordFailedLoginAttempt = async (input: {
      username?: string | null;
      reason: LoginFailedAttemptReason;
    }) => {
      try {
        await deps.recordLoginFailedAttempt({
          surface: "clinic",
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
            code: "AUTH_LOGIN_FAILED_ATTEMPT_RECORD_FAILED",
            surface: "clinic",
            reason: input.reason,
          },
          "No se pudo persistir intento fallido de login clinic",
        );
      }
    };

    const markMissingCredentials = async () => {
      const missingRateLimitKey = buildMissingCredentialsLoginRateLimitKey({
        surface: isUnifiedPayload ? "unified" : "clinic",
        ipAddress: request.ip || null,
      });

      try {
        const updatedMissingEntry = await consumeRateLimitAttempt(
          loginRateLimitStore,
          missingRateLimitKey,
          { windowMs: loginRateLimitWindowMs, now: currentTime },
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
            code: "AUTH_LOGIN_MISSING_CREDENTIALS_RATE_LIMIT_FAILED",
            route: "/api/auth/login",
          },
          "No se pudo actualizar el rate limit de credenciales faltantes",
        );
      }

      await recordFailedLoginAttempt({
        username: null,
        reason: "missing_credentials",
      });
    };

    if (!loginIdentifier || !password) {
      await markMissingCredentials();

      return reply.code(400).send({
        success: false,
        error: isUnifiedPayload
          ? "Identificador y contraseña requeridos"
          : "Usuario y contrasena son obligatorios",
      });
    }

    const rateLimitKey = buildLoginRateLimitKey({
      surface: isUnifiedPayload ? "unified" : "clinic",
      identifier: loginIdentifier,
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
          code: "AUTH_LOGIN_RATE_LIMIT_GET_FAILED",
          route: "/api/auth/login",
        },
        "No se pudo leer el rate limit de login unificado",
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
        username: loginIdentifier,
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
          const updatedEntry = await consumeRateLimitAttempt(
            loginRateLimitStore,
            rateLimitKey,
            { windowMs: loginRateLimitWindowMs, now: currentTime },
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
              code: "AUTH_LOGIN_RATE_LIMIT_INCREMENT_FAILED",
              route: "/api/auth/login",
            },
            "No se pudo actualizar el rate limit de login unificado",
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
              code: "AUTH_LOGIN_RATE_LIMIT_RESET_FAILED",
              route: "/api/auth/login",
            },
            "No se pudo limpiar el rate limit de login tras login exitoso",
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

    if (isUnifiedPayload) {
      const candidateResolvers: Array<
        () => Promise<UnifiedAuthenticatedCandidate | null>
      > = [
        () =>
          authenticateAdminCandidate(request, deps, {
            identifier: loginIdentifier,
            password,
            currentTime,
          }),
        () =>
          authenticateClinicCandidate(request, deps, {
            identifier: loginIdentifier,
            password,
            currentTime,
          }),
        () =>
          authenticateParticularCandidate(deps, {
            identifier: loginIdentifier,
            password,
            currentTime,
          }),
      ];

      for (const resolveCandidate of candidateResolvers) {
        const candidate = await resolveCandidate();

        if (!candidate) {
          continue;
        }

        reply.header("set-cookie", candidate.setCookie);
        await markSuccess();

        return reply.code(200).send({
          success: true,
          role: candidate.role,
          redirectTo: candidate.redirectTo,
        });
      }

      await markFailure({
        username: loginIdentifier,
        reason: "invalid_credentials",
      });

      return reply.code(401).send({
        success: false,
        error: "Credenciales inválidas",
      });
    }

    const clinicCandidate = await authenticateClinicCandidate(request, deps, {
      identifier: loginIdentifier,
      password,
      currentTime,
    });

    if (!clinicCandidate) {
      await markFailure({
        username: loginIdentifier,
        reason: "invalid_credentials",
      });

      return reply.code(401).send({
        success: false,
        error: "Usuario o contraseña inválidos",
      });
    }

    reply.header("set-cookie", clinicCandidate.setCookie);
    await markSuccess();

    return reply.code(200).send({
      success: true,
      clinicUser: clinicCandidate.clinicUser,
      permissions: clinicCandidate.permissions,
    });
  });

  app.get("/me", async (request, reply) => {
    const clinicAuth = await authenticateFastifyClinicUser(
      request,
      reply,
      deps,
      now,
    );

    if (!clinicAuth) {
      return reply;
    }

    const auth = getAuthAuthorization(clinicAuth);

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

  app.post<{
    Body: {
      currentPassword?: unknown;
      newPassword?: unknown;
    };
  }>("/change-password", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const clinicAuth = await authenticateFastifyClinicUser(
      request,
      reply,
      deps,
      now,
    );

    if (!clinicAuth) {
      return reply;
    }

    const auth = getAuthAuthorization(clinicAuth);

    const currentTime = now();
    const rateLimitKey = buildLoginRateLimitKey({
      surface: "clinic",
      identifier: `password-change:${auth.id}`,
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
          code: "AUTH_PASSWORD_CHANGE_RATE_LIMIT_GET_FAILED",
          route: "/api/auth/change-password",
        },
        "No se pudo leer el rate limit de cambio de contraseña clinic",
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

      return reply.code(429).send(
        buildLoginRateLimitResponse({
          resetAt: failureEntry.resetAt,
          now: currentTime,
        }),
      );
    }

    const markFailure = async () => {
      if (!canUseRateLimitStore) {
        return;
      }

      try {
        const updatedEntry = await consumeRateLimitAttempt(
          loginRateLimitStore,
          rateLimitKey,
          { windowMs: loginRateLimitWindowMs, now: currentTime },
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
            code: "AUTH_PASSWORD_CHANGE_RATE_LIMIT_INCREMENT_FAILED",
            route: "/api/auth/change-password",
          },
          "No se pudo actualizar el rate limit de cambio de contraseña clinic",
        );
      }
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
              code: "AUTH_PASSWORD_CHANGE_RATE_LIMIT_RESET_FAILED",
              route: "/api/auth/change-password",
            },
            "No se pudo limpiar el rate limit tras cambio de contraseña clinic",
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

    if (!isPasswordChangeBody(request.body)) {
      await markFailure();

      return sendPasswordChangeRejected(reply);
    }

    if (!auth.passwordHash) {
      await markFailure();

      return sendPasswordChangeRejected(reply);
    }

    const currentPasswordCheck = await deps.verifyPassword(
      request.body.currentPassword,
      auth.passwordHash,
    );

    if (!currentPasswordCheck.valid) {
      await markFailure();

      return sendPasswordChangeRejected(reply);
    }

    const newPasswordMatchesCurrent =
      request.body.newPassword === request.body.currentPassword ||
      (
        await deps.verifyPassword(request.body.newPassword, auth.passwordHash)
      ).valid;

    if (newPasswordMatchesCurrent) {
      await markFailure();

      return sendPasswordChangeRejected(reply);
    }

    const newPasswordHash = await deps.hashPassword(request.body.newPassword);

    await deps.upsertClinicUser({
      clinicId: auth.clinicId,
      username: auth.username,
      passwordHash: newPasswordHash,
      authProId: auth.authProId,
      role: auth.role,
    });

    await deps.writeAuditLog(createAuditRequestLike(request, auth), {
      event: AUDIT_EVENTS.CLINIC_USER_CREDENTIALS_UPDATED,
      clinicId: auth.clinicId,
      targetClinicUserId: auth.id,
      metadata: {
        username: auth.username,
        role: auth.role,
        selfService: true,
        sessionMaintained: true,
      },
      actor: {
        type: "clinic_user",
        clinicUserId: auth.id,
      },
    });

    await markSuccess();

    return reply.code(200).send({
      success: true,
    });
  });

  app.post("/logout", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const clinicAuth = await authenticateFastifyClinicUser(
      request,
      reply,
      deps,
      now,
    );

    if (!clinicAuth) {
      return reply;
    }

    const auth = getAuthAuthorization(clinicAuth);

    const tokenHash = deps.hashSessionToken(auth.sessionToken);
    await deps.deleteActiveSession(tokenHash);

    reply.header("set-cookie", buildClearSessionCookie());

    return reply.code(200).send({
      success: true,
      message: "Sesión cerrada correctamente",
    });
  });
};
