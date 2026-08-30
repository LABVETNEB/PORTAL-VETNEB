import type { FastifyReply, FastifyRequest } from "fastify";

import type { ClinicUserRole } from "../../drizzle/schema.ts";
import { ENV } from "./env.ts";
import { normalizeClinicUserRole } from "./permissions.ts";
import { shouldRefreshSessionLastAccess } from "./session-last-access.ts";

export type FastifyClinicSessionRecord = {
  clinicUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

export type FastifyClinicUserRecord = {
  id: number;
  clinicId: number;
  username: string;
  authProId?: string | null;
  role?: unknown;
  passwordHash?: string;
};

export type FastifyClinicAuthFailureReason =
  | "missing_token"
  | "invalid_session"
  | "expired_session"
  | "missing_user";

export type FastifyClinicAuthDeps = {
  deleteActiveSession: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken: (
    tokenHash: string,
  ) => Promise<FastifyClinicSessionRecord | null | undefined>;
  getClinicUserById: (
    clinicUserId: number,
  ) => Promise<FastifyClinicUserRecord | null | undefined>;
  updateSessionLastAccess: (tokenHash: string) => Promise<void>;
  hashSessionToken: (token: string) => string;
  messages?: Partial<Record<FastifyClinicAuthFailureReason, string>>;
};

export type FastifyAuthenticatedClinicUser = {
  id: number;
  clinicId: number;
  username: string;
  authProId: string | null;
  role: ClinicUserRole;
  sessionToken: string;
  passwordHash?: string;
};

const DEFAULT_AUTH_MESSAGES: Record<FastifyClinicAuthFailureReason, string> = {
  missing_token: "No autenticado",
  invalid_session: "Sesión inválida",
  expired_session: "Sesión expirada",
  missing_user: "Usuario de sesión no encontrado",
};

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
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

function getSessionToken(request: FastifyRequest): string | undefined {
  const cookieHeader =
    typeof request.headers.cookie === "string"
      ? request.headers.cookie
      : undefined;
  const raw = parseCookies(cookieHeader)[ENV.cookieName];

  if (typeof raw !== "string") {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
}

function buildClearSessionCookie(): string {
  const parts = [
    `${ENV.cookieName}=`,
    "Path=/",
    "HttpOnly",
    `SameSite=${ENV.cookieSameSite}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];

  if (ENV.cookieSecure) {
    parts.splice(4, 0, "Secure");
  }

  return parts.join("; ");
}

function getAuthErrorMessage(
  deps: FastifyClinicAuthDeps,
  reason: FastifyClinicAuthFailureReason,
): string {
  return deps.messages?.[reason] ?? DEFAULT_AUTH_MESSAGES[reason];
}

export async function authenticateFastifyClinicUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: FastifyClinicAuthDeps,
  now: () => number,
): Promise<FastifyAuthenticatedClinicUser | null> {
  const token = getSessionToken(request);

  if (!token) {
    reply.code(401).send({
      success: false,
      error: getAuthErrorMessage(deps, "missing_token"),
    });
    return null;
  }

  const tokenHash = deps.hashSessionToken(token);
  const session = await deps.getActiveSessionByToken(tokenHash);

  if (!session) {
    reply.code(401).send({
      success: false,
      error: getAuthErrorMessage(deps, "invalid_session"),
    });
    return null;
  }

  if (session.expiresAt && session.expiresAt.getTime() <= now()) {
    await deps.deleteActiveSession(tokenHash);
    reply.header("set-cookie", buildClearSessionCookie());
    reply.code(401).send({
      success: false,
      error: getAuthErrorMessage(deps, "expired_session"),
    });
    return null;
  }

  const clinicUser = await deps.getClinicUserById(session.clinicUserId);

  if (!clinicUser) {
    await deps.deleteActiveSession(tokenHash);
    reply.header("set-cookie", buildClearSessionCookie());
    reply.code(401).send({
      success: false,
      error: getAuthErrorMessage(deps, "missing_user"),
    });
    return null;
  }

  if (shouldRefreshSessionLastAccess(session.lastAccess ?? null, now())) {
    await deps.updateSessionLastAccess(tokenHash);
  }

  return {
    id: clinicUser.id,
    clinicId: clinicUser.clinicId,
    username: clinicUser.username,
    authProId: clinicUser.authProId ?? null,
    role: normalizeClinicUserRole(clinicUser.role, "clinic_staff"),
    sessionToken: token,
    passwordHash: clinicUser.passwordHash,
  };
}
