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
} from "../../drizzle/schema";
import { ENV } from "../lib/env.ts";
import {
  applyEstimatedDeliveryRules,
  buildValidationError,
  clinicCreateStudyTrackingSchema,
  parseBooleanQuery,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeStudyTrackingCase,
  serializeStudyTrackingNotification,
} from "../lib/study-tracking.ts";
import {
  getClinicPermissions,
  normalizeClinicUserRole,
} from "../lib/permissions.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";

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

type StudyTrackingEmailInput = Pick<
  StudyTrackingCase,
  | "id"
  | "clinicId"
  | "receptionAt"
  | "estimatedDeliveryAt"
  | "currentStage"
  | "paymentUrl"
  | "adminContactEmail"
  | "adminContactPhone"
  | "notes"
>;

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
  }) => Promise<void>;
  now?: () => number;
  createDate?: () => Date;
};

const REQUEST_START_TIME_KEY = "__studyTrackingRequestStartTimeNs";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

type StudyTrackingFastifyRequest = FastifyRequest & {
  [REQUEST_START_TIME_KEY]?: bigint;
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
    | "getReportById"
    | "getParticularTokenById"
    | "updateParticularTokenReport"
    | "createStudyTrackingCase"
    | "updateStudyTrackingCase"
    | "getClinicScopedStudyTrackingCase"
    | "listStudyTrackingCases"
    | "createStudyTrackingNotification"
    | "listStudyTrackingNotifications"
    | "sendSpecialStainRequiredEmail"
  >
>;

let defaultDepsPromise: Promise<NativeStudyTrackingDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeStudyTrackingDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const dbStudyTracking = await import("../db-study-tracking.ts");
      const dbParticular = await import("../db-particular.ts");
      const email = await import("../lib/email.ts");

      return {
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        updateSessionLastAccess: db.updateSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        getClinicById: db.getClinicById,
        getReportById: db.getReportById,
        getParticularTokenById: dbParticular.getParticularTokenById,
        updateParticularTokenReport: dbParticular.updateParticularTokenReport,
        createStudyTrackingCase: dbStudyTracking.createStudyTrackingCase,
        updateStudyTrackingCase: dbStudyTracking.updateStudyTrackingCase,
        getClinicScopedStudyTrackingCase:
          dbStudyTracking.getClinicScopedStudyTrackingCase,
        listStudyTrackingCases: dbStudyTracking.listStudyTrackingCases,
        createStudyTrackingNotification:
          dbStudyTracking.createStudyTrackingNotification,
        listStudyTrackingNotifications:
          dbStudyTracking.listStudyTrackingNotifications,
        sendSpecialStainRequiredEmail: email.sendSpecialStainRequiredEmail,
      };
    })();
  }

  return defaultDepsPromise;
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

