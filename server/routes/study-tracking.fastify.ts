import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type {
  ParticularToken,
  Report,
  StudyTrackingCase,
  StudyTrackingNotification,
} from "../../drizzle/schema.ts";
import { AUDIT_EVENTS, type AuditWriteInput } from "../lib/audit.ts";
import {
  createClinicStudyTrackingOperations,
} from "../features/study-tracking/application/index.ts";
import {
  enforceTrustedOriginRequired as enforceTrustedOrigin,
  getAllowedOriginForCors,
  getAllowedOrigins,
  getRequestOrigin,
} from "../lib/cors-headers.ts";
import { ENV } from "../lib/env.ts";
import {
  buildValidationError,
  clinicCreateStudyTrackingSchema,
  parseBooleanQuery,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeStudyTrackingCase,
  serializeStudyTrackingNotification,
} from "../features/study-tracking/domain/index.ts";
import {
  getClinicPermissions,
  normalizeClinicUserRole,
} from "../lib/permissions.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";
import { shouldRefreshSessionLastAccess } from "../lib/session-last-access.ts";

type ClinicUserRecord = {
  id: number;
  clinicId: number;
  username: string;
  authProId?: string | null;
  role: unknown;
};

type ActiveSessionRecord = {
  clinicUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type ClinicRecord = {
  id: number;
  name: string;
  contactEmail?: string | null;
};

type AuthenticatedClinicUser = {
  id: number;
  clinicId: number;
  username: string;
  authProId: string | null;
  role: ReturnType<typeof normalizeClinicUserRole>;
  permissions: ReturnType<typeof getClinicPermissions>;
  canUploadReports: boolean;
  canManageClinicUsers: boolean;
  sessionToken: string;
};

export type StudyTrackingNativeRoutesOptions = {
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<ActiveSessionRecord | null>;
  getClinicUserById?: (
    clinicUserId: number,
  ) => Promise<ClinicUserRecord | null>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  getClinicById?: (clinicId: number) => Promise<ClinicRecord | null>;
  getReportById?: (reportId: number) => Promise<Report | null>;
  getClinicScopedReportById?: (
    reportId: number,
    clinicId: number,
  ) => Promise<Report | null | undefined>;
  getParticularTokenById?: (
    tokenId: number,
  ) => Promise<ParticularToken | null | undefined>;
  updateParticularTokenReport?: (
    id: number,
    reportId: number | null,
  ) => Promise<ParticularToken | null | undefined>;
  createStudyTrackingCase?: (input: {
    clinicId: number;
    reportId: number | null;
    particularTokenId: number | null;
    createdByAdminId: number | null;
    createdByClinicUserId: number | null;
    receptionAt: Date;
    estimatedDeliveryAt: Date;
    estimatedDeliveryAutoCalculatedAt: Date;
    estimatedDeliveryWasManuallyAdjusted: boolean;
    currentStage: string;
    processingAt: Date | null;
    evaluationAt: Date | null;
    reportDevelopmentAt: Date | null;
    deliveredAt: Date | null;
    specialStainRequired: boolean;
    specialStainNotifiedAt: Date | null;
    paymentUrl: string | null;
    adminContactEmail: string | null;
    adminContactPhone: string | null;
    notes: string | null;
  }) => Promise<StudyTrackingCase>;
  updateStudyTrackingCase?: (
    id: number,
    input: Partial<StudyTrackingCase>,
  ) => Promise<StudyTrackingCase | null | undefined>;
  getClinicScopedStudyTrackingCase?: (
    id: number,
    clinicId: number,
  ) => Promise<StudyTrackingCase | null | undefined>;
  listStudyTrackingCases?: (params: {
    clinicId?: number;
    reportId?: number;
    particularTokenId?: number;
    limit: number;
    offset: number;
  }) => Promise<StudyTrackingCase[]>;
  createStudyTrackingNotification?: (input: {
    studyTrackingCaseId: number;
    clinicId: number;
    reportId: number | null;
    particularTokenId: number | null;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    readAt: Date | null;
  }) => Promise<StudyTrackingNotification>;
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
  sendSpecialStainRequiredEmail?: (input: {
    to: Array<string | null | undefined>;
    clinicName: string;
    trackingCaseId: number;
    receptionAt: Date;
    estimatedDeliveryAt: Date;
    currentStage: string;
    paymentUrl: string | null;
    adminContactEmail: string | null;
    adminContactPhone: string | null;
    notes: string | null;
  }) => Promise<unknown>;
  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;
  now?: () => number;
  createDate?: () => Date;
};

const REQUEST_TIMER_KEY = "__studyTrackingRequestTimer";

type StudyTrackingFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
};

