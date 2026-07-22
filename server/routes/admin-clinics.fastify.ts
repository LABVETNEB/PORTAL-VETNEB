import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { AUDIT_EVENTS, type AuditWriteInput } from "../lib/audit.ts";
import { ENV } from "../lib/env.ts";
import {
  getAllowedOrigins,
  getAllowedOriginForCors,
  getRequestOrigin,
  enforceTrustedOrigin,
} from "../lib/cors-headers.ts";
import {
  authenticateFastifyAdmin,
  type FastifyAuthenticatedAdmin,
} from "../lib/fastify-admin-auth.ts";
import type {
  AdminClinicCreateInput,
  AdminClinicCreateResult,
  AdminClinicsSnapshot,
  AdminClinicSummary,
  AdminClinicDeleteInput,
  AdminClinicUpdateInput,
} from "../db-admin-clinics.ts";
import {
  parseClinicCreateInput,
  parseClinicUpdateInput,
  parseClinicDeleteConfirmation,
  confirmClinicNameMatches,
} from "../features/clinics/domain/index.ts";

type AdminSessionRecord = {
  id?: number;
  adminUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type SessionAdminUserRecord = {
  id: number;
  username: string;
};

type AdminSessionWithUserRecord = {
  session: AdminSessionRecord;
  adminUser: SessionAdminUserRecord | null;
};

type AdminClinicsQuery = {
  limit?: string;
  offset?: string;
  search?: string;
};

type AdminClinicCreateBody = {
  clinicName?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
  username?: unknown;
  password?: unknown;
  role?: unknown;
};

type AdminClinicUpdateBody = {
  clinicName?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
};

type AdminClinicDeleteBody = {
  confirmClinicName?: unknown;
};

type AdminClinicParams = {
  clinicId: string;
};

export type AdminClinicsNativeRoutesOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionWithUser?: (
    tokenHash: string,
  ) => Promise<AdminSessionWithUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  hashPassword?: (password: string) => Promise<string>;
  listAdminClinics?: (params: {
    limit?: number;
    offset?: number;
    search?: string;
  }) => Promise<AdminClinicsSnapshot>;
  createAdminClinicWithUser?: (
    input: AdminClinicCreateInput,
  ) => Promise<AdminClinicCreateResult>;
  getAdminClinicById?: (clinicId: number) => Promise<AdminClinicSummary | null>;
  updateAdminClinic?: (
    input: AdminClinicUpdateInput,
  ) => Promise<AdminClinicSummary | null>;
  deleteAdminClinic?: (
    input: AdminClinicDeleteInput,
  ) => Promise<AdminClinicSummary | null>;
  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;
  now?: () => number;
};

type NativeAdminClinicsDeps = Required<
  Pick<
    AdminClinicsNativeRoutesOptions,
    | "deleteAdminSession"
    | "getAdminSessionWithUser"
    | "updateAdminSessionLastAccess"
    | "hashSessionToken"
    | "hashPassword"
    | "listAdminClinics"
    | "createAdminClinicWithUser"
    | "getAdminClinicById"
    | "updateAdminClinic"
    | "deleteAdminClinic"
    | "writeAuditLog"
  >
>;

let defaultDepsPromise: Promise<NativeAdminClinicsDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeAdminClinicsDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const audit = await import("../lib/audit.ts");
      const adminClinics = await import("../db-admin-clinics.ts");

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionWithUser: db.getAdminSessionWithUser,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        hashPassword: authSecurity.hashPassword,
        listAdminClinics: adminClinics.listAdminClinics,
        createAdminClinicWithUser: adminClinics.createAdminClinicWithUser,
        getAdminClinicById: adminClinics.getAdminClinicById,
        updateAdminClinic: adminClinics.updateAdminClinic,
        deleteAdminClinic: adminClinics.deleteAdminClinic,
        writeAuditLog: audit.writeAuditLog as (
          req: unknown,
          input: AuditWriteInput,
        ) => Promise<void>,
      };
    })();
  }

  return defaultDepsPromise;
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

