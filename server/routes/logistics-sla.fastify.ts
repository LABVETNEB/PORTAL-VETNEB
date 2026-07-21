import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  SLA_INSTANCE_STATUSES,
  SLA_TARGET_TYPES,
  type ClinicUserRole,
  type SlaInstanceStatus,
  type SlaTargetType,
} from "../../drizzle/schema.ts";
import type {
  ClinicSlaSummary,
  ListActiveClinicSlaPoliciesParams,
  ListClinicSlaInstancesParams,
  ListOverdueActiveClinicSlaInstancesParams,
  SlaInstance,
  SlaPolicy,
} from "../features/logistics/infrastructure/logistics-sla-db-adapter.ts";
import { ENV } from "../lib/env.ts";
import {
  getAllowedOriginForCors,
  getAllowedOrigins,
  getRequestOrigin,
} from "../lib/cors-headers.ts";
import {
  getClinicPermissions,
  normalizeClinicUserRole,
} from "../lib/permissions.ts";
import { shouldRefreshSessionLastAccess } from "../lib/session-last-access.ts";
import {
  createListOverdueActiveSlaInstances,
  createSlaReadUseCases,
} from "../features/logistics/application/index.ts";

type ActiveSessionRecord = {
  clinicUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type ClinicUserRecord = {
  id: number;
  clinicId: number;
  username: string;
  authProId?: string | null;
  role?: ClinicUserRole | null;
};

type AuthenticatedClinicUser = {
  id: number;
  clinicId: number;
  username: string;
  authProId: string | null;
  role: ClinicUserRole;
  sessionToken: string;
};

export type LogisticsSlaNativeRoutesOptions = {
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<ActiveSessionRecord | null | undefined>;
  getClinicUserById?: (
    clinicUserId: number,
  ) => Promise<ClinicUserRecord | null | undefined>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  listActiveClinicSlaPolicies?: (
    params: ListActiveClinicSlaPoliciesParams,
  ) => Promise<SlaPolicy[]>;
  listClinicSlaInstances?: (
    params: ListClinicSlaInstancesParams,
  ) => Promise<SlaInstance[]>;
  listOverdueActiveClinicSlaInstances?: (
    params: ListOverdueActiveClinicSlaInstancesParams,
  ) => Promise<SlaInstance[]>;
  getClinicSlaSummary?: (clinicId: number) => Promise<ClinicSlaSummary>;
  now?: () => number;
};

type NativeLogisticsSlaDeps = Required<
  Pick<
    LogisticsSlaNativeRoutesOptions,
    | "deleteActiveSession"
    | "getActiveSessionByToken"
    | "getClinicUserById"
    | "updateSessionLastAccess"
    | "hashSessionToken"
    | "listActiveClinicSlaPolicies"
    | "listClinicSlaInstances"
    | "listOverdueActiveClinicSlaInstances"
    | "getClinicSlaSummary"
  >
>;


let defaultDepsPromise: Promise<NativeLogisticsSlaDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeLogisticsSlaDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const slaDb = (
        await import(
          "../features/logistics/infrastructure/logistics-sla-db-adapter.ts"
        )
      ).createLogisticsSlaDbAdapter();

      return {
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        updateSessionLastAccess: db.updateSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        listActiveClinicSlaPolicies: slaDb.listActiveClinicSlaPolicies,
        listClinicSlaInstances: slaDb.listClinicSlaInstances,
        listOverdueActiveClinicSlaInstances:
          slaDb.listOverdueActiveClinicSlaInstances,
        getClinicSlaSummary: slaDb.getClinicSlaSummary,
      };
    })();
  }

  const depsPromise = defaultDepsPromise;

  if (!depsPromise) {
    throw new Error("No se pudieron cargar las dependencias SLA logisticas");
  }

  return depsPromise;
}

function applyCorsHeaders(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: ReadonlySet<string>,
): void {
  const allowedOrigin = getAllowedOriginForCors(request, allowedOrigins);

  if (!allowedOrigin) {
    return;
  }

  reply.header("vary", "Origin");
  reply.header("access-control-allow-origin", allowedOrigin);
  reply.header("access-control-allow-credentials", "true");
}


function enforceLogisticsPermission(
  reply: FastifyReply,
  allowed: boolean,
): boolean {
  if (allowed) {
    return true;
  }

  reply.code(403).send({
    success: false,
    error: "Permisos insuficientes para logistica",
  });

  return false;
}

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
}): string {
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

function buildClearSessionCookie(): string {
  return serializeCookie({
    name: ENV.cookieName,
    value: "",
    maxAgeSeconds: 0,
    expires: "Thu, 01 Jan 1970 00:00:00 GMT",
  });
}

async function authenticateClinicUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeLogisticsSlaDeps,
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
      error: "Sesion invalida",
    });
    return null;
  }

  if (session.expiresAt && session.expiresAt.getTime() <= now()) {
    await deps.deleteActiveSession(tokenHash);

    reply.header("set-cookie", buildClearSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Sesion expirada",
    });
    return null;
  }

  const clinicUser = await deps.getClinicUserById(session.clinicUserId);

  if (!clinicUser) {
    await deps.deleteActiveSession(tokenHash);

    reply.header("set-cookie", buildClearSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Usuario de sesion no encontrado",
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
  };
}

