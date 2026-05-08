import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { ENV } from "../lib/env.ts";
import { AUDIT_EVENTS, type AuditWriteInput } from "../lib/audit.ts";
import { shouldRefreshSessionLastAccess } from "../lib/session-last-access.ts";
import type {
  AdminClinicUserRoleChangeInput,
  AdminClinicUserRoleChangeResult,
  AdminRoleUserRole,
  AdminRoleUserType,
  AdminUsersRolesQuery,
  AdminUsersRolesSnapshot,
} from "../db-admin-users-roles.ts";

type AdminClinicUserRole = Exclude<AdminRoleUserRole, "admin">;

type AdminSessionRecord = {
  id: number;
  adminUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type SessionAdminUserRecord = {
  id: number;
  username: string;
};

type AuthenticatedAdminUser = {
  id: number;
  username: string;
};

type AdminUsersRolesRequestQuery = {
  userType?: string;
  role?: string;
  limit?: string;
  offset?: string;
};

type AdminUsersRolesRoleChangeParams = {
  clinicUserId: string;
};

type AdminUsersRolesRoleChangeBody = {
  role?: unknown;
};

export type AdminUsersRolesNativeRoutesOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken?: (
    tokenHash: string,
  ) => Promise<AdminSessionRecord | null>;
  getAdminUserById?: (
    adminUserId: number,
  ) => Promise<SessionAdminUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  getAdminUsersRolesSnapshot?: (
    params: AdminUsersRolesQuery,
  ) => Promise<AdminUsersRolesSnapshot>;
  changeClinicUserRole?: (
    input: AdminClinicUserRoleChangeInput,
  ) => Promise<AdminClinicUserRoleChangeResult>;
  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;
  now?: () => number;
};

type NativeAdminUsersRolesDeps = Required<
  Pick<
    AdminUsersRolesNativeRoutesOptions,
    | "deleteAdminSession"
    | "getAdminSessionByToken"
    | "getAdminUserById"
    | "updateAdminSessionLastAccess"
    | "hashSessionToken"
    | "getAdminUsersRolesSnapshot"
    | "changeClinicUserRole"
    | "writeAuditLog"
  >
>;

let defaultDepsPromise: Promise<NativeAdminUsersRolesDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeAdminUsersRolesDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const audit = await import("../lib/audit.ts");
      const usersRoles = await import("../db-admin-users-roles.ts");

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        getAdminUsersRolesSnapshot: usersRoles.getAdminUsersRolesSnapshot,
        changeClinicUserRole: usersRoles.changeClinicUserRole,
        writeAuditLog: audit.writeAuditLog as (
          req: unknown,
          input: AuditWriteInput,
        ) => Promise<void>,
      };
    })();
  }

  return defaultDepsPromise!;
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

function buildClearAdminSessionCookie() {
  return serializeCookie({
    name: ENV.adminCookieName,
    value: "",
    maxAgeSeconds: 0,
    expires: "Thu, 01 Jan 1970 00:00:00 GMT",
  });
}

async function authenticateAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeAdminUsersRolesDeps,
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
  };
}

function parseUserType(value: string | undefined): AdminRoleUserType | undefined | null {
  if (value === undefined) return undefined;
  if (value === "admin" || value === "clinic") return value;
  return null;
}

function parseRole(value: string | undefined): AdminRoleUserRole | undefined | null {
  if (value === undefined) return undefined;

  if (
    value === "admin" ||
    value === "clinic_owner" ||
    value === "clinic_staff"
  ) {
    return value;
  }

  return null;
}

function parseClinicUserRole(value: unknown): AdminClinicUserRole | null {
  if (value === "clinic_owner" || value === "clinic_staff") {
    return value;
  }

  return null;
}

function parseIntegerParam(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  return Math.min(Math.max(parsed, min), max);
}

