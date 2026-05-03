import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  ROUTE_EVENT_SOURCES,
  ROUTE_EVENT_TYPES,
  type RouteEventSource,
  type RouteEventType,
} from "../../drizzle/schema.ts";
import type {
  CreateRouteEventInput,
  ListRouteEventsParams,
  RouteEvent,
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

export type LogisticsRouteEventsNativeRoutesOptions = {
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<ActiveSessionRecord | null | undefined>;
  getClinicUserById?: (
    clinicUserId: number,
  ) => Promise<ClinicUserRecord | null | undefined>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  createRouteEvent?: (
    input: CreateRouteEventInput,
  ) => Promise<RouteEvent | null | undefined>;
  listClinicRouteEvents?: (
    params: ListRouteEventsParams,
  ) => Promise<RouteEvent[]>;
  listRouteEventsForClinicRoutePlan?: (
    routePlanId: number,
    clinicId: number,
    params?: Omit<ListRouteEventsParams, "clinicId" | "routePlanId">,
  ) => Promise<RouteEvent[]>;
  listIncrementalClinicRouteEvents?: (
    clinicId: number,
    afterId: number,
    limit?: number,
  ) => Promise<RouteEvent[]>;
  now?: () => number;
};

type NativeLogisticsRouteEventsDeps = Required<
  Pick<
    LogisticsRouteEventsNativeRoutesOptions,
    | "deleteActiveSession"
    | "getActiveSessionByToken"
    | "getClinicUserById"
    | "updateSessionLastAccess"
    | "hashSessionToken"
    | "createRouteEvent"
    | "listClinicRouteEvents"
    | "listRouteEventsForClinicRoutePlan"
    | "listIncrementalClinicRouteEvents"
  >
>;

const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let defaultDepsPromise: Promise<NativeLogisticsRouteEventsDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeLogisticsRouteEventsDeps> {
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
        createRouteEvent: dbLogistics.createRouteEvent,
        listClinicRouteEvents: dbLogistics.listClinicRouteEvents,
        listRouteEventsForClinicRoutePlan:
          dbLogistics.listRouteEventsForClinicRoutePlan,
        listIncrementalClinicRouteEvents:
          dbLogistics.listIncrementalClinicRouteEvents,
      };
    })();
  }

  const depsPromise = defaultDepsPromise;

  if (!depsPromise) {
    throw new Error("No se pudieron cargar las dependencias de eventos logisticos");
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
  deps: NativeLogisticsRouteEventsDeps,
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

function parseOptionalEntityId(
  value: unknown,
  fieldName: string,
): { value?: number; error?: string } {
  if (value == null || value === "") {
    return {};
  }

  const parsed = parseEntityId(value);

  if (!parsed) {
    return {
      error: `${fieldName} debe ser un entero positivo`,
    };
  }

  return { value: parsed };
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

function parseAfterId(value: unknown): number {
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

function parseDateField(
  value: unknown,
  fieldName: string,
): { value?: Date; error?: string } {
  if (value == null || value === "") {
    return {};
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return { error: `${fieldName} debe ser una fecha valida` };
  }

  const parsed = new Date(value);

  if (!Number.isFinite(parsed.getTime())) {
    return { error: `${fieldName} debe ser una fecha valida` };
  }

  return { value: parsed };
}

function parseRouteEventType(
  value: unknown,
): { value?: RouteEventType; error?: string } {
  if (value == null || value === "") {
    return {};
  }

  if (typeof value !== "string") {
    return { error: "eventType invalido" };
  }

  const normalized = value.trim();

  if (ROUTE_EVENT_TYPES.includes(normalized as RouteEventType)) {
    return { value: normalized as RouteEventType };
  }

  return { error: "eventType invalido" };
}

function parseRequiredRouteEventType(
  value: unknown,
): { value?: RouteEventType; error?: string } {
  const parsed = parseRouteEventType(value);

  if (parsed.error) {
    return parsed;
  }

  if (!parsed.value) {
    return { error: "eventType es obligatorio" };
  }

  return parsed;
}

function parseRouteEventSource(
  value: unknown,
): { value?: RouteEventSource; error?: string } {
  if (value == null || value === "") {
    return {};
  }

  if (typeof value !== "string") {
    return { error: "source invalido" };
  }

  const normalized = value.trim();

  if (ROUTE_EVENT_SOURCES.includes(normalized as RouteEventSource)) {
    return { value: normalized as RouteEventSource };
  }

  return { error: "source invalido" };
}

function parseRouteEventPayload(
  value: unknown,
): { value?: Record<string, unknown> | null; error?: string } {
  if (value == null) {
    return { value: null };
  }

  if (!isRecord(value)) {
    return { error: "payload debe ser objeto o null" };
  }

  return { value };
}

function buildCreateRouteEventInput(
  body: unknown,
  clinicId: number,
): { input?: CreateRouteEventInput; error?: string } {
  if (!isRecord(body)) {
    return { error: "Body invalido" };
  }

  const routePlanId = parseOptionalEntityId(body.routePlanId, "routePlanId");

  if (routePlanId.error) {
    return { error: routePlanId.error };
  }

  const routeStopId = parseOptionalEntityId(body.routeStopId, "routeStopId");

  if (routeStopId.error) {
    return { error: routeStopId.error };
  }

  const eventType = parseRequiredRouteEventType(body.eventType);

  if (eventType.error || !eventType.value) {
    return { error: eventType.error ?? "eventType invalido" };
  }

  const eventTime = parseDateField(body.eventTime, "eventTime");

  if (eventTime.error) {
    return { error: eventTime.error };
  }

  const payload = parseRouteEventPayload(body.payload);

  if (payload.error) {
    return { error: payload.error };
  }

  const lat = parseOptionalNumberField(body.lat, "lat");

  if (lat.error) {
    return { error: lat.error };
  }

  const lng = parseOptionalNumberField(body.lng, "lng");

  if (lng.error) {
    return { error: lng.error };
  }

  const source = parseRouteEventSource(body.source);

  if (source.error) {
    return { error: source.error };
  }

  return {
    input: {
      clinicId,
      routePlanId: routePlanId.value,
      routeStopId: routeStopId.value,
      eventType: eventType.value,
      eventTime: eventTime.value,
      payload: payload.value,
      lat: lat.value,
      lng: lng.value,
      source: source.value,
    },
  };
}

function buildListRouteEventsParams(
  query: {
    routePlanId?: unknown;
    routeStopId?: unknown;
    eventType?: unknown;
    afterId?: unknown;
    limit?: unknown;
    offset?: unknown;
  },
  clinicId: number,
): { params?: ListRouteEventsParams; error?: string } {
  const routePlanId = parseOptionalEntityId(query.routePlanId, "routePlanId");

  if (routePlanId.error) {
    return { error: routePlanId.error };
  }

  const routeStopId = parseOptionalEntityId(query.routeStopId, "routeStopId");

  if (routeStopId.error) {
    return { error: routeStopId.error };
  }

  const eventType = parseRouteEventType(query.eventType);

  if (eventType.error) {
    return { error: eventType.error };
  }

  return {
    params: {
      clinicId,
      routePlanId: routePlanId.value,
      routeStopId: routeStopId.value,
      eventType: eventType.value,
      afterId: parseAfterId(query.afterId),
      limit: parsePositiveInt(query.limit, 50, 100),
      offset: parseOffset(query.offset),
    },
  };
}

function serializeDate(value: Date | null | undefined): string | null {
  if (!(value instanceof Date)) {
    return null;
  }

  return value.toISOString();
}

function serializeRouteEvent(routeEvent: RouteEvent): Record<string, unknown> {
  return {
    id: routeEvent.id,
    clinicId: routeEvent.clinicId,
    routePlanId: routeEvent.routePlanId,
    routeStopId: routeEvent.routeStopId,
    eventType: routeEvent.eventType,
    eventTime: serializeDate(routeEvent.eventTime),
    payload: routeEvent.payload,
    lat: routeEvent.lat,
    lng: routeEvent.lng,
    source: routeEvent.source,
    createdAt: serializeDate(routeEvent.createdAt),
  };
}

export const logisticsRouteEventsNativeRoutes: FastifyPluginAsync<
  LogisticsRouteEventsNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.updateSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.createRouteEvent &&
    !!options.listClinicRouteEvents &&
    !!options.listRouteEventsForClinicRoutePlan &&
    !!options.listIncrementalClinicRouteEvents;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeLogisticsRouteEventsDeps = {
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
    createRouteEvent:
      options.createRouteEvent ?? defaultDeps!.createRouteEvent,
    listClinicRouteEvents:
      options.listClinicRouteEvents ?? defaultDeps!.listClinicRouteEvents,
    listRouteEventsForClinicRoutePlan:
      options.listRouteEventsForClinicRoutePlan ??
      defaultDeps!.listRouteEventsForClinicRoutePlan,
    listIncrementalClinicRouteEvents:
      options.listIncrementalClinicRouteEvents ??
      defaultDeps!.listIncrementalClinicRouteEvents,
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
    reply.header("access-control-allow-methods", "GET,POST,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/", optionsHandler);
  app.options("/poll", optionsHandler);
  app.options("/route-plans/:routePlanId", optionsHandler);

  app.get<{
    Querystring: {
      routePlanId?: unknown;
      routeStopId?: unknown;
      eventType?: unknown;
      afterId?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
  }>("/", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const parsed = buildListRouteEventsParams(request.query, auth.clinicId);

    if (!parsed.params) {
      return reply.code(400).send({
        success: false,
        error: parsed.error ?? "Parametros invalidos",
      });
    }

    const routeEvents = await deps.listClinicRouteEvents(parsed.params);

    return reply.code(200).send({
      success: true,
      count: routeEvents.length,
      routeEvents: routeEvents.map((routeEvent) =>
        serializeRouteEvent(routeEvent),
      ),
      pagination: {
        limit: parsed.params.limit,
        offset: parsed.params.offset,
        afterId: parsed.params.afterId,
      },
    });
  });

  app.get<{
    Querystring: {
      afterId?: unknown;
      limit?: unknown;
    };
  }>("/poll", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const afterId = parseAfterId(request.query.afterId);
    const limit = parsePositiveInt(request.query.limit, 50, 100);
    const routeEvents = await deps.listIncrementalClinicRouteEvents(
      auth.clinicId,
      afterId,
      limit,
    );
    const lastEventId = routeEvents.at(-1)?.id ?? afterId;

    return reply.code(200).send({
      success: true,
      count: routeEvents.length,
      lastEventId,
      routeEvents: routeEvents.map((routeEvent) =>
        serializeRouteEvent(routeEvent),
      ),
      polling: {
        afterId,
        limit,
      },
    });
  });

  app.get<{
    Params: {
      routePlanId: string;
    };
    Querystring: {
      routeStopId?: unknown;
      eventType?: unknown;
      afterId?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
  }>("/route-plans/:routePlanId", async (request, reply) => {
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

    const routeStopId = parseOptionalEntityId(
      request.query.routeStopId,
      "routeStopId",
    );

    if (routeStopId.error) {
      return reply.code(400).send({
        success: false,
        error: routeStopId.error,
      });
    }

    const eventType = parseRouteEventType(request.query.eventType);

    if (eventType.error) {
      return reply.code(400).send({
        success: false,
        error: eventType.error,
      });
    }

    const params: Omit<ListRouteEventsParams, "clinicId" | "routePlanId"> = {
      routeStopId: routeStopId.value,
      eventType: eventType.value,
      afterId: parseAfterId(request.query.afterId),
      limit: parsePositiveInt(request.query.limit, 50, 100),
      offset: parseOffset(request.query.offset),
    };

    const routeEvents = await deps.listRouteEventsForClinicRoutePlan(
      routePlanId,
      auth.clinicId,
      params,
    );

    return reply.code(200).send({
      success: true,
      count: routeEvents.length,
      routePlanId,
      routeEvents: routeEvents.map((routeEvent) =>
        serializeRouteEvent(routeEvent),
      ),
      pagination: {
        limit: params.limit,
        offset: params.offset,
        afterId: params.afterId,
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

    const parsed = buildCreateRouteEventInput(request.body, auth.clinicId);

    if (!parsed.input) {
      return reply.code(400).send({
        success: false,
        error: parsed.error ?? "Body invalido",
      });
    }

    const routeEvent = await deps.createRouteEvent(parsed.input);

    if (!routeEvent) {
      return reply.code(404).send({
        success: false,
        error: "Plan de ruta o parada no encontrada",
      });
    }

    return reply.code(201).send({
      success: true,
      message: "Evento logistico registrado correctamente",
      routeEvent: serializeRouteEvent(routeEvent),
    });
  });
};
