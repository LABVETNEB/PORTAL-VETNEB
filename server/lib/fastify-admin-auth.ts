import type { FastifyReply, FastifyRequest } from "fastify";

import { ENV } from "./env.ts";
import { shouldRefreshSessionLastAccess } from "./session-last-access.ts";

type FastifyAdminSessionRecord = {
  id?: number;
  adminUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type FastifyAdminUserRecord = {
  id: number;
  username: string;
};

type FastifyAdminSessionWithUserRecord = {
  session: FastifyAdminSessionRecord;
  adminUser: FastifyAdminUserRecord | null;
};

export type FastifyAdminAuthFailureReason =
  | "missing_token"
  | "invalid_session"
  | "expired_session"
  | "missing_user";

export type FastifyAdminAuthDeps = {
  deleteAdminSession: (tokenHash: string) => Promise<void>;
  getAdminSessionWithUser?: (
    tokenHash: string,
  ) => Promise<FastifyAdminSessionWithUserRecord | null>;
  getAdminSessionByToken?: (
    tokenHash: string,
  ) => Promise<FastifyAdminSessionRecord | null>;
  getAdminUserById?: (
    adminUserId: number,
  ) => Promise<FastifyAdminUserRecord | null>;
  updateAdminSessionLastAccess: (tokenHash: string) => Promise<void>;
  hashSessionToken: (token: string) => string;
  now: () => number;
  messages?: Partial<Record<FastifyAdminAuthFailureReason, string>>;
};

export type FastifyAuthenticatedAdmin = {
  id: number;
  username: string;
  sessionId?: number;
  sessionToken: string;
};

export type RequestAdminAuthContext =
  | {
      ok: true;
      admin: FastifyAuthenticatedAdmin;
      tokenHash: string;
      session: FastifyAdminSessionRecord;
      adminUser: FastifyAdminUserRecord;
    }
  | {
      ok: false;
      reason: FastifyAdminAuthFailureReason;
      tokenHash?: string;
      shouldClearSessionCookie?: boolean;
    };

const DEFAULT_AUTH_MESSAGES: Record<FastifyAdminAuthFailureReason, string> = {
  missing_token: "Admin no autenticado",
  invalid_session: "Sesión admin inválida",
  expired_session: "Sesión admin expirada",
  missing_user: "Usuario admin de sesión no encontrado",
};

const REQUEST_ADMIN_AUTH_CONTEXT_KEY: unique symbol = Symbol(
  "requestAdminAuthContext",
);

type RequestAdminAuthContextCache = {
  sessionToken: string | undefined;
  promise: Promise<RequestAdminAuthContext>;
};

type RequestWithAdminAuthContext = FastifyRequest & {
  [REQUEST_ADMIN_AUTH_CONTEXT_KEY]?: RequestAdminAuthContextCache;
  adminAuth?: FastifyAuthenticatedAdmin;
};

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

function buildClearAdminSessionCookie() {
  return serializeCookie({
    name: ENV.adminCookieName,
    value: "",
    maxAgeSeconds: 0,
    expires: "Thu, 01 Jan 1970 00:00:00 GMT",
  });
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

async function getSessionWithUser(
  deps: FastifyAdminAuthDeps,
  tokenHash: string,
) {
  if (deps.getAdminSessionWithUser) {
    const sessionWithUser = await deps.getAdminSessionWithUser(tokenHash);

    return sessionWithUser
      ? {
          ...sessionWithUser,
          adminUserLoaded: true,
        }
      : null;
  }

  if (!deps.getAdminSessionByToken || !deps.getAdminUserById) {
    throw new Error(
      "Fastify admin auth requires getAdminSessionWithUser or session+user deps",
    );
  }

  const session = await deps.getAdminSessionByToken(tokenHash);

  return session
    ? {
        session,
        adminUser: null,
        adminUserLoaded: false,
      }
    : null;
}

async function resolveAdminUser(
  deps: FastifyAdminAuthDeps,
  sessionWithUser: {
    session: FastifyAdminSessionRecord;
    adminUser: FastifyAdminUserRecord | null;
    adminUserLoaded: boolean;
  },
) {
  if (sessionWithUser.adminUserLoaded) {
    return sessionWithUser.adminUser;
  }

  if (!deps.getAdminUserById) {
    throw new Error(
      "Fastify admin auth requires getAdminUserById when using split session deps",
    );
  }

  return deps.getAdminUserById(sessionWithUser.session.adminUserId);
}

async function loadRequestAdminAuthContext(
  request: FastifyRequest,
  deps: FastifyAdminAuthDeps,
): Promise<RequestAdminAuthContext> {
  const token = getAdminSessionToken(request);

  if (!token) {
    return {
      ok: false,
      reason: "missing_token",
    };
  }

  const tokenHash = deps.hashSessionToken(token);
  const sessionWithUser = await getSessionWithUser(deps, tokenHash);

  if (!sessionWithUser) {
    return {
      ok: false,
      reason: "invalid_session",
      tokenHash,
    };
  }

  const { session } = sessionWithUser;

  if (session.expiresAt && session.expiresAt.getTime() <= deps.now()) {
    await deps.deleteAdminSession(tokenHash);

    return {
      ok: false,
      reason: "expired_session",
      tokenHash,
      shouldClearSessionCookie: true,
    };
  }

  const adminUser = await resolveAdminUser(deps, sessionWithUser);

  if (!adminUser) {
    await deps.deleteAdminSession(tokenHash);

    return {
      ok: false,
      reason: "missing_user",
      tokenHash,
      shouldClearSessionCookie: true,
    };
  }

  if (shouldRefreshSessionLastAccess(session.lastAccess ?? null, deps.now())) {
    await deps.updateAdminSessionLastAccess(tokenHash);
  }

  const admin = {
    id: adminUser.id,
    username: adminUser.username,
    sessionId: session.id,
    sessionToken: token,
  };

  (request as RequestWithAdminAuthContext).adminAuth = admin;

  return {
    ok: true,
    tokenHash,
    session,
    adminUser,
    admin,
  };
}

export function clearRequestAdminAuthContext(request: FastifyRequest) {
  const requestWithContext = request as RequestWithAdminAuthContext;

  delete requestWithContext[REQUEST_ADMIN_AUTH_CONTEXT_KEY];
  delete requestWithContext.adminAuth;
}

export function getRequestAdminAuthContext(
  request: FastifyRequest,
  deps: FastifyAdminAuthDeps,
): Promise<RequestAdminAuthContext> {
  const token = getAdminSessionToken(request);
  const requestWithCache = request as RequestWithAdminAuthContext;
  const cached = requestWithCache[REQUEST_ADMIN_AUTH_CONTEXT_KEY];

  if (cached && cached.sessionToken === token) {
    return cached.promise;
  }

  const promise = loadRequestAdminAuthContext(request, deps);
  requestWithCache[REQUEST_ADMIN_AUTH_CONTEXT_KEY] = {
    sessionToken: token,
    promise,
  };

  return promise;
}

function getAuthErrorMessage(
  deps: FastifyAdminAuthDeps,
  reason: FastifyAdminAuthFailureReason,
) {
  return deps.messages?.[reason] ?? DEFAULT_AUTH_MESSAGES[reason];
}

export async function authenticateFastifyAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: FastifyAdminAuthDeps,
): Promise<FastifyAuthenticatedAdmin | null> {
  const context = await getRequestAdminAuthContext(request, deps);

  if (!context.ok) {
    if (context.shouldClearSessionCookie) {
      reply.header("set-cookie", buildClearAdminSessionCookie());
    }

    reply.code(401).send({
      success: false,
      error: getAuthErrorMessage(deps, context.reason),
    });
    return null;
  }

  return context.admin;
}