function createAuditRequestLike(
  request: FastifyRequest,
  admin: FastifyAuthenticatedAdmin,
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

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function hasPostgresErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function getSanitizedDbErrorDetails(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return {
      errorName: "UnknownError",
      errorCode: "unknown",
      constraintName: null,
      tableName: null,
      columnName: null,
    };
  }

  const err = error as {
    name?: unknown;
    code?: unknown;
    constraint_name?: unknown;
    table_name?: unknown;
    column_name?: unknown;
  };

  return {
    errorName: typeof err.name === "string" ? err.name : "UnknownError",
    errorCode: typeof err.code === "string" ? err.code : "unknown",
    constraintName:
      typeof err.constraint_name === "string" ? err.constraint_name : null,
    tableName: typeof err.table_name === "string" ? err.table_name : null,
    columnName: typeof err.column_name === "string" ? err.column_name : null,
  };
}

function getErrorName(error: unknown) {
  if (error instanceof Error) {
    return error.name || "Error";
  }

  return "UnknownError";
}

async function safeWriteAuditLog(
  deps: NativeAdminClinicsDeps,
  request: FastifyRequest,
  admin: FastifyAuthenticatedAdmin,
  input: AuditWriteInput,
) {
  try {
    await deps.writeAuditLog(createAuditRequestLike(request, admin), input);
  } catch (error) {
    console.error("[ADMIN_CLINICS_AUDIT_WRITE_ERROR]", {
      event: input.event,
      clinicId: input.clinicId ?? null,
      targetClinicUserId: input.targetClinicUserId ?? null,
      requestPath: request.url,
      errorName: getErrorName(error),
    });
  }
}

export const adminClinicsNativeRoutes: FastifyPluginAsync<
  AdminClinicsNativeRoutesOptions
