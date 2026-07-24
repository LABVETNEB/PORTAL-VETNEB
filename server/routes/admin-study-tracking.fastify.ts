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
import { createAdminStudyTrackingOperations } from "../features/study-tracking/application/index.ts";
import { ENV } from "../lib/env.ts";
import {
  getAllowedOrigins,
  getAllowedOriginForCors,
  getRequestOrigin,
  enforceTrustedOrigin,
} from "../lib/cors-headers.ts";
import { authenticateFastifyAdmin } from "../lib/fastify-admin-auth.ts";
import {
  adminCreateStudyTrackingSchema,
  buildValidationError,
  parseBooleanQuery,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeStudyTrackingCase,
  serializeStudyTrackingNotification,
  updateStudyTrackingSchema,
} from "../features/study-tracking/domain/index.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";

type AdminUserRecord = {
  id: number;
  username: string;
};

type AdminSessionRecord = {
  adminUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type AuthenticatedAdminUser = {
  id: number;
  username: string;
  sessionToken: string;
};

type ClinicRecord = {
  id: number;
  name: string;
  contactEmail?: string | null;
};

export type AdminStudyTrackingNativeRoutesOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken?: (
    tokenHash: string,
  ) => Promise<AdminSessionRecord | null>;
  getAdminUserById?: (adminUserId: number) => Promise<AdminUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  getClinicById?: (clinicId: number) => Promise<ClinicRecord | null>;
  getReportById?: (reportId: number) => Promise<Report | null>;
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
  getStudyTrackingCaseById?: (
    id: number,
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
  markStudyTrackingNotificationRead?: (
    id: number,
  ) => Promise<StudyTrackingNotification | null | undefined>;
  markAllStudyTrackingNotificationsRead?: (params?: {
    clinicId?: number;
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

const REQUEST_TIMER_KEY = "__adminStudyTrackingRequestTimer";
type AdminStudyTrackingFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
};

type NativeAdminStudyTrackingDeps = Required<
  Pick<
    AdminStudyTrackingNativeRoutesOptions,
    | "deleteAdminSession"
    | "getAdminSessionByToken"
    | "getAdminUserById"
    | "updateAdminSessionLastAccess"
    | "hashSessionToken"
    | "getClinicById"
    | "getReportById"
    | "getParticularTokenById"
    | "updateParticularTokenReport"
    | "createStudyTrackingCase"
    | "updateStudyTrackingCase"
    | "getClinicScopedStudyTrackingCase"
    | "getStudyTrackingCaseById"
    | "listStudyTrackingCases"
    | "createStudyTrackingNotification"
    | "listStudyTrackingNotifications"
    | "markStudyTrackingNotificationRead"
    | "markAllStudyTrackingNotificationsRead"
    | "sendSpecialStainRequiredEmail"
    | "writeAuditLog"
  >
>;

async function loadDefaultDeps(): Promise<NativeAdminStudyTrackingDeps> {
  const db = await import("../db.ts");
  const authSecurity = await import("../lib/auth-security.ts");
  const dbParticular = await import("../db-particular.ts");
  const email = await import("../lib/email.ts");
  const audit = await import("../lib/audit.ts");
  const { loadAdminStudyTrackingPersistence } = await import(
    "../features/study-tracking/study-tracking-route-composition.ts"
  );
  const persistence = await loadAdminStudyTrackingPersistence();

  return {
    deleteAdminSession: db.deleteAdminSession,
    getAdminSessionByToken: db.getAdminSessionByToken,
    getAdminUserById: db.getAdminUserById,
    updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
    hashSessionToken: authSecurity.hashSessionToken,
    getClinicById: db.getClinicById,
    getReportById: db.getReportById,
    getParticularTokenById: dbParticular.getParticularTokenById,
    updateParticularTokenReport: dbParticular.updateParticularTokenReport,
    createStudyTrackingCase: persistence.createStudyTrackingCase,
    updateStudyTrackingCase: persistence.updateStudyTrackingCase,
    getClinicScopedStudyTrackingCase:
      persistence.getClinicScopedStudyTrackingCase,
    getStudyTrackingCaseById: persistence.getStudyTrackingCaseById,
    listStudyTrackingCases: persistence.listStudyTrackingCases,
    createStudyTrackingNotification:
      persistence.createStudyTrackingNotification,
    listStudyTrackingNotifications:
      persistence.listStudyTrackingNotifications,
    markStudyTrackingNotificationRead:
      persistence.markStudyTrackingNotificationRead,
    markAllStudyTrackingNotificationsRead:
      persistence.markAllStudyTrackingNotificationsRead,
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


async function authenticateAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeAdminStudyTrackingDeps,
  now: () => number,
): Promise<AuthenticatedAdminUser | null> {
  return authenticateFastifyAdmin(request, reply, {
    deleteAdminSession: deps.deleteAdminSession,
    getAdminSessionByToken: deps.getAdminSessionByToken,
    getAdminUserById: deps.getAdminUserById,
    updateAdminSessionLastAccess: deps.updateAdminSessionLastAccess,
    hashSessionToken: deps.hashSessionToken,
    now,
  });
}

function createAuditRequestLike(
  request: FastifyRequest,
  admin: Pick<AuthenticatedAdminUser, "id" | "username">,
) {
  return {
    method: request.method,
    originalUrl: request.url,
    ip: request.ip,
    headers: request.headers,
    adminAuth: {
      id: admin.id,
      username: admin.username,
    },
  };
}

export const adminStudyTrackingNativeRoutes: FastifyPluginAsync<
  AdminStudyTrackingNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.deleteAdminSession &&
    !!options.getAdminSessionByToken &&
    !!options.getAdminUserById &&
    !!options.updateAdminSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.getClinicById &&
    !!options.getReportById &&
    !!options.getParticularTokenById &&
    !!options.updateParticularTokenReport &&
    !!options.createStudyTrackingCase &&
    !!options.updateStudyTrackingCase &&
    !!options.getClinicScopedStudyTrackingCase &&
    !!options.getStudyTrackingCaseById &&
    !!options.listStudyTrackingCases &&
    !!options.createStudyTrackingNotification &&
    !!options.listStudyTrackingNotifications &&
    !!options.markStudyTrackingNotificationRead &&
    !!options.markAllStudyTrackingNotificationsRead &&
    !!options.sendSpecialStainRequiredEmail &&
    !!options.writeAuditLog;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const nativeDeps: NativeAdminStudyTrackingDeps = {
    deleteAdminSession:
      options.deleteAdminSession ?? defaultDeps!.deleteAdminSession,
    getAdminSessionByToken:
      options.getAdminSessionByToken ?? defaultDeps!.getAdminSessionByToken,
    getAdminUserById: options.getAdminUserById ?? defaultDeps!.getAdminUserById,
    updateAdminSessionLastAccess:
      options.updateAdminSessionLastAccess ??
      defaultDeps!.updateAdminSessionLastAccess,
    hashSessionToken:
      options.hashSessionToken ?? defaultDeps!.hashSessionToken,
    getClinicById: options.getClinicById ?? defaultDeps!.getClinicById,
    getReportById: options.getReportById ?? defaultDeps!.getReportById,
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
    getStudyTrackingCaseById:
      options.getStudyTrackingCaseById ??
      defaultDeps!.getStudyTrackingCaseById,
    listStudyTrackingCases:
      options.listStudyTrackingCases ?? defaultDeps!.listStudyTrackingCases,
    createStudyTrackingNotification:
      options.createStudyTrackingNotification ??
      defaultDeps!.createStudyTrackingNotification,
    listStudyTrackingNotifications:
      options.listStudyTrackingNotifications ??
      defaultDeps!.listStudyTrackingNotifications,
    markStudyTrackingNotificationRead:
      options.markStudyTrackingNotificationRead ??
      defaultDeps!.markStudyTrackingNotificationRead,
    markAllStudyTrackingNotificationsRead:
      options.markAllStudyTrackingNotificationsRead ??
      defaultDeps!.markAllStudyTrackingNotificationsRead,
    sendSpecialStainRequiredEmail:
      options.sendSpecialStainRequiredEmail ??
      defaultDeps!.sendSpecialStainRequiredEmail,
    writeAuditLog: options.writeAuditLog ?? defaultDeps!.writeAuditLog,
  };

  const now = options.now ?? (() => Date.now());
  const createDate = options.createDate ?? (() => new Date());
  const adminOperations = createAdminStudyTrackingOperations({
    queryRepository: {
      getClinicScopedStudyTrackingCase:
        nativeDeps.getClinicScopedStudyTrackingCase,
      getStudyTrackingCaseById: nativeDeps.getStudyTrackingCaseById,
      listStudyTrackingCases: nativeDeps.listStudyTrackingCases,
      listStudyTrackingNotifications:
        nativeDeps.listStudyTrackingNotifications,
    },
    commandRepository: {
      createStudyTrackingCase: nativeDeps.createStudyTrackingCase,
      updateStudyTrackingCase: nativeDeps.updateStudyTrackingCase,
      createStudyTrackingNotification:
        nativeDeps.createStudyTrackingNotification,
      markStudyTrackingNotificationRead:
        nativeDeps.markStudyTrackingNotificationRead,
      markAllStudyTrackingNotificationsRead:
        nativeDeps.markAllStudyTrackingNotificationsRead,
    },
    referenceRepository: {
      getClinicById: nativeDeps.getClinicById,
      getReportById: nativeDeps.getReportById,
      getParticularTokenById: nativeDeps.getParticularTokenById,
      updateParticularTokenReport:
        nativeDeps.updateParticularTokenReport,
    },
    notification: {
      sendSpecialStainRequiredEmail:
        nativeDeps.sendSpecialStainRequiredEmail,
    },
    audit: {
      writeAuditLog: nativeDeps.writeAuditLog,
    },
    auditEvents: {
      caseCreated: AUDIT_EVENTS.STUDY_TRACKING_CASE_CREATED,
      caseUpdated: AUDIT_EVENTS.STUDY_TRACKING_CASE_UPDATED,
      notificationCreated:
        AUDIT_EVENTS.STUDY_TRACKING_NOTIFICATION_CREATED,
    },
    createDate,
  });
  const deps: NativeAdminStudyTrackingDeps = nativeDeps;

  const allowedOrigins = new Set(getAllowedOrigins());

  app.addHook("onRequest", async (request, reply) => {
    (request as AdminStudyTrackingFastifyRequest)[REQUEST_TIMER_KEY] =
      createRuntimeTimer();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const timer =
      (request as AdminStudyTrackingFastifyRequest)[REQUEST_TIMER_KEY] ??
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
      clinicId?: unknown;
      unreadOnly?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
  }>("/notifications", async (request, reply) => {
    const authenticatedAdmin = await authenticateAdminUser(
      request,
      reply,
      deps,
      now,
    );

    if (!authenticatedAdmin) {
      return reply;
    }

    const clinicId = parseEntityId(request.query.clinicId);
    const unreadOnly = parseBooleanQuery(request.query.unreadOnly) ?? false;
    const limit = parsePositiveInt(request.query.limit, 50, 100);
    const offset = parseOffset(request.query.offset, 0);

    const notifications =
      await adminOperations.listAdminStudyTrackingNotifications({
        clinicId,
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

    const authenticatedAdmin = await authenticateAdminUser(
      request,
      reply,
      deps,
      now,
    );

    if (!authenticatedAdmin) {
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
      await adminOperations.acknowledgeAdminStudyTrackingNotification(
        notificationId,
      );

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

  app.patch<{
    Querystring: {
      clinicId?: unknown;
    };
  }>("/notifications/read-all", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const clinicId = parseEntityId(request.query.clinicId);
    const result =
      await adminOperations.acknowledgeAllAdminStudyTrackingNotifications({
        clinicId,
      });

    return reply.code(200).send({
      success: true,
      updatedCount: result.updatedCount,
    });
  });

  app.post<{
    Body: Record<string, unknown>;
  }>("/", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const parsed = adminCreateStudyTrackingSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: buildValidationError(parsed.error),
      });
    }

    const result = await adminOperations.createAdminStudyTrackingCase({
      actor: {
        adminId: admin.id,
      },
      data: parsed.data,
      auditRequest: createAuditRequestLike(request, admin),
    });

    if (result.status === "clinic_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Clínica no encontrada",
      });
    }

    if (result.status === "report_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
      });
    }

    if (result.status === "report_clinic_mismatch") {
      return reply.code(400).send({
        success: false,
        error: "El informe no pertenece a la clínica indicada",
      });
    }

    if (result.status === "particular_token_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    if (result.status === "particular_token_clinic_mismatch") {
      return reply.code(400).send({
        success: false,
        error: "El token particular no pertenece a la clínica indicada",
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
      clinicId?: unknown;
      reportId?: unknown;
      particularTokenId?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
  }>("/", async (request, reply) => {
    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const clinicId = parseEntityId(request.query.clinicId);
    const reportId = parseEntityId(request.query.reportId);
    const particularTokenId = parseEntityId(request.query.particularTokenId);
    const limit = parsePositiveInt(request.query.limit, 50, 100);
    const offset = parseOffset(request.query.offset, 0);

    const trackingCases =
      await adminOperations.listAdminStudyTrackingCases({
        clinicId,
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
    Querystring: {
      clinicId?: unknown;
    };
  }>("/:trackingCaseId", async (request, reply) => {
    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const trackingCaseId = parseEntityId(request.params.trackingCaseId);

    if (typeof trackingCaseId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de seguimiento inválido",
      });
    }

    const clinicId = parseEntityId(request.query.clinicId);
    const trackingCase =
      await adminOperations.resolveAdminStudyTrackingCase({
        trackingCaseId,
        clinicId,
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

  app.patch<{
    Params: {
      trackingCaseId: string;
    };
    Querystring: {
      clinicId?: unknown;
    };
    Body: Record<string, unknown>;
  }>("/:trackingCaseId", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const trackingCaseId = parseEntityId(request.params.trackingCaseId);

    if (typeof trackingCaseId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de seguimiento inválido",
      });
    }

    const body = request.body ?? {};
    const clinicId =
      parseEntityId(body.clinicId) ?? parseEntityId(request.query.clinicId);

    const current =
      await adminOperations.resolveAdminStudyTrackingCase({
        trackingCaseId,
        clinicId,
      });

    if (!current) {
      return reply.code(404).send({
        success: false,
        error: "Seguimiento no encontrado",
      });
    }

    const parsed = updateStudyTrackingSchema.safeParse(body);

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: buildValidationError(parsed.error),
      });
    }

    const result = await adminOperations.updateAdminStudyTrackingCase({
      trackingCaseId,
      current,
      data: parsed.data,
      auditRequest: createAuditRequestLike(request, admin),
    });

    if (result.status === "report_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
      });
    }

    if (result.status === "report_clinic_mismatch") {
      return reply.code(400).send({
        success: false,
        error: "El informe no pertenece a la clínica del seguimiento",
      });
    }

    if (result.status === "particular_token_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    if (result.status === "particular_token_clinic_mismatch") {
      return reply.code(400).send({
        success: false,
        error: "El token particular no pertenece a la clínica del seguimiento",
      });
    }

    if (result.status === "tracking_case_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Seguimiento no encontrado",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Seguimiento actualizado correctamente",
      trackingCase: serializeStudyTrackingCase(result.trackingCase),
    });
  });
};
