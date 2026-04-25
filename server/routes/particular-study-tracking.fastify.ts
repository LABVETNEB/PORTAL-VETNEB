import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type {
  ParticularToken,
  StudyTrackingCase,
  StudyTrackingNotification,
} from "../../drizzle/schema";
import { ENV } from "../lib/env.ts";
import {
  parseBooleanQuery,
  parseOffset,
  parsePositiveInt,
  serializeStudyTrackingCase,
  serializeStudyTrackingNotification,
} from "../lib/study-tracking.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";

type ParticularSessionRecord = {
  particularTokenId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type ParticularTokenAuthRecord = Pick<
  ParticularToken,
  "id" | "clinicId" | "reportId" | "isActive"
>;

type AuthenticatedParticularUser = {
  tokenId: number;
  clinicId: number;
  reportId: number | null;
  sessionToken: string;
};

export type ParticularStudyTrackingNativeRoutesOptions = {
  deleteParticularSession?: (tokenHash: string) => Promise<void>;
  getParticularSessionByToken?: (
    tokenHash: string,
  ) => Promise<ParticularSessionRecord | null>;
  getParticularTokenById?: (
    id: number,
  ) => Promise<ParticularTokenAuthRecord | null | undefined>;
  updateParticularSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  getParticularStudyTrackingCase?: (
    particularTokenId: number,
  ) => Promise<StudyTrackingCase | null | undefined>;
  listStudyTrackingNotifications?: (params: {
    clinicId?: number;
    particularTokenId?: number;
    studyTrackingCaseId?: number;
    unreadOnly?: boolean;
    limit: number;
    offset: number;
  }) => Promise<StudyTrackingNotification[]>;
  now?: () => number;
};

const REQUEST_START_TIME_KEY = "__particularStudyTrackingRequestStartTimeNs";
const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

type ParticularStudyTrackingFastifyRequest = FastifyRequest & {
  [REQUEST_START_TIME_KEY]?: bigint;
};

type NativeParticularStudyTrackingDeps = Required<
  Pick<
    ParticularStudyTrackingNativeRoutesOptions,
    | "deleteParticularSession"
    | "getParticularSessionByToken"
    | "getParticularTokenById"
    | "updateParticularSessionLastAccess"
    | "hashSessionToken"
    | "getParticularStudyTrackingCase"
    | "listStudyTrackingNotifications"
  >
>;

let defaultDepsPromise:
  | Promise<NativeParticularStudyTrackingDeps>
  | undefined;

async function loadDefaultDeps(): Promise<NativeParticularStudyTrackingDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const dbParticular = await import("../db-particular.ts");
      const dbStudyTracking = await import("../db-study-tracking.ts");
      const authSecurity = await import("../lib/auth-security.ts");

      return {
        deleteParticularSession: dbParticular.deleteParticularSession,
        getParticularSessionByToken:
          dbParticular.getParticularSessionByToken,
        getParticularTokenById: dbParticular.getParticularTokenById,
        updateParticularSessionLastAccess:
          dbParticular.updateParticularSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        getParticularStudyTrackingCase:
          dbStudyTracking.getParticularStudyTrackingCase,
        listStudyTrackingNotifications:
          dbStudyTracking.listStudyTrackingNotifications,
      };
    })();
  }

  return defaultDepsPromise;
}

function hasAllInjectedDeps(
  options: ParticularStudyTrackingNativeRoutesOptions,
) {
  return (
    !!options.deleteParticularSession &&
    !!options.getParticularSessionByToken &&
    !!options.getParticularTokenById &&
    !!options.updateParticularSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.getParticularStudyTrackingCase &&
    !!options.listStudyTrackingNotifications
  );
}

