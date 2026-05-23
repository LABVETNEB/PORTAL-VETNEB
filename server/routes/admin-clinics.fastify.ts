import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { AUDIT_EVENTS, type AuditWriteInput } from "../lib/audit.ts";
import { ENV } from "../lib/env.ts";
import {
  authenticateFastifyAdmin,
  type FastifyAuthenticatedAdmin,
} from "../lib/fastify-admin-auth.ts";
import type {
  AdminClinicCreateInput,
  AdminClinicCreateResult,
  AdminClinicsSnapshot,
  AdminClinicSummary,
  AdminClinicUpdateInput,
} from "../db-admin-clinics.ts";
import type { ClinicUserRole } from "../../drizzle/schema";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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

type AdminClinicsQuery = {
  limit?: string;
  offset?: string;
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

type AdminClinicParams = {
  clinicId: string;
};

function getAllowedOrigins() {
  return ENV.corsOrigins.map((origin) => origin.trim().toLowerCase());
}

export type AdminClinicsNativeRoutesOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken?: (
    tokenHash: string,
  ) => Promise<AdminSessionRecord | null>;
  getAdminUserById?: (
    adminUserId: number,
  ) => Promise<SessionAdminUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  hashPassword?: (password: string) => Promise<string>;
  listAdminClinics?: (params: {
    limit?: number;
    offset?: number;
  }) => Promise<AdminClinicsSnapshot>;
  createAdminClinicWithUser?: (
    input: AdminClinicCreateInput,
  ) => Promise<AdminClinicCreateResult>;
  updateAdminClinic?: (
    input: AdminClinicUpdateInput,
  ) => Promise<AdminClinicSummary | null>;
  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;
  now?: () => number;
};

type NativeAdminClinicsDeps = Required<
  Pick<
    AdminClinicsNativeRoutesOptions,
    | "deleteAdminSession"
    | "getAdminSessionByToken"
    | "getAdminUserById"
    | "updateAdminSessionLastAccess"
    | "hashSessionToken"
    | "hashPassword"
    | "listAdminClinics"
    | "createAdminClinicWithUser"
    | "updateAdminClinic"
    | "writeAuditLog"
  >
>;

type ParsedCreateClinicPayload = {
  clinicName: string;
  contactEmail: string;
  contactPhone: string | null;
  username: string;
  password: string;
  role: ClinicUserRole;
};

type ParsedClinicUpdatePayload = {
  clinicName?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  updatedFields: string[];
};

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
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        hashPassword: authSecurity.hashPassword,
        listAdminClinics: adminClinics.listAdminClinics,
        createAdminClinicWithUser: adminClinics.createAdminClinicWithUser,
        updateAdminClinic: adminClinics.updateAdminClinic,
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

function parseClinicUserRole(value: unknown): ClinicUserRole | null {
  if (value === undefined || value === null || value === "") {
    return "clinic_owner";
  }

  if (value === "clinic_owner" || value === "clinic_staff") {
    return value;
  }

  return null;
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin.trim().toLowerCase();
  } catch {
    return null;
  }
}

function getOriginHeader(request: FastifyRequest): string {
  return typeof request.headers.origin === "string"
    ? request.headers.origin.trim()
    : "";
}

function getAllowedOriginForCors(
  request: FastifyRequest,
  allowedOrigins: ReadonlySet<string>,
): string | null {
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

  return refererHeader ? normalizeOrigin(refererHeader) : null;
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

function enforceTrustedOrigin(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: ReadonlySet<string>,
) {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) {
    return true;
  }

  const requestOrigin = getRequestOrigin(request);

  if (!requestOrigin || allowedOrigins.has(requestOrigin)) {
    return true;
  }

  reply.code(403).send({
    success: false,
    error: "Origen no permitido",
  });

  return false;
}

function parseRequiredString(input: {
  value: unknown;
  field: string;
  label: string;
  maxLength: number;
}) {
  if (typeof input.value !== "string") {
    return {
      ok: false as const,
      error: `${input.label} es obligatorio.`,
    };
  }

  const trimmed = input.value.trim();

  if (!trimmed) {
    return {
      ok: false as const,
      error: `${input.label} es obligatorio.`,
    };
  }

  if (trimmed.length > input.maxLength) {
    return {
      ok: false as const,
      error: `${input.label} excede ${input.maxLength} caracteres.`,
    };
  }

  return {
    ok: true as const,
    value: trimmed,
  };
}

function parseOptionalString(input: {
  value: unknown;
  label: string;
  maxLength: number;
}) {
  if (input.value === undefined) {
    return {
      ok: true as const,
      value: undefined,
    };
  }

  if (input.value === null) {
    return {
      ok: true as const,
      value: null,
    };
  }

  if (typeof input.value !== "string") {
    return {
      ok: false as const,
      error: `${input.label} debe ser texto.`,
    };
  }

  const trimmed = input.value.trim();

  if (trimmed.length > input.maxLength) {
    return {
      ok: false as const,
      error: `${input.label} excede ${input.maxLength} caracteres.`,
    };
  }

  return {
    ok: true as const,
    value: trimmed || null,
  };
}

