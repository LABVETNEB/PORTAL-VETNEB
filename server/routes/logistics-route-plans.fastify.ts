import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  ROUTE_PLAN_OBJECTIVES,
  ROUTE_PLANNING_MODES,
  ROUTE_PLAN_STATUSES,
  ROUTE_STOP_STATUSES,
  type RoutePlanObjective,
  type RoutePlanningMode,
  type RoutePlanStatus,
  type RouteStopStatus,
} from "../../drizzle/schema.ts";
import type {
  CreateRoutePlanInput,
  CreateRouteStopInput,
  ListRoutePlansParams,
  RoutePlan,
  RoutePlanLifecycleAction,
  RoutePlanLifecycleTransitionResult,
  RouteStop,
  UpdateRoutePlanInput,
  UpdateRouteStopInput,
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

export type LogisticsRoutePlansNativeRoutesOptions = {
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<ActiveSessionRecord | null | undefined>;
  getClinicUserById?: (
    clinicUserId: number,
  ) => Promise<ClinicUserRecord | null | undefined>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  createRoutePlan?: (
    input: CreateRoutePlanInput,
  ) => Promise<RoutePlan | null | undefined>;
  getClinicScopedRoutePlan?: (
    id: number,
    clinicId: number,
  ) => Promise<RoutePlan | null | undefined>;
  listClinicRoutePlans?: (
    params: ListRoutePlansParams,
  ) => Promise<RoutePlan[]>;
  updateClinicScopedRoutePlan?: (
    id: number,
    clinicId: number,
    input: UpdateRoutePlanInput,
  ) => Promise<RoutePlan | null | undefined>;
  createRouteStopForClinicRoutePlan?: (
    input: CreateRouteStopInput,
  ) => Promise<RouteStop | null | undefined>;
  listRouteStopsForClinicRoutePlan?: (
    routePlanId: number,
    clinicId: number,
  ) => Promise<RouteStop[]>;
  updateClinicScopedRouteStop?: (
    id: number,
    clinicId: number,
    input: UpdateRouteStopInput,
  ) => Promise<RouteStop | null | undefined>;
  transitionClinicScopedRoutePlanStatus?: (
    id: number,
    clinicId: number,
    action: RoutePlanLifecycleAction,
  ) => Promise<RoutePlanLifecycleTransitionResult>;
  now?: () => number;
};

type NativeLogisticsRoutePlansDeps = Required<
  Pick<
    LogisticsRoutePlansNativeRoutesOptions,
    | "deleteActiveSession"
    | "getActiveSessionByToken"
    | "getClinicUserById"
    | "updateSessionLastAccess"
    | "hashSessionToken"
    | "createRoutePlan"
    | "getClinicScopedRoutePlan"
    | "listClinicRoutePlans"
    | "updateClinicScopedRoutePlan"
    | "createRouteStopForClinicRoutePlan"
    | "listRouteStopsForClinicRoutePlan"
    | "updateClinicScopedRouteStop"
    | "transitionClinicScopedRoutePlanStatus"
  >
>;

const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let defaultDepsPromise: Promise<NativeLogisticsRoutePlansDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeLogisticsRoutePlansDeps> {
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
        createRoutePlan: dbLogistics.createRoutePlan,
        getClinicScopedRoutePlan: dbLogistics.getClinicScopedRoutePlan,
        listClinicRoutePlans: dbLogistics.listClinicRoutePlans,
        updateClinicScopedRoutePlan: dbLogistics.updateClinicScopedRoutePlan,
        createRouteStopForClinicRoutePlan:
          dbLogistics.createRouteStopForClinicRoutePlan,
        listRouteStopsForClinicRoutePlan:
          dbLogistics.listRouteStopsForClinicRoutePlan,
        updateClinicScopedRouteStop:
          dbLogistics.updateClinicScopedRouteStop,
        transitionClinicScopedRoutePlanStatus:
          dbLogistics.transitionClinicScopedRoutePlanStatus,
      };
    })();
  }

  const depsPromise = defaultDepsPromise;

  if (!depsPromise) {
    throw new Error("No se pudieron cargar las dependencias de planes de ruta");
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
  deps: NativeLogisticsRoutePlansDeps,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function parseNonNegativeNumberField(
  value: unknown,
  fieldName: string,
): { value?: number; error?: string } {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0) {
    return { error: `${fieldName} debe ser numerico mayor o igual a cero` };
  }

  return { value: parsed };
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

function parsePositiveIntegerField(
  value: unknown,
  fieldName: string,
): { value?: number; error?: string } {
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

function parseDateField(
  value: unknown,
  fieldName: string,
): { value?: Date; error?: string } {
  if (typeof value !== "string" && typeof value !== "number") {
    return { error: `${fieldName} debe ser una fecha valida` };
  }

  const parsed = new Date(value);

  if (!Number.isFinite(parsed.getTime())) {
    return { error: `${fieldName} debe ser una fecha valida` };
  }

  return { value: parsed };
}

function parseOptionalDateField(
  value: unknown,
  fieldName: string,
): { value?: Date | null; error?: string } {
  if (value == null || value === "") {
    return { value: null };
  }

  return parseDateField(value, fieldName);
}

function parseRoutePlanStatus(
  value: unknown,
): { value?: RoutePlanStatus; error?: string } {
  if (value == null || value === "") {
    return {};
  }

  if (typeof value !== "string") {
    return { error: "status invalido" };
  }

  const normalized = value.trim();

  if (ROUTE_PLAN_STATUSES.includes(normalized as RoutePlanStatus)) {
    return { value: normalized as RoutePlanStatus };
  }

  return { error: "status invalido" };
}

function parseRoutePlanningMode(
  value: unknown,
): { value?: RoutePlanningMode; error?: string } {
  if (value == null || value === "") {
    return {};
  }

  if (typeof value !== "string") {
    return { error: "planningMode invalido" };
  }

  const normalized = value.trim();

  if (ROUTE_PLANNING_MODES.includes(normalized as RoutePlanningMode)) {
    return { value: normalized as RoutePlanningMode };
  }

  return { error: "planningMode invalido" };
}

function parseRoutePlanObjective(
  value: unknown,
): { value?: RoutePlanObjective; error?: string } {
  if (value == null || value === "") {
    return {};
  }

  if (typeof value !== "string") {
    return { error: "objective invalido" };
  }

  const normalized = value.trim();

  if (ROUTE_PLAN_OBJECTIVES.includes(normalized as RoutePlanObjective)) {
    return { value: normalized as RoutePlanObjective };
  }

  return { error: "objective invalido" };
}

function parseRouteStopStatus(
  value: unknown,
): { value?: RouteStopStatus; error?: string } {
  if (value == null || value === "") {
    return {};
  }

  if (typeof value !== "string") {
    return { error: "status invalido" };
  }

  const normalized = value.trim();

  if (ROUTE_STOP_STATUSES.includes(normalized as RouteStopStatus)) {
    return { value: normalized as RouteStopStatus };
  }

  return { error: "status invalido" };
}

function buildCreateRoutePlanInput(
  body: unknown,
  clinicId: number,
): { input?: CreateRoutePlanInput; error?: string } {
  if (!isRecord(body)) {
    return { error: "Body invalido" };
  }

  const serviceDate = parseDateField(body.serviceDate, "serviceDate");

  if (serviceDate.error || !serviceDate.value) {
    return { error: serviceDate.error ?? "serviceDate invalido" };
  }

  const status = parseRoutePlanStatus(body.status);

  if (status.error) {
    return { error: status.error };
  }

  const planningMode = parseRoutePlanningMode(body.planningMode);

  if (planningMode.error) {
    return { error: planningMode.error };
  }

  const objective = parseRoutePlanObjective(body.objective);

  if (objective.error) {
    return { error: objective.error };
  }

  const totalPlannedKm = parseNonNegativeNumberField(
    body.totalPlannedKm ?? 0,
    "totalPlannedKm",
  );

  if (totalPlannedKm.error) {
    return { error: totalPlannedKm.error };
  }

  const totalPlannedMin = parseNonNegativeIntegerField(
    body.totalPlannedMin ?? 0,
    "totalPlannedMin",
  );

  if (totalPlannedMin.error) {
    return { error: totalPlannedMin.error };
  }

  const createdById = parsePositiveIntegerOrNullField(
    body.createdById,
    "createdById",
  );

  if (createdById.error) {
    return { error: createdById.error };
  }

  return {
    input: {
      clinicId,
      serviceDate: serviceDate.value,
      status: status.value,
      planningMode: planningMode.value,
      objective: objective.value,
      totalPlannedKm: totalPlannedKm.value,
      totalPlannedMin: totalPlannedMin.value,
      createdByType: "clinic",
      createdById: createdById.value,
    },
  };
}

function buildUpdateRoutePlanInput(
  body: unknown,
): { input?: UpdateRoutePlanInput; error?: string } {
  if (!isRecord(body)) {
    return { error: "Body invalido" };
  }

  const input: UpdateRoutePlanInput = {};

  if ("serviceDate" in body) {
    const serviceDate = parseDateField(body.serviceDate, "serviceDate");

    if (serviceDate.error || !serviceDate.value) {
      return { error: serviceDate.error ?? "serviceDate invalido" };
    }

    input.serviceDate = serviceDate.value;
  }

  if ("status" in body) {
    const status = parseRoutePlanStatus(body.status);

    if (status.error) {
      return { error: status.error };
    }

    input.status = status.value;
  }

  if ("planningMode" in body) {
    const planningMode = parseRoutePlanningMode(body.planningMode);

    if (planningMode.error) {
      return { error: planningMode.error };
    }

    input.planningMode = planningMode.value;
  }

  if ("objective" in body) {
    const objective = parseRoutePlanObjective(body.objective);

    if (objective.error) {
      return { error: objective.error };
    }

    input.objective = objective.value;
  }

  if ("totalPlannedKm" in body) {
    const totalPlannedKm = parseNonNegativeNumberField(
      body.totalPlannedKm,
      "totalPlannedKm",
    );

    if (totalPlannedKm.error) {
      return { error: totalPlannedKm.error };
    }

    input.totalPlannedKm = totalPlannedKm.value;
  }

  if ("totalPlannedMin" in body) {
    const totalPlannedMin = parseNonNegativeIntegerField(
      body.totalPlannedMin,
      "totalPlannedMin",
    );

    if (totalPlannedMin.error) {
      return { error: totalPlannedMin.error };
    }

    input.totalPlannedMin = totalPlannedMin.value;
  }

  if (Object.keys(input).length === 0) {
    return { error: "No hay cambios para aplicar" };
  }

  return { input };
}

function buildCreateRouteStopInput(
  body: unknown,
  routePlanId: number,
  clinicId: number,
): { input?: CreateRouteStopInput; error?: string } {
  if (!isRecord(body)) {
    return { error: "Body invalido" };
  }

  const fieldVisitId = parsePositiveIntegerField(
    body.fieldVisitId,
    "fieldVisitId",
  );

  if (fieldVisitId.error || !fieldVisitId.value) {
    return { error: fieldVisitId.error ?? "fieldVisitId invalido" };
  }

  const sequence = parsePositiveIntegerField(body.sequence, "sequence");

  if (sequence.error || !sequence.value) {
    return { error: sequence.error ?? "sequence invalido" };
  }

  const etaStart = parseOptionalDateField(body.etaStart, "etaStart");

  if (etaStart.error) {
    return { error: etaStart.error };
  }

  const etaEnd = parseOptionalDateField(body.etaEnd, "etaEnd");

  if (etaEnd.error) {
    return { error: etaEnd.error };
  }

  const plannedKmFromPrev = parseNonNegativeNumberField(
    body.plannedKmFromPrev ?? 0,
    "plannedKmFromPrev",
  );

  if (plannedKmFromPrev.error) {
    return { error: plannedKmFromPrev.error };
  }

  const plannedMinFromPrev = parseNonNegativeIntegerField(
    body.plannedMinFromPrev ?? 0,
    "plannedMinFromPrev",
  );

  if (plannedMinFromPrev.error) {
    return { error: plannedMinFromPrev.error };
  }

  const status = parseRouteStopStatus(body.status);

  if (status.error) {
    return { error: status.error };
  }

  return {
    input: {
      routePlanId,
      clinicId,
      fieldVisitId: fieldVisitId.value,
      sequence: sequence.value,
      etaStart: etaStart.value,
      etaEnd: etaEnd.value,
      plannedKmFromPrev: plannedKmFromPrev.value,
      plannedMinFromPrev: plannedMinFromPrev.value,
      status: status.value,
    },
  };
}

function buildUpdateRouteStopInput(
  body: unknown,
): { input?: UpdateRouteStopInput; error?: string } {
  if (!isRecord(body)) {
    return { error: "Body invalido" };
  }

  const input: UpdateRouteStopInput = {};

  if ("sequence" in body) {
    const sequence = parsePositiveIntegerField(body.sequence, "sequence");

    if (sequence.error) {
      return { error: sequence.error };
    }

    input.sequence = sequence.value;
  }

  if ("etaStart" in body) {
    const etaStart = parseOptionalDateField(body.etaStart, "etaStart");

    if (etaStart.error) {
      return { error: etaStart.error };
    }

    input.etaStart = etaStart.value;
  }

  if ("etaEnd" in body) {
    const etaEnd = parseOptionalDateField(body.etaEnd, "etaEnd");

    if (etaEnd.error) {
      return { error: etaEnd.error };
    }

    input.etaEnd = etaEnd.value;
  }

  if ("plannedKmFromPrev" in body) {
    const plannedKmFromPrev = parseNonNegativeNumberField(
      body.plannedKmFromPrev,
      "plannedKmFromPrev",
    );

    if (plannedKmFromPrev.error) {
      return { error: plannedKmFromPrev.error };
    }

    input.plannedKmFromPrev = plannedKmFromPrev.value;
  }

  if ("plannedMinFromPrev" in body) {
    const plannedMinFromPrev = parseNonNegativeIntegerField(
      body.plannedMinFromPrev,
      "plannedMinFromPrev",
    );

    if (plannedMinFromPrev.error) {
      return { error: plannedMinFromPrev.error };
    }

    input.plannedMinFromPrev = plannedMinFromPrev.value;
  }

  if ("actualArrival" in body) {
    const actualArrival = parseOptionalDateField(
      body.actualArrival,
      "actualArrival",
    );

    if (actualArrival.error) {
      return { error: actualArrival.error };
    }

    input.actualArrival = actualArrival.value;
  }

  if ("actualDeparture" in body) {
    const actualDeparture = parseOptionalDateField(
      body.actualDeparture,
      "actualDeparture",
    );

    if (actualDeparture.error) {
      return { error: actualDeparture.error };
    }

    input.actualDeparture = actualDeparture.value;
  }

  if ("actualKmFromPrev" in body) {
    const actualKmFromPrev = parseNonNegativeNumberField(
      body.actualKmFromPrev,
      "actualKmFromPrev",
    );

    if (actualKmFromPrev.error) {
      return { error: actualKmFromPrev.error };
    }

    input.actualKmFromPrev = actualKmFromPrev.value;
  }

  if ("status" in body) {
    const status = parseRouteStopStatus(body.status);

    if (status.error) {
      return { error: status.error };
    }

    input.status = status.value;
  }

  if (Object.keys(input).length === 0) {
    return { error: "No hay cambios para aplicar" };
  }

  return { input };
}



function getLifecycleActionError(
  result: RoutePlanLifecycleTransitionResult,
): { statusCode: number; error: string } {
  if (result.reason === "not_found") {
    return {
      statusCode: 404,
      error: "Plan de ruta no encontrado",
    };
  }

  if (result.reason === "invalid_transition") {
    return {
      statusCode: 409,
      error: "Transicion de estado no permitida",
    };
  }

  return {
    statusCode: 500,
    error: "No se pudo cambiar el estado del plan de ruta",
  };
}


function serializeDate(value: Date | null | undefined): string | null {
  if (!(value instanceof Date)) {
    return null;
  }

  return value.toISOString();
}

function serializeRoutePlan(routePlan: RoutePlan): Record<string, unknown> {
  return {
    id: routePlan.id,
    clinicId: routePlan.clinicId,
    serviceDate: serializeDate(routePlan.serviceDate),
    status: routePlan.status,
    planningMode: routePlan.planningMode,
    objective: routePlan.objective,
    totalPlannedKm: routePlan.totalPlannedKm,
    totalPlannedMin: routePlan.totalPlannedMin,
    createdByType: routePlan.createdByType,
    createdById: routePlan.createdById,
    createdAt: serializeDate(routePlan.createdAt),
    updatedAt: serializeDate(routePlan.updatedAt),
  };
}

function serializeRouteStop(routeStop: RouteStop): Record<string, unknown> {
  return {
    id: routeStop.id,
    routePlanId: routeStop.routePlanId,
    fieldVisitId: routeStop.fieldVisitId,
    sequence: routeStop.sequence,
    etaStart: serializeDate(routeStop.etaStart),
    etaEnd: serializeDate(routeStop.etaEnd),
    plannedKmFromPrev: routeStop.plannedKmFromPrev,
    plannedMinFromPrev: routeStop.plannedMinFromPrev,
    actualArrival: serializeDate(routeStop.actualArrival),
    actualDeparture: serializeDate(routeStop.actualDeparture),
    actualKmFromPrev: routeStop.actualKmFromPrev,
    status: routeStop.status,
    createdAt: serializeDate(routeStop.createdAt),
    updatedAt: serializeDate(routeStop.updatedAt),
  };
}

export const logisticsRoutePlansNativeRoutes: FastifyPluginAsync<
  LogisticsRoutePlansNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.updateSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.createRoutePlan &&
    !!options.getClinicScopedRoutePlan &&
    !!options.listClinicRoutePlans &&
    !!options.updateClinicScopedRoutePlan &&
    !!options.createRouteStopForClinicRoutePlan &&
    !!options.listRouteStopsForClinicRoutePlan &&
    !!options.updateClinicScopedRouteStop &&
    !!options.transitionClinicScopedRoutePlanStatus;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeLogisticsRoutePlansDeps = {
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
    createRoutePlan:
      options.createRoutePlan ?? defaultDeps!.createRoutePlan,
    getClinicScopedRoutePlan:
      options.getClinicScopedRoutePlan ?? defaultDeps!.getClinicScopedRoutePlan,
    listClinicRoutePlans:
      options.listClinicRoutePlans ?? defaultDeps!.listClinicRoutePlans,
    updateClinicScopedRoutePlan:
      options.updateClinicScopedRoutePlan ??
      defaultDeps!.updateClinicScopedRoutePlan,
    createRouteStopForClinicRoutePlan:
      options.createRouteStopForClinicRoutePlan ??
      defaultDeps!.createRouteStopForClinicRoutePlan,
    listRouteStopsForClinicRoutePlan:
      options.listRouteStopsForClinicRoutePlan ??
      defaultDeps!.listRouteStopsForClinicRoutePlan,
    updateClinicScopedRouteStop:
      options.updateClinicScopedRouteStop ??
      defaultDeps!.updateClinicScopedRouteStop,
    transitionClinicScopedRoutePlanStatus:
      options.transitionClinicScopedRoutePlanStatus ??
      defaultDeps!.transitionClinicScopedRoutePlanStatus,
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
    reply.header("access-control-allow-methods", "GET,POST,PATCH,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/", optionsHandler);
  app.options("/:routePlanId", optionsHandler);
  app.options("/:routePlanId/stops", optionsHandler);
  app.options("/:routePlanId/stops/:routeStopId", optionsHandler);
  app.options("/:routePlanId/release", optionsHandler);
  app.options("/:routePlanId/start", optionsHandler);
  app.options("/:routePlanId/complete", optionsHandler);
  app.options("/:routePlanId/cancel", optionsHandler);

  app.get<{
    Querystring: {
      status?: unknown;
      planningMode?: unknown;
      objective?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
  }>("/", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const status = parseRoutePlanStatus(request.query.status);

    if (status.error) {
      return reply.code(400).send({
        success: false,
        error: status.error,
      });
    }

    const planningMode = parseRoutePlanningMode(request.query.planningMode);

    if (planningMode.error) {
      return reply.code(400).send({
        success: false,
        error: planningMode.error,
      });
    }

    const objective = parseRoutePlanObjective(request.query.objective);

    if (objective.error) {
      return reply.code(400).send({
        success: false,
        error: objective.error,
      });
    }

    const limit = parsePositiveInt(request.query.limit, 50, 100);
    const offset = parseOffset(request.query.offset);

    const params: ListRoutePlansParams = {
      clinicId: auth.clinicId,
      status: status.value,
      planningMode: planningMode.value,
      objective: objective.value,
      limit,
      offset,
    };

    const routePlans = await deps.listClinicRoutePlans(params);

    return reply.code(200).send({
      success: true,
      count: routePlans.length,
      routePlans: routePlans.map((routePlan) =>
        serializeRoutePlan(routePlan),
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

    const parsed = buildCreateRoutePlanInput(request.body, auth.clinicId);

    if (!parsed.input) {
      return reply.code(400).send({
        success: false,
        error: parsed.error ?? "Body invalido",
      });
    }

    const routePlan = await deps.createRoutePlan(parsed.input);

    if (!routePlan) {
      return reply.code(500).send({
        success: false,
        error: "No se pudo crear el plan de ruta",
      });
    }

    return reply.code(201).send({
      success: true,
      message: "Plan de ruta creado correctamente",
      routePlan: serializeRoutePlan(routePlan),
    });
  });

  app.get<{
    Params: {
      routePlanId: string;
    };
  }>("/:routePlanId", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const routePlanId = parseEntityId(request.params.routePlanId);

    if (!routePlanId) {
      return reply.code(400).send({
        success: false,
        error: "routePlanId invalido",
      });
    }

    const routePlan = await deps.getClinicScopedRoutePlan(
      routePlanId,
      auth.clinicId,
    );

    if (!routePlan) {
      return reply.code(404).send({
        success: false,
        error: "Plan de ruta no encontrado",
      });
    }

    return reply.code(200).send({
      success: true,
      routePlan: serializeRoutePlan(routePlan),
    });
  });

  app.patch<{
    Params: {
      routePlanId: string;
    };
    Body: unknown;
  }>("/:routePlanId", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const routePlanId = parseEntityId(request.params.routePlanId);

    if (!routePlanId) {
      return reply.code(400).send({
        success: false,
        error: "routePlanId invalido",
      });
    }

    const parsed = buildUpdateRoutePlanInput(request.body);

    if (!parsed.input) {
      return reply.code(400).send({
        success: false,
        error: parsed.error ?? "Body invalido",
      });
    }

    const routePlan = await deps.updateClinicScopedRoutePlan(
      routePlanId,
      auth.clinicId,
      parsed.input,
    );

    if (!routePlan) {
      return reply.code(404).send({
        success: false,
        error: "Plan de ruta no encontrado",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Plan de ruta actualizado correctamente",
      routePlan: serializeRoutePlan(routePlan),
    });
  });

  app.get<{
    Params: {
      routePlanId: string;
    };
  }>("/:routePlanId/stops", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const routePlanId = parseEntityId(request.params.routePlanId);

    if (!routePlanId) {
      return reply.code(400).send({
        success: false,
        error: "routePlanId invalido",
      });
    }

    const routeStops = await deps.listRouteStopsForClinicRoutePlan(
      routePlanId,
      auth.clinicId,
    );

    return reply.code(200).send({
      success: true,
      count: routeStops.length,
      routeStops: routeStops.map((routeStop) =>
        serializeRouteStop(routeStop),
      ),
    });
  });

  app.post<{
    Params: {
      routePlanId: string;
    };
    Body: unknown;
  }>("/:routePlanId/stops", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const routePlanId = parseEntityId(request.params.routePlanId);

    if (!routePlanId) {
      return reply.code(400).send({
        success: false,
        error: "routePlanId invalido",
      });
    }

    const parsed = buildCreateRouteStopInput(
      request.body,
      routePlanId,
      auth.clinicId,
    );

    if (!parsed.input) {
      return reply.code(400).send({
        success: false,
        error: parsed.error ?? "Body invalido",
      });
    }

    const routeStop = await deps.createRouteStopForClinicRoutePlan(
      parsed.input,
    );

    if (!routeStop) {
      return reply.code(404).send({
        success: false,
        error: "Plan de ruta o visita de campo no encontrado",
      });
    }

    return reply.code(201).send({
      success: true,
      message: "Parada de ruta creada correctamente",
      routeStop: serializeRouteStop(routeStop),
    });
  });

  app.patch<{
    Params: {
      routePlanId: string;
      routeStopId: string;
    };
    Body: unknown;
  }>("/:routePlanId/stops/:routeStopId", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const routePlanId = parseEntityId(request.params.routePlanId);
    const routeStopId = parseEntityId(request.params.routeStopId);

    if (!routePlanId) {
      return reply.code(400).send({
        success: false,
        error: "routePlanId invalido",
      });
    }

    if (!routeStopId) {
      return reply.code(400).send({
        success: false,
        error: "routeStopId invalido",
      });
    }

    const parsed = buildUpdateRouteStopInput(request.body);

    if (!parsed.input) {
      return reply.code(400).send({
        success: false,
        error: parsed.error ?? "Body invalido",
      });
    }

    const routeStop = await deps.updateClinicScopedRouteStop(
      routeStopId,
      auth.clinicId,
      parsed.input,
    );

    if (!routeStop || routeStop.routePlanId !== routePlanId) {
      return reply.code(404).send({
        success: false,
        error: "Parada de ruta no encontrada",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Parada de ruta actualizada correctamente",
      routeStop: serializeRouteStop(routeStop),
    });
  });

  async function handleRoutePlanLifecycleAction(
    action: RoutePlanLifecycleAction,
    request: FastifyRequest<{
      Params: {
        routePlanId: string;
      };
    }>,
    reply: FastifyReply,
  ) {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const routePlanId = parseEntityId(request.params.routePlanId);

    if (!routePlanId) {
      return reply.code(400).send({
        success: false,
        error: "routePlanId invalido",
      });
    }

    const result = await deps.transitionClinicScopedRoutePlanStatus(
      routePlanId,
      auth.clinicId,
      action,
    );

    if (!result.routePlan) {
      const error = getLifecycleActionError(result);

      return reply.code(error.statusCode).send({
        success: false,
        error: error.error,
        currentStatus: result.currentStatus,
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Estado del plan de ruta actualizado correctamente",
      action,
      routePlan: serializeRoutePlan(result.routePlan),
    });
  }

  app.post<{
    Params: {
      routePlanId: string;
    };
  }>("/:routePlanId/release", async (request, reply) =>
    handleRoutePlanLifecycleAction("release", request, reply),
  );

  app.post<{
    Params: {
      routePlanId: string;
    };
  }>("/:routePlanId/start", async (request, reply) =>
    handleRoutePlanLifecycleAction("start", request, reply),
  );

  app.post<{
    Params: {
      routePlanId: string;
    };
  }>("/:routePlanId/complete", async (request, reply) =>
    handleRoutePlanLifecycleAction("complete", request, reply),
  );

  app.post<{
    Params: {
      routePlanId: string;
    };
  }>("/:routePlanId/cancel", async (request, reply) =>
    handleRoutePlanLifecycleAction("cancel", request, reply),
  );

};
