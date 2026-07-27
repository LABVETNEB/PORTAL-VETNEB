import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { ENV } from "../lib/env.ts";
import {
  getAllowedOrigins,
  getAllowedOriginForCors,
  getRequestOrigin,
  enforceTrustedOrigin,
} from "../lib/cors-headers.ts";
import { AUDIT_EVENTS } from "../lib/audit.ts";
import { authenticateFastifyAdmin } from "../lib/fastify-admin-auth.ts";
import type {
  AdminUsersRolesQuery,
} from "../features/users-roles/application/index.ts";
import {
  createAdminUsersRolesRouteComposition,
  type AdminUsersRolesResolvedRouteDeps,
  type AdminUsersRolesRouteCompositionOptions,
} from "../features/users-roles/admin-users-roles-route-composition.ts";
import {
  parseAdminClinicUserRole,
  parseAdminRoleUserRole,
  parseAdminRoleUserType,
  type AdminClinicUserRole,
} from "../features/users-roles/domain/index.ts";
type AuthenticatedAdminUser = {
  id: number;
  username: string;
};

type AdminUsersRolesRequestQuery = {
  userType?: string;
  role?: string;
  limit?: string;
  offset?: string;
  search?: string;
};

type AdminUsersRolesRoleChangeParams = {
  clinicUserId: string;
};

type AdminUsersRolesRoleChangeBody = {
  role?: unknown;
};

type AdminUsersRolesCredentialsChangeParams = {
  clinicUserId: string;
};

type AdminUsersRolesCredentialsChangeBody = {
  username?: unknown;
  password?: unknown;
};

export type AdminUsersRolesNativeRoutesOptions =
  AdminUsersRolesRouteCompositionOptions;

async function authenticateAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: AdminUsersRolesResolvedRouteDeps,
  now: () => number,
): Promise<AuthenticatedAdminUser | null> {
  return authenticateFastifyAdmin(request, reply, {
    deleteAdminSession: deps.deleteAdminSession,
    getAdminSessionWithUser: deps.getAdminSessionWithUser,
    updateAdminSessionLastAccess: deps.updateAdminSessionLastAccess,
    hashSessionToken: deps.hashSessionToken,
    now,
  });
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
}

function parseClinicUserCredentialsBody(
  body: AdminUsersRolesCredentialsChangeBody | undefined,
):
  | {
      ok: true;
      data: {
        username?: string;
        password?: string;
        updatedFields: string[];
      };
    }
  | { ok: false; error: string } {
  const data: {
    username?: string;
    password?: string;
    updatedFields: string[];
  } = {
    updatedFields: [],
  };

  if (body?.username !== undefined) {
    if (typeof body.username !== "string") {
      return {
        ok: false,
        error: "username debe ser texto.",
      };
    }

    const username = body.username.trim();

    if (username.length < 3) {
      return {
        ok: false,
        error: "username debe tener al menos 3 caracteres.",
      };
    }

    if (username.length > 100) {
      return {
        ok: false,
        error: "username excede 100 caracteres.",
      };
    }

    data.username = username;
    data.updatedFields.push("username");
  }

  if (body?.password !== undefined) {
    if (
      typeof body.password !== "string" ||
      body.password.length < 8 ||
      body.password.trim().length < 8
    ) {
      return {
        ok: false,
        error: "La contraseña debe tener al menos 8 caracteres.",
      };
    }

    data.password = body.password;
    data.updatedFields.push("accessCredential");
  }

  if (data.updatedFields.length === 0) {
    return {
      ok: false,
      error: "Debe enviar username y/o contraseña para actualizar.",
    };
  }

  return {
    ok: true,
    data,
  };
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

function parseSearchParam(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
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
  const userType =
    query.userType === undefined
      ? undefined
      : parseAdminRoleUserType(query.userType);
  const role =
    query.role === undefined
      ? undefined
      : parseAdminRoleUserRole(query.role);
  const limit = parseIntegerParam(query.limit, 50, 1, 100);
  const offset = parseIntegerParam(query.offset, 0, 0, 100_000);
  const search = parseSearchParam(query.search);

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
    ...(search ? { search } : {}),
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
  const {
    now,
    resolveDeps,
    usersRolesUseCases,
    updateAdminClinicUserCredentials,
  } = createAdminUsersRolesRouteComposition(options);
  const allowedOrigins = new Set(getAllowedOrigins());

  app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply, allowedOrigins);
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
    reply.header("access-control-allow-methods", "GET,PATCH,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/", optionsHandler);
  app.options("/clinic/:clinicUserId/role", optionsHandler);
  app.options("/clinic/:clinicUserId/credentials", optionsHandler);

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

      const snapshot =
        await usersRolesUseCases.listAdminUsersRoles(params);

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
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

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

    const role: AdminClinicUserRole | null =
      parseAdminClinicUserRole(request.body?.role);

    if (!role) {
      return reply.code(400).send({
        success: false,
        error: "role inválido. Debe ser clinic_owner o clinic_staff.",
      });
    }

    const result = await usersRolesUseCases.changeClinicUserRole({
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

  app.patch<{
    Params: AdminUsersRolesCredentialsChangeParams;
    Body: AdminUsersRolesCredentialsChangeBody;
  }>("/clinic/:clinicUserId/credentials", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

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

    const parsed = parseClinicUserCredentialsBody(request.body);

    if (!parsed.ok) {
      return reply.code(400).send({
        success: false,
        error: parsed.error,
      });
    }

    const result =
      await updateAdminClinicUserCredentials(
        {
          clinicUserId,
          username: parsed.data.username,
          password: parsed.data.password,
          now: new Date(now()),
        },
        deps,
      );

    if (!result.ok && result.reason === "not_found") {
      return reply.code(404).send({
        success: false,
        error: "Usuario de clínica no encontrado.",
      });
    }

    if (!result.ok && result.reason === "username_conflict") {
      return reply.code(409).send({
        success: false,
        error: "El usuario de acceso ya existe.",
      });
    }

    if (!result.ok) {
      return reply.code(500).send({
        success: false,
        error: "No se pudieron actualizar las credenciales.",
      });
    }

    await deps.writeAuditLog(createAuditRequestLike(request, admin), {
      event: AUDIT_EVENTS.CLINIC_USER_CREDENTIALS_UPDATED,
      clinicId: result.user.clinicId,
      targetClinicUserId: result.user.userId,
      metadata: {
        previousUsername: result.previousUsername,
        newUsername: result.user.username,
        clinicName: result.user.clinicName,
        usernameChanged: result.usernameChanged,
        credentialUpdated: result.credentialUpdated,
        updatedFields: parsed.data.updatedFields,
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
