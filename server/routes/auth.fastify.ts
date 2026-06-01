import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { AUDIT_EVENTS } from "../lib/audit.ts";
import { ENV } from "../lib/env.ts";
import {
  buildLoginRateLimitKey,
  LOGIN_RATE_LIMIT_ERROR_MESSAGE,
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
  getClinicPermissions,
  normalizeClinicUserRole,
} from "../lib/permissions.ts";
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
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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
      const dbParticular = await import("../db-particular.ts");
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
        loginRateLimitStore: createPersistentRateLimitStore({
          get: db.getLoginRateLimitEntry,
          set: db.setLoginRateLimitEntry,
          increment: db.incrementLoginRateLimitEntry,
          cleanupExpired: db.deleteExpiredLoginRateLimitEntries,
        }),
      };
    })();
  }

  const depsPromise = defaultDepsPromise;
  if (!depsPromise) {
    throw new Error("No se pudieron inicializar dependencias de autenticación");
  }

  return depsPromise;
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
    String(getLoginRateLimitResetSeconds(input)),
  );
}

function getLoginRateLimitResetSeconds(input: {
  resetAt: number;
  now: number;
}) {
  return Math.max(Math.ceil((input.resetAt - input.now) / 1000), 0);
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

    if (!loginIdentifier || !password) {
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

    if (canUseRateLimitStore && failureEntry.count >= loginRateLimitMaxAttempts) {
      setLoginRateLimitHeaders(reply, {
        max: loginRateLimitMaxAttempts,
        windowMs: loginRateLimitWindowMs,
        failedCount: failureEntry.count,
        resetAt: failureEntry.resetAt,
        now: currentTime,
      });
      reply.header(
        "Retry-After",
        String(
          getLoginRateLimitResetSeconds({
            resetAt: failureEntry.resetAt,
            now: currentTime,
          }),
        ),
      );

      await recordFailedLoginAttempt({
        username: loginIdentifier,
        reason: "rate_limited",
      });

      return reply.code(429).send({
        success: false,
        error: LOGIN_RATE_LIMIT_ERROR_MESSAGE,
      });
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
              code: "AUTH_LOGIN_RATE_LIMIT_INCREMENT_FAILED",
              route: "/api/auth/login",
            },
            "No se pudo actualizar el rate limit de login unificado",
          );
        }
      }

      await recordFailedLoginAttempt(input);
    };

    const markSuccess = () => {
      if (!canUseRateLimitStore) {
        return;
      }

      setLoginRateLimitHeaders(reply, {
        max: loginRateLimitMaxAttempts,
        windowMs: loginRateLimitWindowMs,
        failedCount: failureEntry.count,
        resetAt: failureEntry.resetAt,
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
        markSuccess();

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
    markSuccess();

    return reply.code(200).send({
      success: true,
      clinicUser: clinicCandidate.clinicUser,
      permissions: clinicCandidate.permissions,
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