function parsePositiveInt(
  value: unknown,
  defaultValue: number,
  maxValue: number,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.min(parsed, maxValue);
}

function parseOffset(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function parseOptionalEntityId(
  value: unknown,
  fieldName: string,
): { value?: number; error?: string } {
  if (value == null || value === "") {
    return {};
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return {
      error: `${fieldName} debe ser un entero positivo`,
    };
  }

  return { value: parsed };
}

function parseSlaTargetType(
  value: unknown,
): { value?: SlaTargetType; error?: string } {
  if (value == null || value === "") {
    return {};
  }

  if (typeof value !== "string") {
    return { error: "targetType invalido" };
  }

  const normalized = value.trim();

  if (SLA_TARGET_TYPES.includes(normalized as SlaTargetType)) {
    return { value: normalized as SlaTargetType };
  }

  return { error: "targetType invalido" };
}

function parseSlaInstanceStatus(
  value: unknown,
): { value?: SlaInstanceStatus; error?: string } {
  if (value == null || value === "") {
    return {};
  }

  if (typeof value !== "string") {
    return { error: "status invalido" };
  }

  const normalized = value.trim();

  if (SLA_INSTANCE_STATUSES.includes(normalized as SlaInstanceStatus)) {
    return { value: normalized as SlaInstanceStatus };
  }

  return { error: "status invalido" };
}

function buildListSlaPoliciesParams(
  query: {
    targetType?: unknown;
    limit?: unknown;
    offset?: unknown;
  },
  clinicId: number,
): { params?: ListActiveClinicSlaPoliciesParams; error?: string } {
  const targetType = parseSlaTargetType(query.targetType);

  if (targetType.error) {
    return { error: targetType.error };
  }

  return {
    params: {
      clinicId,
      targetType: targetType.value,
      limit: parsePositiveInt(query.limit, 50, 100),
      offset: parseOffset(query.offset),
    },
  };
}

function parseOptionalDate(
  value: unknown,
  fieldName: string,
): { value?: Date; error?: string } {
  if (value == null || value === "") {
    return {};
  }

  if (typeof value !== "string") {
    return { error: `${fieldName} invalido` };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { error: `${fieldName} invalido` };
  }

  return { value: date };
}

function buildListOverdueSlaInstancesParams(
  query: {
    dueAtOrBefore?: unknown;
    targetType?: unknown;
    limit?: unknown;
    offset?: unknown;
  },
  clinicId: number,
  now: () => number,
): { params?: ListOverdueActiveClinicSlaInstancesParams; error?: string } {
  const dueAtOrBefore = parseOptionalDate(
    query.dueAtOrBefore,
    "dueAtOrBefore",
  );

  if (dueAtOrBefore.error) {
    return { error: dueAtOrBefore.error };
  }

  const targetType = parseSlaTargetType(query.targetType);

  if (targetType.error) {
    return { error: targetType.error };
  }

  return {
    params: {
      clinicId,
      dueAtOrBefore: dueAtOrBefore.value ?? new Date(now()),
      targetType: targetType.value,
      limit: parsePositiveInt(query.limit, 50, 100),
      offset: parseOffset(query.offset),
    },
  };
}

function buildListSlaInstancesParams(
  query: {
    status?: unknown;
    targetType?: unknown;
    targetId?: unknown;
    limit?: unknown;
    offset?: unknown;
  },
  clinicId: number,
): { params?: ListClinicSlaInstancesParams; error?: string } {
  const status = parseSlaInstanceStatus(query.status);

  if (status.error) {
    return { error: status.error };
  }

  const targetType = parseSlaTargetType(query.targetType);

  if (targetType.error) {
    return { error: targetType.error };
  }

  const targetId = parseOptionalEntityId(query.targetId, "targetId");

  if (targetId.error) {
    return { error: targetId.error };
  }

  return {
    params: {
      clinicId,
      status: status.value,
      targetType: targetType.value,
      targetId: targetId.value,
      limit: parsePositiveInt(query.limit, 50, 100),
      offset: parseOffset(query.offset),
    },
  };
}

function serializeRecordDates(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    output[key] = value instanceof Date ? value.toISOString() : value;
  }

  return output;
}

function serializeSlaPolicy(slaPolicy: SlaPolicy): Record<string, unknown> {
  return serializeRecordDates(slaPolicy as unknown as Record<string, unknown>);
}

function serializeSlaInstance(slaInstance: SlaInstance): Record<string, unknown> {
  return serializeRecordDates(slaInstance as unknown as Record<string, unknown>);
}