async function resolveDeps(
  options: ParticularStudyTrackingNativeRoutesOptions,
): Promise<NativeParticularStudyTrackingDeps> {
  const defaultDeps = hasAllInjectedDeps(options)
    ? undefined
    : await loadDefaultDeps();

  return {
    deleteParticularSession:
      options.deleteParticularSession ?? defaultDeps!.deleteParticularSession,
    getParticularSessionByToken:
      options.getParticularSessionByToken ??
      defaultDeps!.getParticularSessionByToken,
    getParticularTokenById:
      options.getParticularTokenById ?? defaultDeps!.getParticularTokenById,
    updateParticularSessionLastAccess:
      options.updateParticularSessionLastAccess ??
      defaultDeps!.updateParticularSessionLastAccess,
    hashSessionToken:
      options.hashSessionToken ?? defaultDeps!.hashSessionToken,
    getParticularStudyTrackingCase:
      options.getParticularStudyTrackingCase ??
      defaultDeps!.getParticularStudyTrackingCase,
    listStudyTrackingNotifications:
      options.listStudyTrackingNotifications ??
      defaultDeps!.listStudyTrackingNotifications,
  };
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

function getOriginHeader(request: FastifyRequest) {
  return typeof request.headers.origin === "string"
    ? request.headers.origin.trim()
    : "";
}

function getAllowedOriginForCors(
  request: FastifyRequest,
  allowedOrigins: ReadonlySet<string>,
) {
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
) {
  const allowedOrigin = getAllowedOriginForCors(request, allowedOrigins);

  if (!allowedOrigin) {
    return;
  }

  reply.header("vary", "Origin");
  reply.header("access-control-allow-origin", allowedOrigin);
  reply.header("access-control-allow-credentials", "true");
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

function getParticularSessionToken(request: FastifyRequest) {
  const cookieHeader =
    typeof request.headers.cookie === "string"
      ? request.headers.cookie
      : undefined;

  const cookies = parseCookies(cookieHeader);
  const raw = cookies[ENV.particularCookieName];

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

function buildClearParticularSessionCookie() {
  return serializeCookie({
    name: ENV.particularCookieName,
    value: "",
    maxAgeSeconds: 0,
    expires: "Thu, 01 Jan 1970 00:00:00 GMT",
  });
}

function shouldRefreshSessionLastAccess(
  lastAccess: Date | null | undefined,
  nowMs: number,
) {
  if (!(lastAccess instanceof Date)) {
    return true;
  }

  return nowMs - lastAccess.getTime() >= SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS;
}

async function authenticateParticularUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeParticularStudyTrackingDeps,
  now: () => number,
): Promise<AuthenticatedParticularUser | null> {
  const token = getParticularSessionToken(request);

  if (!token) {
    reply.code(401).send({
      success: false,
      error: "Particular no autenticado",
    });
    return null;
  }

  const tokenHash = deps.hashSessionToken(token);
  const session = await deps.getParticularSessionByToken(tokenHash);

  if (!session) {
    reply.code(401).send({
      success: false,
      error: "Sesión particular inválida",
    });
    return null;
  }

  if (session.expiresAt && session.expiresAt.getTime() <= now()) {
    await deps.deleteParticularSession(tokenHash);

    reply.header("set-cookie", buildClearParticularSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Sesión particular expirada",
    });
    return null;
  }

  const particularToken = await deps.getParticularTokenById(
    session.particularTokenId,
  );

  if (!particularToken || !particularToken.isActive) {
    await deps.deleteParticularSession(tokenHash);

    reply.header("set-cookie", buildClearParticularSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Token particular inválido o inactivo",
    });
    return null;
  }

  if (shouldRefreshSessionLastAccess(session.lastAccess ?? null, now())) {
    await deps.updateParticularSessionLastAccess(tokenHash);
  }

  return {
    tokenId: particularToken.id,
    clinicId: particularToken.clinicId,
    reportId: particularToken.reportId ?? null,
    sessionToken: token,
  };
}

export const particularStudyTrackingNativeRoutes: FastifyPluginAsync<
  ParticularStudyTrackingNativeRoutesOptions
> = async (app, options) => {
  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(getAllowedOrigins());

  app.addHook("onRequest", async (request, reply) => {
    (request as ParticularStudyTrackingFastifyRequest)[
      REQUEST_START_TIME_KEY
    ] = process.hrtime.bigint();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt =
      (request as ParticularStudyTrackingFastifyRequest)[
        REQUEST_START_TIME_KEY
      ] ?? process.hrtime.bigint();

    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const safeUrl = sanitizeUrlForLogs(request.url);

    console.log(
      buildRequestLogLine({
        timestamp: new Date().toISOString(),
        method: request.method,
        url: safeUrl,
        statusCode: reply.statusCode,
        durationMs,
      }),
    );
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

  app.options("/me", optionsHandler);
  app.options("/notifications", optionsHandler);

  app.get("/me", async (request, reply) => {
    const deps = await resolveDeps(options);
    const particular = await authenticateParticularUser(
      request,
      reply,
      deps,
      now,
    );

    if (!particular) {
      return reply;
    }

    const trackingCase = await deps.getParticularStudyTrackingCase(
      particular.tokenId,
    );

    if (!trackingCase) {
      return reply.code(404).send({
        success: false,
        error: "Seguimiento no encontrado para el token particular autenticado",
      });
    }

    return reply.code(200).send({
      success: true,
      trackingCase: serializeStudyTrackingCase(trackingCase),
    });
  });

  app.get<{
    Querystring: {
      unreadOnly?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
  }>("/notifications", async (request, reply) => {
    const deps = await resolveDeps(options);
    const particular = await authenticateParticularUser(
      request,
      reply,
      deps,
      now,
    );

    if (!particular) {
      return reply;
    }

    const unreadOnly = parseBooleanQuery(request.query.unreadOnly) ?? false;
    const limit = parsePositiveInt(request.query.limit, 50, 100);
    const offset = parseOffset(request.query.offset, 0);

    const notifications = await deps.listStudyTrackingNotifications({
      particularTokenId: particular.tokenId,
      unreadOnly,
      limit,
      offset,
    });

    return reply.code(200).send({
      success: true,
      count: notifications.length,
      notifications: notifications.map((notification) =>
        serializeStudyTrackingNotification(notification),
      ),
      pagination: {
        limit,
        offset,
      },
    });
  });
};