function enforceTrustedOrigin(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: ReadonlySet<string>,
) {
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

function shouldRefreshSessionLastAccess(
  lastAccess: Date | null | undefined,
  nowMs: number,
) {
  if (!(lastAccess instanceof Date)) {
    return true;
  }

  return nowMs - lastAccess.getTime() >= SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS;
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
  if (auth.canManageClinicUsers) {
    return true;
  }

  reply.code(403).send({
    success: false,
    error: "No autorizado para administrar recursos de la clinica",
  });

  return false;
}

async function notifySpecialStainByEmail(
  trackingCase: StudyTrackingEmailInput,
  deps: NativeStudyTrackingDeps,
) {
  const clinic = await deps.getClinicById(trackingCase.clinicId);

  if (!clinic) {
    console.warn("[EMAIL] special_stain_required skipped: clinic not found", {
      trackingCaseId: trackingCase.id,
      clinicId: trackingCase.clinicId,
    });
    return;
  }

  try {
    await deps.sendSpecialStainRequiredEmail({
      to: [clinic.contactEmail, trackingCase.adminContactEmail],
      clinicName: clinic.name,
      trackingCaseId: trackingCase.id,
      receptionAt: trackingCase.receptionAt,
      estimatedDeliveryAt: trackingCase.estimatedDeliveryAt,
      currentStage: trackingCase.currentStage,
      paymentUrl: trackingCase.paymentUrl,
      adminContactEmail: trackingCase.adminContactEmail,
      adminContactPhone: trackingCase.adminContactPhone,
      notes: trackingCase.notes,
    });
  } catch (error) {
    console.error("[EMAIL] special_stain_required failed", {
      trackingCaseId: trackingCase.id,
      clinicId: trackingCase.clinicId,
      error,
    });
  }
}

export const studyTrackingNativeRoutes: FastifyPluginAsync<
  StudyTrackingNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.updateSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.getClinicById &&
    !!options.getReportById &&
    !!options.getParticularTokenById &&
    !!options.updateParticularTokenReport &&
    !!options.createStudyTrackingCase &&
    !!options.updateStudyTrackingCase &&
    !!options.getClinicScopedStudyTrackingCase &&
    !!options.listStudyTrackingCases &&
    !!options.createStudyTrackingNotification &&
    !!options.listStudyTrackingNotifications &&
    !!options.sendSpecialStainRequiredEmail;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeStudyTrackingDeps = {
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
    listStudyTrackingCases:
      options.listStudyTrackingCases ?? defaultDeps!.listStudyTrackingCases,
    createStudyTrackingNotification:
      options.createStudyTrackingNotification ??
      defaultDeps!.createStudyTrackingNotification,
    listStudyTrackingNotifications:
      options.listStudyTrackingNotifications ??
      defaultDeps!.listStudyTrackingNotifications,
    sendSpecialStainRequiredEmail:
      options.sendSpecialStainRequiredEmail ??
      defaultDeps!.sendSpecialStainRequiredEmail,
  };

  const now = options.now ?? (() => Date.now());
  const createDate = options.createDate ?? (() => new Date());
  const allowedOrigins = new Set(getAllowedOrigins());

  app.addHook("onRequest", async (request, reply) => {
    (request as StudyTrackingFastifyRequest)[REQUEST_START_TIME_KEY] =
      process.hrtime.bigint();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt =
      (request as StudyTrackingFastifyRequest)[REQUEST_START_TIME_KEY] ??
      process.hrtime.bigint();

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
    reply.header("access-control-allow-methods", "GET,POST,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/", optionsHandler);
  app.options("/notifications", optionsHandler);
  app.options("/:trackingCaseId", optionsHandler);

  app.get<{
    Querystring: {
      unreadOnly?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
  }>("/notifications", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const unreadOnly = parseBooleanQuery(request.query.unreadOnly) ?? false;
    const limit = parsePositiveInt(request.query.limit, 50, 100);
    const offset = parseOffset(request.query.offset, 0);

    const notifications = await deps.listStudyTrackingNotifications({
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

    const auth = await authenticateClinicUser(request, reply, deps, now);

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

    const clinic = await deps.getClinicById(auth.clinicId);

    if (!clinic) {
      return reply.code(404).send({
        success: false,
        error: "Clínica autenticada no encontrada",
      });
    }

    if (typeof parsed.data.reportId === "number") {
      const report = await deps.getReportById(parsed.data.reportId);

      if (!report) {
        return reply.code(404).send({
          success: false,
          error: "Informe no encontrado",
        });
      }

      if (report.clinicId !== auth.clinicId) {
        return reply.code(400).send({
          success: false,
          error: "El informe no pertenece a la clínica autenticada",
        });
      }
    }

    if (typeof parsed.data.particularTokenId === "number") {
      const particularToken = await deps.getParticularTokenById(
        parsed.data.particularTokenId,
      );

      if (!particularToken) {
        return reply.code(404).send({
          success: false,
          error: "Token particular no encontrado",
        });
      }

      if (particularToken.clinicId !== auth.clinicId) {
        return reply.code(400).send({
          success: false,
          error: "El token particular no pertenece a la clínica autenticada",
        });
      }
    }

    const delivery = applyEstimatedDeliveryRules({
      receptionAt: parsed.data.receptionAt,
      manualEstimatedDeliveryAt: undefined,
    });

    const created = await deps.createStudyTrackingCase({
      clinicId: auth.clinicId,
      reportId: parsed.data.reportId ?? null,
      particularTokenId: parsed.data.particularTokenId ?? null,
      createdByAdminId: null,
      createdByClinicUserId: auth.id,
      receptionAt: parsed.data.receptionAt,
      estimatedDeliveryAt: delivery.estimatedDeliveryAt,
      estimatedDeliveryAutoCalculatedAt:
        delivery.estimatedDeliveryAutoCalculatedAt,
      estimatedDeliveryWasManuallyAdjusted:
        delivery.estimatedDeliveryWasManuallyAdjusted,
      currentStage: parsed.data.currentStage,
      processingAt: parsed.data.processingAt ?? null,
      evaluationAt: parsed.data.evaluationAt ?? null,
      reportDevelopmentAt: parsed.data.reportDevelopmentAt ?? null,
      deliveredAt: parsed.data.deliveredAt ?? null,
      specialStainRequired: parsed.data.specialStainRequired,
      specialStainNotifiedAt: null,
      paymentUrl: parsed.data.paymentUrl ?? null,
      adminContactEmail: parsed.data.adminContactEmail ?? null,
      adminContactPhone: parsed.data.adminContactPhone ?? null,
      notes: parsed.data.notes ?? null,
    });

    if (
      typeof created.particularTokenId === "number" &&
      typeof created.reportId === "number"
    ) {
      await deps.updateParticularTokenReport(
        created.particularTokenId,
        created.reportId,
      );
    }

    let finalCase = created;

    if (created.specialStainRequired) {
      const notifiedAt = createDate();

      await deps.createStudyTrackingNotification({
        studyTrackingCaseId: created.id,
        clinicId: created.clinicId,
        reportId: created.reportId ?? null,
        particularTokenId: created.particularTokenId ?? null,
        type: "special_stain_required",
        title: "Se requiere tinción especial",
        message:
          "El estudio requiere tinción especial. Se generó una notificación para seguimiento.",
        isRead: false,
        readAt: null,
      });

      finalCase =
        (await deps.updateStudyTrackingCase(created.id, {
          specialStainNotifiedAt: notifiedAt,
        })) ?? created;

      await notifySpecialStainByEmail(finalCase, deps);
    }

    return reply.code(201).send({
      success: true,
      message: "Seguimiento creado correctamente",
      trackingCase: serializeStudyTrackingCase(finalCase),
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
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const reportId = parseEntityId(request.query.reportId);
    const particularTokenId = parseEntityId(request.query.particularTokenId);
    const limit = parsePositiveInt(request.query.limit, 50, 100);
    const offset = parseOffset(request.query.offset, 0);

    const trackingCases = await deps.listStudyTrackingCases({
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
    const auth = await authenticateClinicUser(request, reply, deps, now);

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

    const trackingCase = await deps.getClinicScopedStudyTrackingCase(
      trackingCaseId,
      auth.clinicId,
    );

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