export const logisticsSlaNativeRoutes: FastifyPluginAsync<
  LogisticsSlaNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.updateSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.listActiveClinicSlaPolicies &&
    !!options.listClinicSlaInstances &&
    !!options.listOverdueActiveClinicSlaInstances &&
    !!options.getClinicSlaSummary;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeLogisticsSlaDeps = {
    deleteActiveSession:
      options.deleteActiveSession ?? defaultDeps!.deleteActiveSession,
    getActiveSessionByToken:
      options.getActiveSessionByToken ?? defaultDeps!.getActiveSessionByToken,
    getClinicUserById:
      options.getClinicUserById ?? defaultDeps!.getClinicUserById,
    updateSessionLastAccess:
      options.updateSessionLastAccess ?? defaultDeps!.updateSessionLastAccess,
    hashSessionToken:
      options.hashSessionToken ?? defaultDeps!.hashSessionToken,
    listActiveClinicSlaPolicies:
      options.listActiveClinicSlaPolicies ??
      defaultDeps!.listActiveClinicSlaPolicies,
    listClinicSlaInstances:
      options.listClinicSlaInstances ?? defaultDeps!.listClinicSlaInstances,
    listOverdueActiveClinicSlaInstances:
      options.listOverdueActiveClinicSlaInstances ??
      defaultDeps!.listOverdueActiveClinicSlaInstances,
    getClinicSlaSummary:
      options.getClinicSlaSummary ?? defaultDeps!.getClinicSlaSummary,
  };

  // Adaptador M06: el puerto de lectura de application se construye una sola
  // vez por registro del plugin desde el seam de deps ya resuelto.
  const listOverdueActiveSlaInstances = createListOverdueActiveSlaInstances({
    listOverdueActiveClinicSlaInstances: deps.listOverdueActiveClinicSlaInstances,
  });

  // Casos de uso M16: las tres lecturas restantes (políticas, instancias y
  // summary) se componen una sola vez por registro del plugin desde el seam de
  // deps ya resuelto. La lectura overdue queda en el caso de uso M06.
  const slaReads = createSlaReadUseCases({
    listActiveClinicSlaPolicies: deps.listActiveClinicSlaPolicies,
    listClinicSlaInstances: deps.listClinicSlaInstances,
    getClinicSlaSummary: deps.getClinicSlaSummary,
  });

  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(getAllowedOrigins());

  app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply, allowedOrigins);
    return undefined;
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
    reply.header("access-control-allow-methods", "GET,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/policies", optionsHandler);
  app.options("/instances", optionsHandler);
  app.options("/summary", optionsHandler);
  app.options("/overdue", optionsHandler);

  app.get<{
    Querystring: {
      dueAtOrBefore?: unknown;
      targetType?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
  }>("/overdue", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    if (
      !enforceLogisticsPermission(
        reply,
        getClinicPermissions(auth.role).canViewLogisticsSla,
      )
    ) {
      return reply;
    }

    const parsed = buildListOverdueSlaInstancesParams(
      request.query,
      auth.clinicId,
      now,
    );

    if (!parsed.params) {
      return reply.code(400).send({
        success: false,
        error: parsed.error ?? "Parametros invalidos",
      });
    }

    const instances = await listOverdueActiveSlaInstances(parsed.params);

    return reply.code(200).send({
      success: true,
      count: instances.length,
      instances: instances.map((instance) => serializeSlaInstance(instance)),
      pagination: {
        limit: parsed.params.limit,
        offset: parsed.params.offset,
      },
      dueAtOrBefore: parsed.params.dueAtOrBefore.toISOString(),
    });
  });

  app.get("/summary", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    if (
      !enforceLogisticsPermission(
        reply,
        getClinicPermissions(auth.role).canViewLogisticsSla,
      )
    ) {
      return reply;
    }

    const summary = await slaReads.getSummary(auth.clinicId);

    return reply.code(200).send({
      success: true,
      summary,
    });
  });

  app.get<{
    Querystring: {
      targetType?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
  }>("/policies", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    if (
      !enforceLogisticsPermission(
        reply,
        getClinicPermissions(auth.role).canViewLogisticsSla,
      )
    ) {
      return reply;
    }

    const parsed = buildListSlaPoliciesParams(request.query, auth.clinicId);

    if (!parsed.params) {
      return reply.code(400).send({
        success: false,
        error: parsed.error ?? "Parametros invalidos",
      });
    }

    const policies = await slaReads.listActivePolicies(parsed.params);

    return reply.code(200).send({
      success: true,
      count: policies.length,
      policies: policies.map((policy) => serializeSlaPolicy(policy)),
      pagination: {
        limit: parsed.params.limit,
        offset: parsed.params.offset,
      },
    });
  });

  app.get<{
    Querystring: {
      status?: unknown;
      targetType?: unknown;
      targetId?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
  }>("/instances", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    if (
      !enforceLogisticsPermission(
        reply,
        getClinicPermissions(auth.role).canViewLogisticsSla,
      )
    ) {
      return reply;
    }

    const parsed = buildListSlaInstancesParams(request.query, auth.clinicId);

    if (!parsed.params) {
      return reply.code(400).send({
        success: false,
        error: parsed.error ?? "Parametros invalidos",
      });
    }

    const instances = await slaReads.listInstances(parsed.params);

    return reply.code(200).send({
      success: true,
      count: instances.length,
      instances: instances.map((instance) => serializeSlaInstance(instance)),
      pagination: {
        limit: parsed.params.limit,
        offset: parsed.params.offset,
      },
    });
  });
};