> = async (app, options) => {
  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(getAllowedOrigins());

  async function resolveDeps(): Promise<NativeAdminClinicsDeps> {
    const hasAllInjectedDeps =
      !!options.deleteAdminSession &&
      !!options.getAdminSessionWithUser &&
      !!options.updateAdminSessionLastAccess &&
      !!options.hashSessionToken &&
      !!options.hashPassword &&
      !!options.listAdminClinics &&
      !!options.createAdminClinicWithUser &&
      !!options.getAdminClinicById &&
      !!options.updateAdminClinic &&
      !!options.deleteAdminClinic &&
      !!options.writeAuditLog;
    const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

    return {
      deleteAdminSession:
        options.deleteAdminSession ?? defaultDeps!.deleteAdminSession,
      getAdminSessionWithUser:
        options.getAdminSessionWithUser ??
        defaultDeps!.getAdminSessionWithUser,
      updateAdminSessionLastAccess:
        options.updateAdminSessionLastAccess ??
        defaultDeps!.updateAdminSessionLastAccess,
      hashSessionToken:
        options.hashSessionToken ?? defaultDeps!.hashSessionToken,
      hashPassword: options.hashPassword ?? defaultDeps!.hashPassword,
      listAdminClinics:
        options.listAdminClinics ?? defaultDeps!.listAdminClinics,
      createAdminClinicWithUser:
        options.createAdminClinicWithUser ??
        defaultDeps!.createAdminClinicWithUser,
      getAdminClinicById:
        options.getAdminClinicById ?? defaultDeps!.getAdminClinicById,
      updateAdminClinic:
        options.updateAdminClinic ?? defaultDeps!.updateAdminClinic,
      deleteAdminClinic:
        options.deleteAdminClinic ?? defaultDeps!.deleteAdminClinic,
      writeAuditLog: options.writeAuditLog ?? defaultDeps!.writeAuditLog,
    };
  }

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
    reply.header(
      "access-control-allow-methods",
      "GET,POST,PATCH,DELETE,OPTIONS",
    );

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/", optionsHandler);
  app.options("/:clinicId", optionsHandler);

  app.get<{ Querystring: AdminClinicsQuery }>(
    "/",
    async (request, reply) => {
      const deps = await resolveDeps();
      const admin = await authenticateFastifyAdmin(request, reply, {
        ...deps,
        now,
      });

      if (!admin) {
        return reply;
      }

      const limit = parseIntegerParam(request.query.limit, 50, 1, 100);
      const offset = parseIntegerParam(request.query.offset, 0, 0, 100_000);

      if (limit === null || offset === null) {
        return reply.code(400).send({
          success: false,
          error: "Query inválida. limit/offset deben ser enteros válidos.",
        });
      }

      const rawSearch = request.query.search;
      const search =
        typeof rawSearch === "string" ? rawSearch.trim().slice(0, 100) : undefined;

      return reply
        .code(200)
        .send(await deps.listAdminClinics({ limit, offset, ...(search ? { search } : {}) }));
    },
  );

  app.post<{ Body: AdminClinicCreateBody }>(
    "/",
    async (request, reply) => {
      if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
        return reply;
      }

      const deps = await resolveDeps();
      const admin = await authenticateFastifyAdmin(request, reply, {
        ...deps,
        now,
      });

      if (!admin) {
        return reply;
      }

      const parsed = parseClinicCreateInput(request.body);

      if (!parsed.ok) {
        return reply.code(400).send({
          success: false,
          error: parsed.error,
        });
      }

      try {
        const passwordHash = await deps.hashPassword(parsed.data.password);
        const result = await deps.createAdminClinicWithUser({
          clinicName: parsed.data.clinicName,
          contactEmail: parsed.data.contactEmail,
          contactPhone: parsed.data.contactPhone,
          username: parsed.data.username,
          passwordHash,
          role: parsed.data.role,
          now: new Date(now()),
        });

        if (!result.ok && result.reason === "username_conflict") {
          return reply.code(409).send({
            success: false,
            error: "El usuario de acceso ya existe.",
          });
        }

        if (!result.ok) {
          return reply.code(500).send({
            success: false,
            error: "No se pudo crear la clínica.",
          });
        }

        await safeWriteAuditLog(deps, request, admin, {
          event: AUDIT_EVENTS.CLINIC_CREATED,
          clinicId: result.clinic.clinicId,
          metadata: {
            clinicName: result.clinic.clinicName,
            contactEmail: result.clinic.contactEmail,
            contactPhone: result.clinic.contactPhone,
          },
        });
        await safeWriteAuditLog(deps, request, admin, {
          event: AUDIT_EVENTS.CLINIC_USER_CREATED,
          clinicId: result.clinic.clinicId,
          targetClinicUserId: result.user.userId,
          metadata: {
            username: result.user.username,
            clinicName: result.clinic.clinicName,
            role: result.user.role,
          },
        });

        return reply.code(201).send({
          success: true,
          clinic: result.clinic,
          user: result.user,
          createdBy: {
            adminUserId: admin.id,
            username: admin.username,
          },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          return reply.code(409).send({
            success: false,
            error: "El usuario de acceso ya existe.",
          });
        }

        if (hasPostgresErrorCode(error, "23502")) {
          console.error("[ADMIN_CLINICS_CREATE_SCHEMA_MISMATCH]", {
            requestPath: request.url,
            adminUserId: admin.id,
            ...getSanitizedDbErrorDetails(error),
          });

          return reply.code(500).send({
            success: false,
            error:
              "No se pudo crear la clínica por incompatibilidad de esquema de base de datos.",
          });
        }

        throw error;
      }
    },
  );

  app.patch<{
    Params: AdminClinicParams;
    Body: AdminClinicUpdateBody;
  }>("/:clinicId", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const deps = await resolveDeps();
    const admin = await authenticateFastifyAdmin(request, reply, {
      ...deps,
      now,
    });

    if (!admin) {
      return reply;
    }

    const clinicId = parsePositiveIntegerParam(request.params.clinicId);

    if (clinicId === null) {
      return reply.code(400).send({
        success: false,
        error: "clinicId inválido.",
      });
    }

    const parsed = parseClinicUpdateInput(request.body);

    if (!parsed.ok) {
      return reply.code(400).send({
        success: false,
        error: parsed.error,
      });
    }

    const clinic = await deps.updateAdminClinic({
      clinicId,
      clinicName: parsed.data.clinicName,
      contactEmail: parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone,
      now: new Date(now()),
    });

    if (!clinic) {
      return reply.code(404).send({
        success: false,
        error: "Clínica no encontrada.",
      });
    }

    await safeWriteAuditLog(deps, request, admin, {
      event: AUDIT_EVENTS.CLINIC_UPDATED,
      clinicId: clinic.clinicId,
      metadata: {
        clinicName: clinic.clinicName,
        contactEmail: clinic.contactEmail,
        contactPhone: clinic.contactPhone,
        updatedFields: parsed.data.updatedFields,
      },
    });

    return reply.code(200).send({
      success: true,
      clinic,
      changedBy: {
        adminUserId: admin.id,
        username: admin.username,
      },
    });
  });

  app.delete<{
    Params: AdminClinicParams;
    Body: AdminClinicDeleteBody;
  }>("/:clinicId", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const deps = await resolveDeps();
    const admin = await authenticateFastifyAdmin(request, reply, {
      ...deps,
      now,
    });

    if (!admin) {
      return reply;
    }

    const clinicId = parsePositiveIntegerParam(request.params.clinicId);

    if (clinicId === null) {
      return reply.code(400).send({
        success: false,
        error: "clinicId inválido.",
      });
    }

    const parsedDelete = parseClinicDeleteConfirmation(request.body);

    if (!parsedDelete.ok) {
      return reply.code(400).send({
        success: false,
        error: parsedDelete.error,
      });
    }

    const clinic = await deps.getAdminClinicById(clinicId);

    if (!clinic) {
      return reply.code(404).send({
        success: false,
        error: "Clínica no encontrada.",
      });
    }

    if (!confirmClinicNameMatches(parsedDelete.confirmClinicName, clinic.clinicName)) {
      return reply.code(400).send({
        success: false,
        error:
          "La confirmación no coincide con el nombre exacto de la clínica.",
      });
    }

    let deletedClinic: AdminClinicSummary | null;

    try {
      deletedClinic = await deps.deleteAdminClinic({ clinicId });
    } catch (error) {
      if (hasPostgresErrorCode(error, "23503")) {
        console.error("[ADMIN_CLINICS_DELETE_DEPENDENCY_BLOCK]", {
          requestPath: request.url,
          clinicId,
          adminUserId: admin.id,
          ...getSanitizedDbErrorDetails(error),
        });

        return reply.code(409).send({
          success: false,
          error:
            "No se pudo eliminar la clínica porque tiene dependencias activas. Revise informes, tokens o sesiones asociados.",
        });
      }

      throw error;
    }

    if (!deletedClinic) {
      return reply.code(404).send({
        success: false,
        error: "Clínica no encontrada.",
      });
    }

    await safeWriteAuditLog(deps, request, admin, {
      event: AUDIT_EVENTS.CLINIC_DELETED,
      clinicId: deletedClinic.clinicId,
      metadata: {
        clinicName: deletedClinic.clinicName,
        contactEmail: deletedClinic.contactEmail,
        contactPhone: deletedClinic.contactPhone,
      },
    });

    return reply.code(200).send({
      success: true,
      message: "Clínica eliminada definitivamente.",
      clinic: deletedClinic,
      deletedBy: {
        adminUserId: admin.id,
        username: admin.username,
      },
    });
  });
};