type NativeStudyTrackingDeps = Required<
  Pick<
    StudyTrackingNativeRoutesOptions,
    | "deleteActiveSession"
    | "getActiveSessionByToken"
    | "getClinicUserById"
    | "updateSessionLastAccess"
    | "hashSessionToken"
    | "getClinicById"
    | "getClinicScopedReportById"
    | "getParticularTokenById"
    | "updateParticularTokenReport"
    | "createStudyTrackingCase"
    | "updateStudyTrackingCase"
    | "getClinicScopedStudyTrackingCase"
    | "listStudyTrackingCases"
    | "createStudyTrackingNotification"
    | "listStudyTrackingNotifications"
    | "markStudyTrackingNotificationReadScoped"
    | "markAllStudyTrackingNotificationsReadScoped"
    | "sendSpecialStainRequiredEmail"
    | "writeAuditLog"
  >
>;

async function loadDefaultDeps(): Promise<NativeStudyTrackingDeps> {
  const db = await import("../db.ts");
  const authSecurity = await import("../lib/auth-security.ts");
  const reportCommands = await import(
    "../features/reports/composition/index.ts"
  );
  const dbParticular = await import("../db-particular.ts");
  const email = await import("../lib/email.ts");
  const audit = await import("../lib/audit.ts");
  const { loadClinicStudyTrackingPersistence } = await import(
    "../features/study-tracking/study-tracking-route-composition.ts"
  );
  const persistence = await loadClinicStudyTrackingPersistence();

  return {
    deleteActiveSession: db.deleteActiveSession,
    getActiveSessionByToken: db.getActiveSessionByToken,
    getClinicUserById: db.getClinicUserById,
    updateSessionLastAccess: db.updateSessionLastAccess,
    hashSessionToken: authSecurity.hashSessionToken,
    getClinicById: db.getClinicById,
    getClinicScopedReportById: reportCommands.getClinicScopedReportById,
    getParticularTokenById: dbParticular.getParticularTokenById,
    updateParticularTokenReport: dbParticular.updateParticularTokenReport,
    ...persistence,
    sendSpecialStainRequiredEmail: email.sendSpecialStainRequiredEmail,
    writeAuditLog: audit.writeAuditLog as (
      req: unknown,
      input: AuditWriteInput,
    ) => Promise<void>,
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

function getSessionToken(request: FastifyRequest) {
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

function buildClearSessionCookie() {
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
  deps: NativeStudyTrackingDeps,
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
      error: "Sesión inválida",
    });
    return null;
  }

  if (session.expiresAt && session.expiresAt.getTime() <= now()) {
    await deps.deleteActiveSession(tokenHash);

    reply.header("set-cookie", buildClearSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Sesión expirada",
    });
    return null;
  }

  const clinicUser = await deps.getClinicUserById(session.clinicUserId);

  if (!clinicUser) {
    await deps.deleteActiveSession(tokenHash);

    reply.header("set-cookie", buildClearSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Usuario de sesión no encontrado",
    });
    return null;
  }

  if (shouldRefreshSessionLastAccess(session.lastAccess ?? null, now())) {
    await deps.updateSessionLastAccess(tokenHash);
  }

  const role = normalizeClinicUserRole(clinicUser.role, "clinic_staff");
  const permissions = getClinicPermissions(role);

  return {
    id: clinicUser.id,
    clinicId: clinicUser.clinicId,
    username: clinicUser.username,
    authProId: clinicUser.authProId ?? null,
    role,
    permissions,
    canUploadReports: permissions.canUploadReports,
    canManageClinicUsers: permissions.canManageClinicUsers,
    sessionToken: token,
  };
}

function requireStudyTrackingManagementPermission(
  auth: AuthenticatedClinicUser,
  reply: FastifyReply,
) {
  reply.code(403).send({
    success: false,
    error: "Solo administración puede crear seguimientos",
  });

  return false;
}

function createAuditRequestLike(
  request: FastifyRequest,
  auth: Pick<AuthenticatedClinicUser, "id" | "clinicId" | "username" | "role">,
) {
  return {
    method: request.method,
    originalUrl: request.url,
    ip: request.ip,
    headers: request.headers,
    auth: {
      id: auth.id,
      clinicId: auth.clinicId,
      username: auth.username,
      role: auth.role,
    },
  };
}

export const studyTrackingNativeRoutes: FastifyPluginAsync<
  StudyTrackingNativeRoutesOptions
