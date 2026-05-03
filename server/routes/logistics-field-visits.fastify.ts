import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  FIELD_VISIT_SOURCE_TYPES,
  FIELD_VISIT_STATUSES,
  VISIT_LOCATION_GEO_QUALITIES,
  type FieldVisitSourceType,
  type FieldVisitStatus,
  type VisitLocationGeoQuality,
} from "../../drizzle/schema.ts";
import type {
  CreateFieldVisitInput,
  FieldVisit,
  ListFieldVisitsParams,
  UpdateFieldVisitInput,
  UpsertVisitLocationInput,
  VisitLocation,
} from "../db-logistics.ts";
import { ENV } from "../lib/env.ts";

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
};

type AuthenticatedClinicUser = {
  id: number;
  clinicId: number;
  username: string;
  authProId: string | null;
  sessionToken: string;
};

export type LogisticsFieldVisitsNativeRoutesOptions = {
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<ActiveSessionRecord | null | undefined>;
  getClinicUserById?: (
    clinicUserId: number,
  ) => Promise<ClinicUserRecord | null | undefined>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  createFieldVisit?: (
    input: CreateFieldVisitInput,
  ) => Promise<FieldVisit | null | undefined>;
  listClinicFieldVisits?: (
    params: ListFieldVisitsParams,
  ) => Promise<FieldVisit[]>;
  updateClinicScopedFieldVisit?: (
    id: number,
    clinicId: number,
    input: UpdateFieldVisitInput,
  ) => Promise<FieldVisit | null | undefined>;
  getVisitLocationForClinicVisit?: (
    fieldVisitId: number,
    clinicId: number,
  ) => Promise<VisitLocation | null | undefined>;
  upsertVisitLocationForClinicVisit?: (
    input: UpsertVisitLocationInput,
  ) => Promise<VisitLocation | null | undefined>;
  now?: () => number;
};

type NativeLogisticsFieldVisitsDeps = Required<
  Pick<
    LogisticsFieldVisitsNativeRoutesOptions,
    | "deleteActiveSession"
    | "getActiveSessionByToken"
    | "getClinicUserById"
    | "updateSessionLastAccess"
    | "hashSessionToken"
    | "createFieldVisit"
    | "listClinicFieldVisits"
    | "updateClinicScopedFieldVisit"
    | "getVisitLocationForClinicVisit"
    | "upsertVisitLocationForClinicVisit"
  >
>;