function parseOptionalRequiredString(input: {
  value: unknown;
  label: string;
  maxLength: number;
}) {
  if (input.value === undefined) {
    return {
      ok: true as const,
      value: undefined,
    };
  }

  return parseRequiredString({
    value: input.value,
    field: input.label,
    label: input.label,
    maxLength: input.maxLength,
  });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseCreateClinicBody(
  body: AdminClinicCreateBody | undefined,
):
  | { ok: true; data: ParsedCreateClinicPayload }
  | { ok: false; error: string } {
  const clinicName = parseRequiredString({
    value: body?.clinicName,
    field: "clinicName",
    label: "Nombre de clínica",
    maxLength: 255,
  });
  const contactEmail = parseRequiredString({
    value: body?.contactEmail,
    field: "contactEmail",
    label: "Email de contacto",
    maxLength: 255,
  });
  const contactPhone = parseOptionalString({
    value: body?.contactPhone,
    label: "Teléfono de contacto",
    maxLength: 50,
  });
  const username = parseRequiredString({
    value: body?.username,
    field: "username",
    label: "Usuario",
    maxLength: 100,
  });

  if (!clinicName.ok) return clinicName;
  if (!contactEmail.ok) return contactEmail;
  if (!contactPhone.ok) return contactPhone;
  if (!username.ok) return username;

  if (!isValidEmail(contactEmail.value)) {
    return {
      ok: false,
      error: "Email de contacto inválido.",
    };
  }

  if (username.value.length < 3) {
    return {
      ok: false,
      error: "Usuario debe tener al menos 3 caracteres.",
    };
  }

  if (
    typeof body?.password !== "string" ||
    body.password.length < 8 ||
    body.password.trim().length < 8
  ) {
    return {
      ok: false,
      error: "La contraseña debe tener al menos 8 caracteres.",
    };
  }

  const role = parseClinicUserRole(body.role);

  if (!role) {
    return {
      ok: false,
      error: "role inválido. Debe ser clinic_owner o clinic_staff.",
    };
  }

  return {
    ok: true,
    data: {
      clinicName: clinicName.value,
      contactEmail: contactEmail.value,
      contactPhone: contactPhone.value ?? null,
      username: username.value,
      password: body.password,
      role,
    },
  };
}

function parseClinicUpdateBody(
  body: AdminClinicUpdateBody | undefined,
):
  | { ok: true; data: ParsedClinicUpdatePayload }
  | { ok: false; error: string } {
  const clinicName = parseOptionalRequiredString({
    value: body?.clinicName,
    label: "Nombre de clínica",
    maxLength: 255,
  });
  const contactEmail = parseOptionalString({
    value: body?.contactEmail,
    label: "Email de contacto",
    maxLength: 255,
  });
  const contactPhone = parseOptionalString({
    value: body?.contactPhone,
    label: "Teléfono de contacto",
    maxLength: 50,
  });

  if (!clinicName.ok) return clinicName;
  if (!contactEmail.ok) return contactEmail;
  if (!contactPhone.ok) return contactPhone;

  if (
    typeof contactEmail.value === "string" &&
    !isValidEmail(contactEmail.value)
  ) {
    return {
      ok: false,
      error: "Email de contacto inválido.",
    };
  }

  const updatedFields: string[] = [];
  const data: ParsedClinicUpdatePayload = {
    updatedFields,
  };

  if (clinicName.value !== undefined) {
    data.clinicName = clinicName.value;
    updatedFields.push("clinicName");
  }

  if (contactEmail.value !== undefined) {
    data.contactEmail = contactEmail.value;
    updatedFields.push("contactEmail");
  }

  if (contactPhone.value !== undefined) {
    data.contactPhone = contactPhone.value;
    updatedFields.push("contactPhone");
  }

  if (updatedFields.length === 0) {
    return {
      ok: false,
      error: "Debe enviar al menos un dato de clínica para actualizar.",
    };
  }

  return {
    ok: true,
    data,
  };
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

export const adminClinicsNativeRoutes: FastifyPluginAsync<
  AdminClinicsNativeRoutesOptions
> = async (app, options) => {
  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(getAllowedOrigins());

  async function resolveDeps(): Promise<NativeAdminClinicsDeps> {
    const hasAllInjectedDeps =
      !!options.deleteAdminSession &&
      !!options.getAdminSessionByToken &&
      !!options.getAdminUserById &&
      !!options.updateAdminSessionLastAccess &&
      !!options.hashSessionToken &&
      !!options.hashPassword &&
      !!options.listAdminClinics &&
      !!options.createAdminClinicWithUser &&
      !!options.updateAdminClinic &&
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
      hashPassword: options.hashPassword ?? defaultDeps!.hashPassword,
      listAdminClinics:
        options.listAdminClinics ?? defaultDeps!.listAdminClinics,
      createAdminClinicWithUser:
        options.createAdminClinicWithUser ??
        defaultDeps!.createAdminClinicWithUser,
      updateAdminClinic:
        options.updateAdminClinic ?? defaultDeps!.updateAdminClinic,
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
    reply.header("access-control-allow-methods", "GET,POST,PATCH,OPTIONS");

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

      return reply.code(200).send(await deps.listAdminClinics({ limit, offset }));
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

      const parsed = parseCreateClinicBody(request.body);

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
            error: "El username de clínica ya existe.",
          });
        }

        if (!result.ok) {
          return reply.code(500).send({
            success: false,
            error: "No se pudo crear la clínica.",
          });
        }

        await deps.writeAuditLog(createAuditRequestLike(request, admin), {
          event: AUDIT_EVENTS.CLINIC_CREATED,
          clinicId: result.clinic.clinicId,
          metadata: {
            clinicName: result.clinic.clinicName,
            contactEmail: result.clinic.contactEmail,
            contactPhone: result.clinic.contactPhone,
          },
        });
        await deps.writeAuditLog(createAuditRequestLike(request, admin), {
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
            error: "El username de clínica ya existe.",
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

    const parsed = parseClinicUpdateBody(request.body);

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

    await deps.writeAuditLog(createAuditRequestLike(request, admin), {
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
};