function parsePositiveIntegerParam(value: string | undefined) {
  if (value === undefined || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function parseUsersRolesQuery(
  query: AdminUsersRolesRequestQuery,
): AdminUsersRolesQuery | null {
  const userType = parseUserType(query.userType);
  const role = parseRole(query.role);
  const limit = parseIntegerParam(query.limit, 50, 1, 100);
  const offset = parseIntegerParam(query.offset, 0, 0, 100_000);

  if (
    userType === null ||
    role === null ||
    limit === null ||
    offset === null
  ) {
    return null;
  }

  return {
    ...(userType ? { userType } : {}),
    ...(role ? { role } : {}),
    limit,
    offset,
  };
}

function createAuditRequestLike(
  request: FastifyRequest,
  admin: AuthenticatedAdminUser,
) {
  return {
    method: request.method,
    originalUrl: request.url,
    ip: request.ip,
    headers: request.headers,
    requestId: request.id,
    adminAuth: {
      id: admin.id,
      username: admin.username,
    },
  };
}

export const adminUsersRolesNativeRoutes: FastifyPluginAsync<
  AdminUsersRolesNativeRoutesOptions
> = async (app, options) => {
  const now = options.now ?? (() => Date.now());

  async function resolveDeps(): Promise<NativeAdminUsersRolesDeps> {
    const hasAllInjectedDeps =
      !!options.deleteAdminSession &&
      !!options.getAdminSessionByToken &&
      !!options.getAdminUserById &&
      !!options.updateAdminSessionLastAccess &&
      !!options.hashSessionToken &&
      !!options.getAdminUsersRolesSnapshot &&
      !!options.changeClinicUserRole &&
      !!options.writeAuditLog;

    const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

    return {
      deleteAdminSession:
        options.deleteAdminSession ?? defaultDeps!.deleteAdminSession,
      getAdminSessionByToken:
        options.getAdminSessionByToken ?? defaultDeps!.getAdminSessionByToken,
      getAdminUserById:
        options.getAdminUserById ?? defaultDeps!.getAdminUserById,
      updateAdminSessionLastAccess:
        options.updateAdminSessionLastAccess ??
        defaultDeps!.updateAdminSessionLastAccess,
      hashSessionToken:
        options.hashSessionToken ?? defaultDeps!.hashSessionToken,
      getAdminUsersRolesSnapshot:
        options.getAdminUsersRolesSnapshot ??
        defaultDeps!.getAdminUsersRolesSnapshot,
      changeClinicUserRole:
        options.changeClinicUserRole ?? defaultDeps!.changeClinicUserRole,
      writeAuditLog: options.writeAuditLog ?? defaultDeps!.writeAuditLog,
    };
  }

  app.get<{ Querystring: AdminUsersRolesRequestQuery }>(
    "/",
    async (request, reply) => {
      const deps = await resolveDeps();
      const admin = await authenticateAdminUser(request, reply, deps, now);

      if (!admin) {
        return reply;
      }

      const params = parseUsersRolesQuery(request.query);

      if (!params) {
        return reply.code(400).send({
          success: false,
          error:
            "Query inválida. userType debe ser admin o clinic; role debe ser admin, clinic_owner o clinic_staff; limit/offset deben ser enteros válidos.",
        });
      }

      const snapshot = await deps.getAdminUsersRolesSnapshot(params);

      return reply.code(200).send({
        ...snapshot,
        checkedBy: {
          adminUserId: admin.id,
          username: admin.username,
        },
      });
    },
  );

  app.patch<{
    Params: AdminUsersRolesRoleChangeParams;
    Body: AdminUsersRolesRoleChangeBody;
  }>("/clinic/:clinicUserId/role", async (request, reply) => {
    const deps = await resolveDeps();
    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const clinicUserId = parsePositiveIntegerParam(request.params.clinicUserId);

    if (clinicUserId === null) {
      return reply.code(400).send({
        success: false,
        error: "clinicUserId inválido.",
      });
    }

    const role = parseClinicUserRole(request.body?.role);

    if (!role) {
      return reply.code(400).send({
        success: false,
        error: "role inválido. Debe ser clinic_owner o clinic_staff.",
      });
    }

    const result = await deps.changeClinicUserRole({
      clinicUserId,
      role,
      now: new Date(now()),
    });

    if (!result.ok && result.reason === "not_found") {
      return reply.code(404).send({
        success: false,
        error: "Usuario de clínica no encontrado.",
      });
    }

    if (!result.ok && result.reason === "last_clinic_owner") {
      return reply.code(409).send({
        success: false,
        error:
          "No se puede degradar el último clinic_owner de la clínica.",
      });
    }

    if (!result.ok) {
      return reply.code(500).send({
        success: false,
        error: "No se pudo cambiar el rol del usuario.",
      });
    }

    await deps.writeAuditLog(createAuditRequestLike(request, admin), {
      event: AUDIT_EVENTS.CLINIC_USER_ROLE_CHANGED,
      clinicId: result.user.clinicId,
      targetClinicUserId: result.user.userId,
      metadata: {
        username: result.user.username,
        clinicName: result.user.clinicName,
        previousRole: result.previousRole,
        newRole: result.user.role,
        roleChanged: result.roleChanged,
      },
    });

    return reply.code(200).send({
      success: true,
      user: result.user,
      changedBy: {
        adminUserId: admin.id,
        username: admin.username,
      },
    });
  });
};