> = async (app, options) => {
  const now = options.now ?? (() => Date.now());
  const createDate = options.createDate ?? (() => new Date());
  const hasAllInjectedDeps =
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.updateSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.getClinicById &&
    (!!options.getClinicScopedReportById || !!options.getReportById) &&
    !!options.getParticularTokenById &&
    !!options.updateParticularTokenReport &&
    !!options.createStudyTrackingCase &&
    !!options.updateStudyTrackingCase &&
    !!options.getClinicScopedStudyTrackingCase &&
    !!options.listStudyTrackingCases &&
    !!options.createStudyTrackingNotification &&
    !!options.listStudyTrackingNotifications &&
    !!options.markStudyTrackingNotificationReadScoped &&
    !!options.markAllStudyTrackingNotificationsReadScoped &&
    !!options.sendSpecialStainRequiredEmail &&
    !!options.writeAuditLog;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const nativeDeps: NativeStudyTrackingDeps = {
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
    getClinicById: options.getClinicById ?? defaultDeps!.getClinicById,
    getClinicScopedReportById:
      options.getClinicScopedReportById ??
      (options.getReportById
        ? async (reportId: number, clinicId: number) => {
            const report = await options.getReportById!(reportId);
            return report?.clinicId === clinicId ? report : null;
          }
        : defaultDeps!.getClinicScopedReportById),
    getParticularTokenById:
      options.getParticularTokenById ?? defaultDeps!.getParticularTokenById,
    updateParticularTokenReport:
      options.updateParticularTokenReport ??
      defaultDeps!.updateParticularTokenReport,
    createStudyTrackingCase:
      options.createStudyTrackingCase ?? defaultDeps!.createStudyTrackingCase,
    updateStudyTrackingCase:
      options.updateStudyTrackingCase ?? defaultDeps!.updateStudyTrackingCase,
    getClinicScopedStudyTrackingCase:
      options.getClinicScopedStudyTrackingCase ??
      defaultDeps!.getClinicScopedStudyTrackingCase,
    listStudyTrackingCases:
      options.listStudyTrackingCases ?? defaultDeps!.listStudyTrackingCases,
    createStudyTrackingNotification:
      options.createStudyTrackingNotification ??
      defaultDeps!.createStudyTrackingNotification,
    listStudyTrackingNotifications:
      options.listStudyTrackingNotifications ??
      defaultDeps!.listStudyTrackingNotifications,
    markStudyTrackingNotificationReadScoped:
      options.markStudyTrackingNotificationReadScoped ??
      defaultDeps!.markStudyTrackingNotificationReadScoped,
    markAllStudyTrackingNotificationsReadScoped:
      options.markAllStudyTrackingNotificationsReadScoped ??
      defaultDeps!.markAllStudyTrackingNotificationsReadScoped,
    sendSpecialStainRequiredEmail:
      options.sendSpecialStainRequiredEmail ??
      defaultDeps!.sendSpecialStainRequiredEmail,
    writeAuditLog: options.writeAuditLog ?? defaultDeps!.writeAuditLog,
  };

  const clinicOperations = createClinicStudyTrackingOperations({
    queryRepository: nativeDeps,
    commandRepository: nativeDeps,
    referenceRepository: nativeDeps,
    notification: {
      sendSpecialStainRequiredEmail:
        nativeDeps.sendSpecialStainRequiredEmail,
    },
    audit: {
      writeAuditLog: nativeDeps.writeAuditLog,
    },
    auditEvents: {
      caseCreated: AUDIT_EVENTS.STUDY_TRACKING_CASE_CREATED,
      notificationCreated:
        AUDIT_EVENTS.STUDY_TRACKING_NOTIFICATION_CREATED,
    },
    createDate,
  });

  const allowedOrigins = new Set(getAllowedOrigins());

  app.addHook("onRequest", async (request, reply) => {
    (request as StudyTrackingFastifyRequest)[REQUEST_TIMER_KEY] =
      createRuntimeTimer();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const timer =
      (request as StudyTrackingFastifyRequest)[REQUEST_TIMER_KEY] ??
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
    reply.header("access-control-allow-methods", "GET,POST,PATCH,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/", optionsHandler);
  app.options("/notifications", optionsHandler);
  app.options("/notifications/:notificationId/read", optionsHandler);
  app.options("/notifications/read-all", optionsHandler);
  app.options("/:trackingCaseId", optionsHandler);

  app.get<{
    Querystring: {
      unreadOnly?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
  }>("/notifications", async (request, reply) => {
    const auth = await authenticateClinicUser(
      request,
      reply,
      nativeDeps,
      now,
    );

    if (!auth) {
      return reply;
    }

    const unreadOnly = parseBooleanQuery(request.query.unreadOnly) ?? false;
    const limit = parsePositiveInt(request.query.limit, 50, 100);
    const offset = parseOffset(request.query.offset, 0);

    const notifications =
      await clinicOperations.listClinicStudyTrackingNotifications({
        clinicId: auth.clinicId,
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

    const auth = await authenticateClinicUser(
      request,
      reply,
      nativeDeps,
      now,
    );

    if (!auth) {
      return reply;
    }

    const notificationId = parseEntityId(request.params.notificationId);

    if (typeof notificationId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de notificación inválido",
      });
    }

    const notification =
      await clinicOperations.acknowledgeClinicStudyTrackingNotification({
        notificationId,
        clinicId: auth.clinicId,
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

    const auth = await authenticateClinicUser(
      request,
      reply,
      nativeDeps,
      now,
    );

    if (!auth) {
      return reply;
    }

    const result =
      await clinicOperations.acknowledgeAllClinicStudyTrackingNotifications(
        auth.clinicId,
      );

    return reply.code(200).send({
      success: true,
      updatedCount: result.updatedCount,
    });
  });

  app.post<{
    Body: {
      reportId?: unknown;
      particularTokenId?: unknown;
      receptionAt?: unknown;
      currentStage?: unknown;
      processingAt?: unknown;
      evaluationAt?: unknown;
      reportDevelopmentAt?: unknown;
      deliveredAt?: unknown;
      specialStainRequired?: unknown;
      paymentUrl?: unknown;
      adminContactEmail?: unknown;
      adminContactPhone?: unknown;
      notes?: unknown;
    };
  }>("/", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const auth = await authenticateClinicUser(
      request,
      reply,
      nativeDeps,
      now,
    );

    if (!auth) {
      return reply;
    }

    if (!requireStudyTrackingManagementPermission(auth, reply)) {
      return reply;
    }

    const parsed = clinicCreateStudyTrackingSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: buildValidationError(parsed.error),
      });
    }

    const result = await clinicOperations.createClinicStudyTrackingCase({
      actor: {
        clinicId: auth.clinicId,
        clinicUserId: auth.id,
      },
      data: parsed.data,
      auditRequest: createAuditRequestLike(request, auth),
    });

    if (result.status === "clinic_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Clínica autenticada no encontrada",
      });
    }

    if (result.status === "report_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
      });
    }

    if (result.status === "particular_token_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    if (result.status === "particular_token_wrong_clinic") {
      return reply.code(400).send({
        success: false,
        error: "El token particular no pertenece a la clínica autenticada",
      });
    }

    return reply.code(201).send({
      success: true,
      message: "Seguimiento creado correctamente",
      trackingCase: serializeStudyTrackingCase(result.trackingCase),
    });
  });

  app.get<{
    Querystring: {
      reportId?: unknown;
      particularTokenId?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
  }>("/", async (request, reply) => {
    const auth = await authenticateClinicUser(
      request,
      reply,
      nativeDeps,
      now,
    );

    if (!auth) {
      return reply;
    }

    const reportId = parseEntityId(request.query.reportId);
    const particularTokenId = parseEntityId(request.query.particularTokenId);
    const limit = parsePositiveInt(request.query.limit, 50, 100);
    const offset = parseOffset(request.query.offset, 0);

    const trackingCases =
      await clinicOperations.listClinicStudyTrackingCases({
        clinicId: auth.clinicId,
        reportId,
        particularTokenId,
        limit,
        offset,
      });

    return reply.code(200).send({
      success: true,
      count: trackingCases.length,
      trackingCases: trackingCases.map((trackingCase) =>
        serializeStudyTrackingCase(trackingCase),
      ),
      pagination: {
        limit,
        offset,
      },
    });
  });

  app.get<{
    Params: {
      trackingCaseId: string;
    };
  }>("/:trackingCaseId", async (request, reply) => {
    const auth = await authenticateClinicUser(
      request,
      reply,
      nativeDeps,
      now,
    );

    if (!auth) {
      return reply;
    }

    const trackingCaseId = parseEntityId(request.params.trackingCaseId);

    if (typeof trackingCaseId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de seguimiento inválido",
      });
    }

    const trackingCase = await clinicOperations.getClinicStudyTrackingCase({
      trackingCaseId,
      clinicId: auth.clinicId,
    });

    if (!trackingCase) {
      return reply.code(404).send({
        success: false,
        error: "Seguimiento no encontrado",
      });
    }

    return reply.code(200).send({
      success: true,
      trackingCase: serializeStudyTrackingCase(trackingCase),
    });
  });
};