const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let defaultDepsPromise: Promise<NativeLogisticsFieldVisitsDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeLogisticsFieldVisitsDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const dbLogistics = await import("../db-logistics.ts");

      return {
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        updateSessionLastAccess: db.updateSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        createFieldVisit: dbLogistics.createFieldVisit,
        listClinicFieldVisits: dbLogistics.listClinicFieldVisits,
        updateClinicScopedFieldVisit:
          dbLogistics.updateClinicScopedFieldVisit,
        getVisitLocationForClinicVisit:
          dbLogistics.getVisitLocationForClinicVisit,
        upsertVisitLocationForClinicVisit:
          dbLogistics.upsertVisitLocationForClinicVisit,
      };
    })();
  }

  const depsPromise = defaultDepsPromise;

  if (!depsPromise) {
    throw new Error("No se pudieron cargar las dependencias de logistica");
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

  if (refererHeader) {
    return normalizeOrigin(refererHeader);
  }

  return null;
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

function enforceTrustedOrigin(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: ReadonlySet<string>,
): boolean {
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

function shouldRefreshSessionLastAccess(
  lastAccess: Date | null | undefined,
  nowMs: number,
): boolean {
  if (!(lastAccess instanceof Date)) {
    return true;
  }

  return nowMs - lastAccess.getTime() >= SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS;
}

async function authenticateClinicUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeLogisticsFieldVisitsDeps,
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

function parseEntityId(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeOptionalText(value: unknown): string | null | undefined {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseNonNegativeIntegerField(
  value: unknown,
  fieldName: string,
): { value?: number; error?: string } {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < 0) {
    return {
      error: `${fieldName} debe ser un entero mayor o igual a cero`,
    };
  }

  return { value: parsed };
}

function parsePositiveIntegerOrNullField(
  value: unknown,
  fieldName: string,
): { value?: number | null; error?: string } {
  if (value == null || value === "") {
    return { value: null };
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

function parseFieldVisitSourceType(
  value: unknown,
): { value?: FieldVisitSourceType; error?: string } {
  if (value == null || value === "") {
    return {};
  }

  if (typeof value !== "string") {
    return { error: "sourceType invalido" };
  }

  const normalized = value.trim();

  if (
    FIELD_VISIT_SOURCE_TYPES.includes(
      normalized as FieldVisitSourceType,
    )
  ) {
    return { value: normalized as FieldVisitSourceType };
  }

  return { error: "sourceType invalido" };
}

function parseFieldVisitStatus(
  value: unknown,
): { value?: FieldVisitStatus; error?: string } {
  if (value == null || value === "") {
    return {};
  }

  if (typeof value !== "string") {
    return { error: "status invalido" };
  }

  const normalized = value.trim();

  if (FIELD_VISIT_STATUSES.includes(normalized as FieldVisitStatus)) {
    return { value: normalized as FieldVisitStatus };
  }

  return { error: "status invalido" };
}

function buildCreateFieldVisitInput(
  body: unknown,
  clinicId: number,
): { input?: CreateFieldVisitInput; error?: string } {
  if (!isRecord(body)) {
    return { error: "Body invalido" };
  }

  const sourceType = parseFieldVisitSourceType(body.sourceType);

  if (sourceType.error) {
    return { error: sourceType.error };
  }

  const status = parseFieldVisitStatus(body.status);

  if (status.error) {
    return { error: status.error };
  }

  const sourceId = parsePositiveIntegerOrNullField(body.sourceId, "sourceId");

  if (sourceId.error) {
    return { error: sourceId.error };
  }

  const priority = parseNonNegativeIntegerField(
    body.priority ?? 0,
    "priority",
  );

  if (priority.error) {
    return { error: priority.error };
  }

  const serviceDurationMin = parseNonNegativeIntegerField(
    body.serviceDurationMin ?? 0,
    "serviceDurationMin",
  );

  if (serviceDurationMin.error) {
    return { error: serviceDurationMin.error };
  }

  const criticality = normalizeOptionalText(body.criticality);

  if (criticality === undefined) {
    return { error: "criticality debe ser texto o null" };
  }

  const notes = normalizeOptionalText(body.notes);

  if (notes === undefined) {
    return { error: "notes debe ser texto o null" };
  }

  return {
    input: {
      clinicId,
      sourceType: sourceType.value,
      sourceId: sourceId.value,
      status: status.value,
      priority: priority.value,
      criticality,
      serviceDurationMin: serviceDurationMin.value,
      notes,
    },
  };
}

function buildUpdateFieldVisitInput(
  body: unknown,
): { input?: UpdateFieldVisitInput; error?: string } {
  if (!isRecord(body)) {
    return { error: "Body invalido" };
  }

  const input: UpdateFieldVisitInput = {};

  if ("sourceType" in body) {
    const sourceType = parseFieldVisitSourceType(body.sourceType);

    if (sourceType.error) {
      return { error: sourceType.error };
    }

    input.sourceType = sourceType.value;
  }

  if ("sourceId" in body) {
    const sourceId = parsePositiveIntegerOrNullField(body.sourceId, "sourceId");

    if (sourceId.error) {
      return { error: sourceId.error };
    }

    input.sourceId = sourceId.value;
  }

  if ("status" in body) {
    const status = parseFieldVisitStatus(body.status);

    if (status.error) {
      return { error: status.error };
    }

    input.status = status.value;
  }

  if ("priority" in body) {
    const priority = parseNonNegativeIntegerField(body.priority, "priority");

    if (priority.error) {
      return { error: priority.error };
    }

    input.priority = priority.value;
  }

  if ("criticality" in body) {
    const criticality = normalizeOptionalText(body.criticality);

    if (criticality === undefined) {
      return { error: "criticality debe ser texto o null" };
    }

    input.criticality = criticality;
  }

  if ("serviceDurationMin" in body) {
    const serviceDurationMin = parseNonNegativeIntegerField(
      body.serviceDurationMin,
      "serviceDurationMin",
    );

    if (serviceDurationMin.error) {
      return { error: serviceDurationMin.error };
    }

    input.serviceDurationMin = serviceDurationMin.value;
  }

  if ("notes" in body) {
    const notes = normalizeOptionalText(body.notes);

    if (notes === undefined) {
      return { error: "notes debe ser texto o null" };
    }

    input.notes = notes;
  }

  if (Object.keys(input).length === 0) {
    return { error: "No hay cambios para aplicar" };
  }

  return { input };
}


function parseOptionalNumberField(
  value: unknown,
  fieldName: string,
): { value?: number | null; error?: string } {
  if (value == null || value === "") {
    return { value: null };
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return {
      error: `${fieldName} debe ser numerico o null`,
    };
  }

  return { value: parsed };
}

function parseVisitLocationGeoQuality(
  value: unknown,
): { value?: VisitLocationGeoQuality; error?: string } {
  if (value == null || value === "") {
    return {};
  }

  if (typeof value !== "string") {
    return { error: "geoQuality invalido" };
  }

  const normalized = value.trim();

  if (
    VISIT_LOCATION_GEO_QUALITIES.includes(
      normalized as VisitLocationGeoQuality,
    )
  ) {
    return { value: normalized as VisitLocationGeoQuality };
  }

  return { error: "geoQuality invalido" };
}

function buildUpsertVisitLocationInput(
  body: unknown,
  fieldVisitId: number,
  clinicId: number,
): { input?: UpsertVisitLocationInput; error?: string } {
  if (!isRecord(body)) {
    return { error: "Body invalido" };
  }

  const addressRaw = normalizeOptionalText(body.addressRaw);

  if (!addressRaw) {
    return { error: "addressRaw es obligatorio" };
  }

  const addressNormalized = normalizeOptionalText(body.addressNormalized);

  if (addressNormalized === undefined) {
    return { error: "addressNormalized debe ser texto o null" };
  }

  const locality = normalizeOptionalText(body.locality);

  if (locality === undefined) {
    return { error: "locality debe ser texto o null" };
  }

  const country = normalizeOptionalText(body.country);

  if (country === undefined) {
    return { error: "country debe ser texto o null" };
  }

  const lat = parseOptionalNumberField(body.lat, "lat");

  if (lat.error) {
    return { error: lat.error };
  }

  const lng = parseOptionalNumberField(body.lng, "lng");

  if (lng.error) {
    return { error: lng.error };
  }

  const geoQuality = parseVisitLocationGeoQuality(body.geoQuality);

  if (geoQuality.error) {
    return { error: geoQuality.error };
  }

  const geocodeSource = normalizeOptionalText(body.geocodeSource);

  if (geocodeSource === undefined) {
    return { error: "geocodeSource debe ser texto o null" };
  }

  return {
    input: {
      fieldVisitId,
      clinicId,
      addressRaw,
      addressNormalized,
      locality,
      country,
      lat: lat.value,
      lng: lng.value,
      geoQuality: geoQuality.value,
      geocodeSource,
    },
  };
}

function serializeVisitLocation(
  location: VisitLocation,
): Record<string, unknown> {
  return {
    id: location.id,
    fieldVisitId: location.fieldVisitId,
    addressRaw: location.addressRaw,
    addressNormalized: location.addressNormalized,
    locality: location.locality,
    country: location.country,
    lat: location.lat,
    lng: location.lng,
    geoQuality: location.geoQuality,
    geocodeSource: location.geocodeSource,
    updatedAt: serializeDate(location.updatedAt),
  };
}

function serializeDate(value: Date | null | undefined): string | null {
  if (!(value instanceof Date)) {
    return null;
  }

  return value.toISOString();
}

function serializeFieldVisit(fieldVisit: FieldVisit): Record<string, unknown> {
  return {
    id: fieldVisit.id,
    clinicId: fieldVisit.clinicId,
    sourceType: fieldVisit.sourceType,
    sourceId: fieldVisit.sourceId,
    status: fieldVisit.status,
    priority: fieldVisit.priority,
    criticality: fieldVisit.criticality,
    serviceDurationMin: fieldVisit.serviceDurationMin,
    notes: fieldVisit.notes,
    createdAt: serializeDate(fieldVisit.createdAt),
    updatedAt: serializeDate(fieldVisit.updatedAt),
  };
}

export const logisticsFieldVisitsNativeRoutes: FastifyPluginAsync<
  LogisticsFieldVisitsNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.updateSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.createFieldVisit &&
    !!options.listClinicFieldVisits &&
    !!options.updateClinicScopedFieldVisit &&
    !!options.getVisitLocationForClinicVisit &&
    !!options.upsertVisitLocationForClinicVisit;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeLogisticsFieldVisitsDeps = {
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
    createFieldVisit:
      options.createFieldVisit ?? defaultDeps!.createFieldVisit,
    listClinicFieldVisits:
      options.listClinicFieldVisits ?? defaultDeps!.listClinicFieldVisits,
    updateClinicScopedFieldVisit:
      options.updateClinicScopedFieldVisit ??
      defaultDeps!.updateClinicScopedFieldVisit,
    getVisitLocationForClinicVisit:
      options.getVisitLocationForClinicVisit ??
      defaultDeps!.getVisitLocationForClinicVisit,
    upsertVisitLocationForClinicVisit:
      options.upsertVisitLocationForClinicVisit ??
      defaultDeps!.upsertVisitLocationForClinicVisit,
  };

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
    reply.header("access-control-allow-methods", "GET,POST,PUT,PATCH,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/", optionsHandler);
  app.options("/:fieldVisitId", optionsHandler);
  app.options("/:fieldVisitId/location", optionsHandler);

  app.get<{
    Querystring: {
      status?: unknown;
      sourceType?: unknown;
      sourceId?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
  }>("/", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const status = parseFieldVisitStatus(request.query.status);

    if (status.error) {
      return reply.code(400).send({
        success: false,
        error: status.error,
      });
    }

    const sourceType = parseFieldVisitSourceType(request.query.sourceType);

    if (sourceType.error) {
      return reply.code(400).send({
        success: false,
        error: sourceType.error,
      });
    }

    const sourceId = parseEntityId(request.query.sourceId);
    const limit = parsePositiveInt(request.query.limit, 50, 100);
    const offset = parseOffset(request.query.offset);

    const params: ListFieldVisitsParams = {
      clinicId: auth.clinicId,
      status: status.value,
      sourceType: sourceType.value,
      sourceId,
      limit,
      offset,
    };

    const fieldVisits = await deps.listClinicFieldVisits(params);

    return reply.code(200).send({
      success: true,
      count: fieldVisits.length,
      fieldVisits: fieldVisits.map((fieldVisit) =>
        serializeFieldVisit(fieldVisit),
      ),
      pagination: {
        limit,
        offset,
      },
    });
  });

  app.post<{
    Body: unknown;
  }>("/", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const parsed = buildCreateFieldVisitInput(request.body, auth.clinicId);

    if (!parsed.input) {
      return reply.code(400).send({
        success: false,
        error: parsed.error ?? "Body invalido",
      });
    }

    const created = await deps.createFieldVisit(parsed.input);

    if (!created) {
      return reply.code(500).send({
        success: false,
        error: "No se pudo crear la visita de campo",
      });
    }

    return reply.code(201).send({
      success: true,
      message: "Visita de campo creada correctamente",
      fieldVisit: serializeFieldVisit(created),
    });
  });

  app.patch<{
    Params: {
      fieldVisitId: string;
    };
    Body: unknown;
  }>("/:fieldVisitId", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const fieldVisitId = parseEntityId(request.params.fieldVisitId);

    if (!fieldVisitId) {
      return reply.code(400).send({
        success: false,
        error: "fieldVisitId invalido",
      });
    }

    const parsed = buildUpdateFieldVisitInput(request.body);

    if (!parsed.input) {
      return reply.code(400).send({
        success: false,
        error: parsed.error ?? "Body invalido",
      });
    }

    const updated = await deps.updateClinicScopedFieldVisit(
      fieldVisitId,
      auth.clinicId,
      parsed.input,
    );

    if (!updated) {
      return reply.code(404).send({
        success: false,
        error: "Visita de campo no encontrada",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Visita de campo actualizada correctamente",
      fieldVisit: serializeFieldVisit(updated),
    });
  });

  app.get<{
    Params: {
      fieldVisitId: string;
    };
  }>("/:fieldVisitId/location", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const fieldVisitId = parseEntityId(request.params.fieldVisitId);

    if (!fieldVisitId) {
      return reply.code(400).send({
        success: false,
        error: "fieldVisitId invalido",
      });
    }

    const location = await deps.getVisitLocationForClinicVisit(
      fieldVisitId,
      auth.clinicId,
    );

    if (!location) {
      return reply.code(404).send({
        success: false,
        error: "Ubicacion de visita no encontrada",
      });
    }

    return reply.code(200).send({
      success: true,
      location: serializeVisitLocation(location),
    });
  });

  app.put<{
    Params: {
      fieldVisitId: string;
    };
    Body: unknown;
  }>("/:fieldVisitId/location", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const fieldVisitId = parseEntityId(request.params.fieldVisitId);

    if (!fieldVisitId) {
      return reply.code(400).send({
        success: false,
        error: "fieldVisitId invalido",
      });
    }

    const parsed = buildUpsertVisitLocationInput(
      request.body,
      fieldVisitId,
      auth.clinicId,
    );

    if (!parsed.input) {
      return reply.code(400).send({
        success: false,
        error: parsed.error ?? "Body invalido",
      });
    }

    const location = await deps.upsertVisitLocationForClinicVisit(parsed.input);

    if (!location) {
      return reply.code(404).send({
        success: false,
        error: "Visita de campo no encontrada",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Ubicacion de visita guardada correctamente",
      location: serializeVisitLocation(location),
    });
  });

};
