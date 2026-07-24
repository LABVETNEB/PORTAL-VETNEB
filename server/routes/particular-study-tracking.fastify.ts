import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type {
  ParticularToken,
  StudyTrackingCase,
  StudyTrackingNotification,
} from "../../drizzle/schema.ts";
import {
  enforceTrustedOriginRequired as enforceTrustedOrigin,
  getAllowedOriginForCors,
  getAllowedOrigins,
  getRequestOrigin,
} from "../lib/cors-headers.ts";
import { ENV } from "../lib/env.ts";
import {
  parseBooleanQuery,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeStudyTrackingCase,
  serializeStudyTrackingNotification,
} from "../features/study-tracking/domain/index.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";
import { shouldRefreshSessionLastAccess } from "../lib/session-last-access.ts";

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
  markStudyTrackingNotificationReadScoped?: (params: {
    id: number;
    clinicId?: number;
    particularTokenId?: number;
  }) => Promise<StudyTrackingNotification | null | undefined>;
  markAllStudyTrackingNotificationsReadScoped?: (params: {
    clinicId?: number;
    particularTokenId?: number;
  }) => Promise<{ updatedCount: number }>;
  now?: () => number;
};

const REQUEST_TIMER_KEY = "__particularStudyTrackingRequestTimer";

type ParticularStudyTrackingFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
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
    | "markStudyTrackingNotificationReadScoped"
    | "markAllStudyTrackingNotificationsReadScoped"
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
        markStudyTrackingNotificationReadScoped:
          dbStudyTracking.markStudyTrackingNotificationReadScoped,
        markAllStudyTrackingNotificationsReadScoped:
          dbStudyTracking.markAllStudyTrackingNotificationsReadScoped,
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
    !!options.listStudyTrackingNotifications &&
    !!options.markStudyTrackingNotificationReadScoped &&
    !!options.markAllStudyTrackingNotificationsReadScoped
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
    markStudyTrackingNotificationReadScoped:
      options.markStudyTrackingNotificationReadScoped ??
      defaultDeps!.markStudyTrackingNotificationReadScoped,
    markAllStudyTrackingNotificationsReadScoped:
      options.markAllStudyTrackingNotificationsReadScoped ??
      defaultDeps!.markAllStudyTrackingNotificationsReadScoped,
  };
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
    (request as ParticularStudyTrackingFastifyRequest)[REQUEST_TIMER_KEY] =
      createRuntimeTimer();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const timer =
      (request as ParticularStudyTrackingFastifyRequest)[REQUEST_TIMER_KEY] ??
      createRuntimeTimer();

    const durationMs = timer.elapsedMs();
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
    reply.header("access-control-allow-methods", "GET,PATCH,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/me", optionsHandler);
  app.options("/notifications", optionsHandler);
  app.options("/notifications/:notificationId/read", optionsHandler);
  app.options("/notifications/read-all", optionsHandler);

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

  app.patch<{
    Params: {
      notificationId: string;
    };
  }>("/notifications/:notificationId/read", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

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

    const notificationId = parseEntityId(request.params.notificationId);

    if (typeof notificationId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de notificación inválido",
      });
    }

    const notification = await deps.markStudyTrackingNotificationReadScoped({
      id: notificationId,
      particularTokenId: particular.tokenId,
    });

    if (!notification) {
      return reply.code(404).send({
        success: false,
        error: "Notificación no encontrada",
      });
    }

    return reply.code(200).send({
      success: true,
      notification: serializeStudyTrackingNotification(notification),
    });
  });

  app.patch("/notifications/read-all", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

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

    const result = await deps.markAllStudyTrackingNotificationsReadScoped({
      particularTokenId: particular.tokenId,
    });

    return reply.code(200).send({
      success: true,
      updatedCount: result.updatedCount,
    });
  });
};
