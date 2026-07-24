import { parseReportStudyType } from "../lib/report-study-types.ts";
import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import multer from "multer";

import type {
  ParticularToken,
  Report,
  StudyTrackingCase,
  StudyTrackingNotification,
} from "../../drizzle/schema.ts";
import type { Multer } from "multer";
import { AUDIT_EVENTS } from "../lib/audit.ts";
import { ENV } from "../lib/env.ts";
import {
  getAllowedOrigins,
  getAllowedOriginForCors,
  getRequestOrigin,
  enforceTrustedOrigin,
} from "../lib/cors-headers.ts";
import { authenticateFastifyAdmin } from "../lib/fastify-admin-auth.ts";
import { ALLOWED_MIME_TYPES } from "../lib/supabase.ts";
import {
  normalizeSearchText,
  parseOptionalDate,
  parseReportId,
  serializeSafeReport,
} from "../lib/reports.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";
import { ensureStudyTrackingCaseForToken } from "../features/study-tracking/domain/index.ts";

type AdminUserRecord = {
  id: number;
  username: string;
};

type AdminSessionRecord = {
  adminUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type ClinicRecord = {
  id: number;
};

type ReportUploadInput = {
  file: Buffer;
  fileName: string;
  clinicId: number;
  mimeType: string;
};

type UpsertReportInput = {
  clinicId: number;
  patientName: string | null;
  studyType: string | null;
  uploadDate: Date | null;
  fileName: string;
  storagePath: string;
  createdByAdminUserId?: number | null;
};

type UploadedMultipartFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

type RawRequestWithFile = FastifyRequest["raw"] & {
  file?: UploadedMultipartFile;
  body?: Record<string, unknown>;
};

type AuthenticatedAdminUser = {
  id: number;
  username: string;
  sessionToken: string;
};

type AuditWriteInput = {
  event: string;
  clinicId?: number | null;
  reportId?: number | null;
  metadata?: Record<string, unknown>;
  actor?: {
    type: string;
    adminUserId?: number | null;
  };
};

export type AdminReportsNativeRoutesOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken?: (
    tokenHash: string,
  ) => Promise<AdminSessionRecord | null>;
  getAdminUserById?: (adminUserId: number) => Promise<AdminUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  getClinicById?: (clinicId: number) => Promise<ClinicRecord | null>;
  getReportById?: (reportId: number) => Promise<Report | null>;
  uploadReport?: (input: ReportUploadInput) => Promise<string>;
  upsertReport?: (input: UpsertReportInput) => Promise<Report>;
  getParticularTokenById?: (
    tokenId: number,
  ) => Promise<ParticularToken | null | undefined>;
  updateParticularTokenReport?: (
    id: number,
    reportId: number | null,
  ) => Promise<ParticularToken | null | undefined>;
  getParticularStudyTrackingCase?: (
    particularTokenId: number,
  ) => Promise<StudyTrackingCase | null | undefined>;
  getStudyTrackingCaseByReportId?: (
    reportId: number,
  ) => Promise<StudyTrackingCase | null | undefined>;
  createStudyTrackingCase?: (
    input: Omit<StudyTrackingCase, "id" | "createdAt" | "updatedAt">,
  ) => Promise<StudyTrackingCase>;
  updateStudyTrackingCase?: (
    id: number,
    input: Partial<Omit<StudyTrackingCase, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<StudyTrackingCase | null | undefined>;
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
  createSignedReportUrl?: (storagePath: string) => Promise<string>;
  createSignedReportDownloadUrl?: (
    storagePath: string,
    fileName?: string,
  ) => Promise<string>;
  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;
  now?: () => number;
};

const REQUEST_TIMER_KEY = "__adminReportsRequestTimer";
type AdminReportsFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
};

const allowedMimeTypes = new Set(ALLOWED_MIME_TYPES);

const upload: Multer = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: ENV.maxUploadFileSizeMb * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (
      !allowedMimeTypes.has(
        file.mimetype as (typeof ALLOWED_MIME_TYPES)[number],
      )
    ) {
      cb(new Error("Tipo de archivo no permitido"));
      return;
    }

    cb(null, true);
  },
});

type NativeAdminReportsDeps = Required<
  Pick<
    AdminReportsNativeRoutesOptions,
    | "deleteAdminSession"
    | "getAdminSessionByToken"
    | "getAdminUserById"
    | "updateAdminSessionLastAccess"
    | "hashSessionToken"
    | "getClinicById"
    | "getReportById"
    | "uploadReport"
    | "upsertReport"
    | "getParticularTokenById"
    | "updateParticularTokenReport"
    | "getParticularStudyTrackingCase"
    | "getStudyTrackingCaseByReportId"
    | "createStudyTrackingCase"
    | "updateStudyTrackingCase"
    | "createStudyTrackingNotification"
    | "createSignedReportUrl"
    | "createSignedReportDownloadUrl"
    | "writeAuditLog"
  >
>;

let defaultDepsPromise: Promise<NativeAdminReportsDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeAdminReportsDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const storage = await import("../lib/supabase.ts");
      const audit = await import("../lib/audit.ts");
      const dbParticular = await import("../db-particular.ts");
      const dbStudyTracking = await import("../db-study-tracking.ts");

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        getClinicById: db.getClinicById,
        getReportById: db.getReportById,
        uploadReport: storage.uploadReport,
        upsertReport: db.upsertReport,
        getParticularTokenById: dbParticular.getParticularTokenById,
        updateParticularTokenReport: dbParticular.updateParticularTokenReport,
        getParticularStudyTrackingCase:
          dbStudyTracking.getParticularStudyTrackingCase,
        getStudyTrackingCaseByReportId:
          dbStudyTracking.getStudyTrackingCaseByReportId,
        createStudyTrackingCase: dbStudyTracking.createStudyTrackingCase,
        updateStudyTrackingCase: dbStudyTracking.updateStudyTrackingCase,
        createStudyTrackingNotification:
          dbStudyTracking.createStudyTrackingNotification,
        createSignedReportUrl: storage.createSignedReportUrl,
        createSignedReportDownloadUrl: storage.createSignedReportDownloadUrl,
        writeAuditLog: audit.writeAuditLog as (
          req: unknown,
          input: AuditWriteInput,
        ) => Promise<void>,
      };
    })();
  }

  return defaultDepsPromise;
}

function hasAllInjectedDeps(options: AdminReportsNativeRoutesOptions) {
  return (
    !!options.deleteAdminSession &&
    !!options.getAdminSessionByToken &&
    !!options.getAdminUserById &&
    !!options.updateAdminSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.getClinicById &&
    !!options.getReportById &&
    !!options.uploadReport &&
    !!options.upsertReport &&
    !!options.getParticularTokenById &&
    !!options.updateParticularTokenReport &&
    !!options.getParticularStudyTrackingCase &&
    !!options.getStudyTrackingCaseByReportId &&
    !!options.createStudyTrackingCase &&
    !!options.updateStudyTrackingCase &&
    !!options.createStudyTrackingNotification &&
    !!options.createSignedReportUrl &&
    !!options.createSignedReportDownloadUrl &&
    !!options.writeAuditLog
  );
}

async function resolveDeps(
  options: AdminReportsNativeRoutesOptions,
): Promise<NativeAdminReportsDeps> {
  const defaultDeps = hasAllInjectedDeps(options) ? undefined : await loadDefaultDeps();

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
    getClinicById: options.getClinicById ?? defaultDeps!.getClinicById,
    getReportById: options.getReportById ?? defaultDeps!.getReportById,
    uploadReport: options.uploadReport ?? defaultDeps!.uploadReport,
    upsertReport: options.upsertReport ?? defaultDeps!.upsertReport,
    getParticularTokenById:
      options.getParticularTokenById ?? defaultDeps!.getParticularTokenById,
    updateParticularTokenReport:
      options.updateParticularTokenReport ??
      defaultDeps!.updateParticularTokenReport,
    getParticularStudyTrackingCase:
      options.getParticularStudyTrackingCase ??
      defaultDeps!.getParticularStudyTrackingCase,
    getStudyTrackingCaseByReportId:
      options.getStudyTrackingCaseByReportId ??
      defaultDeps!.getStudyTrackingCaseByReportId,
    createStudyTrackingCase:
      options.createStudyTrackingCase ?? defaultDeps!.createStudyTrackingCase,
    updateStudyTrackingCase:
      options.updateStudyTrackingCase ?? defaultDeps!.updateStudyTrackingCase,
    createStudyTrackingNotification:
      options.createStudyTrackingNotification ??
      defaultDeps!.createStudyTrackingNotification,
    createSignedReportUrl:
      options.createSignedReportUrl ?? defaultDeps!.createSignedReportUrl,
    createSignedReportDownloadUrl:
      options.createSignedReportDownloadUrl ??
      defaultDeps!.createSignedReportDownloadUrl,
    writeAuditLog: options.writeAuditLog ?? defaultDeps!.writeAuditLog,
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
  deps: NativeAdminReportsDeps,
  now: () => number,
): Promise<AuthenticatedAdminUser | null> {
  return authenticateFastifyAdmin(request, reply, {
    deleteAdminSession: deps.deleteAdminSession,
    getAdminSessionByToken: deps.getAdminSessionByToken,
    getAdminUserById: deps.getAdminUserById,
    updateAdminSessionLastAccess: deps.updateAdminSessionLastAccess,
    hashSessionToken: deps.hashSessionToken,
    now,
    messages: {
      invalid_session: "Sesion admin invalida",
      expired_session: "Sesion admin expirada",
      missing_user: "Usuario admin de sesion no encontrado",
    },
  });
}

function runReportUpload(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<UploadedMultipartFile | undefined> {
  return new Promise((resolve, reject) => {
    upload.single("file")(
      request.raw as any,
      reply.raw as any,
      (error: unknown) => {
        if (error) {
          reject(error);
          return;
        }

        resolve((request.raw as RawRequestWithFile).file);
      },
    );
  });
}

function getMultipartBody(request: FastifyRequest) {
  const body = (request.raw as RawRequestWithFile).body;

  if (!body || typeof body !== "object") {
    return {};
  }

  return body;
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

async function ensureDeliveredTrackingByReportId(
  deps: NativeAdminReportsDeps,
  reportId: number,
  nowDate: Date,
) {
  const trackingCase =
    (await deps.getStudyTrackingCaseByReportId(reportId)) ?? null;

  if (!trackingCase || trackingCase.currentStage === "delivered") {
    return trackingCase;
  }

  return (
    (await deps.updateStudyTrackingCase(trackingCase.id, {
      reportId,
      currentStage: "delivered",
      deliveredAt: trackingCase.deliveredAt ?? nowDate,
    })) ?? trackingCase
  );
}

async function ensureTrackingForLinkedToken(
  deps: NativeAdminReportsDeps,
  token: ParticularToken,
  input: {
    adminUserId: number;
    nowDate: Date;
  },
) {
  return ensureStudyTrackingCaseForToken(
    {
      getParticularStudyTrackingCase: deps.getParticularStudyTrackingCase,
      getStudyTrackingCaseByReportId: deps.getStudyTrackingCaseByReportId,
      createStudyTrackingCase: deps.createStudyTrackingCase,
      updateStudyTrackingCase: deps.updateStudyTrackingCase,
    },
    {
      token,
      createdByAdminId: input.adminUserId,
      createdByClinicUserId: token.createdByClinicUserId ?? null,
      now: input.nowDate,
    },
  );
}

function shouldCreateReportDeliveredNotification(input: {
  previousTrackingCase: StudyTrackingCase | null;
  trackingCase: StudyTrackingCase | null;
}) {
  const { previousTrackingCase, trackingCase } = input;

  if (!trackingCase || trackingCase.currentStage !== "delivered") {
    return false;
  }

  if (!previousTrackingCase) {
    return true;
  }

  return previousTrackingCase.currentStage !== "delivered";
}

async function createReportDeliveredNotificationSafely(
  deps: NativeAdminReportsDeps,
  input: {
    previousTrackingCase: StudyTrackingCase | null;
    trackingCase: StudyTrackingCase | null;
    clinicId: number;
    reportId: number;
  },
) {
  if (!shouldCreateReportDeliveredNotification(input) || !input.trackingCase) {
    return;
  }

  try {
    await deps.createStudyTrackingNotification({
      studyTrackingCaseId: input.trackingCase.id,
      clinicId: input.clinicId,
      reportId: input.reportId,
      particularTokenId: input.trackingCase.particularTokenId,
      type: "report_delivered",
      title: "Informe disponible",
      message: "El informe del estudio ya está disponible.",
      isRead: false,
      readAt: null,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "unknown_error";

    console.warn(
      "[admin-reports] report_delivered notification failed",
      JSON.stringify({
        reportId: input.reportId,
        clinicId: input.clinicId,
        trackingCaseId: input.trackingCase.id,
        error: errorMessage,
      }),
    );
  }
}

function serializeReport(report: Report, _deps: NativeAdminReportsDeps) {
  return serializeSafeReport(report);
}

export const adminReportsNativeRoutes: FastifyPluginAsync<
  AdminReportsNativeRoutesOptions
> = async (app, options) => {
  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(getAllowedOrigins());

  if (!app.hasContentTypeParser("multipart/form-data")) {
    app.addContentTypeParser("multipart/form-data", (_request, _payload, done) => {
      done(null, undefined);
    });
  }

  app.addHook("onRequest", async (request, reply) => {
    (request as AdminReportsFastifyRequest)[REQUEST_TIMER_KEY] =
      createRuntimeTimer();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const timer =
      (request as AdminReportsFastifyRequest)[REQUEST_TIMER_KEY] ??
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
    reply.header("access-control-allow-methods", "POST,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/upload", optionsHandler);

  app.get<{
    Params: {
      reportId?: unknown;
    };
  }>("/:reportId/preview-url", async (request, reply) => {
    const deps = await resolveDeps(options);
    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const reportId = parseReportId(request.params.reportId);

    if (typeof reportId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de informe invalido",
      });
    }

    const report = await deps.getReportById(reportId);

    if (!report) {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
      });
    }

    const previewUrl = await deps.createSignedReportUrl(report.storagePath);

    return reply.code(200).send({
      success: true,
      previewUrl,
    });
  });

  app.get<{
    Params: {
      reportId?: unknown;
    };
  }>("/:reportId/download-url", async (request, reply) => {
    const deps = await resolveDeps(options);
    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const reportId = parseReportId(request.params.reportId);

    if (typeof reportId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de informe invalido",
      });
    }

    const report = await deps.getReportById(reportId);

    if (!report) {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
      });
    }

    const downloadUrl = await deps.createSignedReportDownloadUrl(
      report.storagePath,
      report.fileName ?? undefined,
    );

    return reply.code(200).send({
      success: true,
      downloadUrl,
    });
  });

  app.post("/upload", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const deps = await resolveDeps(options);
    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    let file: UploadedMultipartFile | undefined;

    try {
      file = await runReportUpload(request, reply);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error al procesar archivo";

      return reply.code(400).send({
        success: false,
        error: message,
      });
    }

    const body = getMultipartBody(request);
    const clinicId = parseReportId(body.clinicId);
    const rawParticularTokenId =
      typeof body.particularTokenId === "string" ||
      typeof body.particularTokenId === "number"
        ? String(body.particularTokenId).trim()
        : "";
    const particularTokenId = rawParticularTokenId
      ? parseReportId(rawParticularTokenId)
      : undefined;

    if (typeof clinicId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "clinicId es obligatorio",
      });
    }

    if (rawParticularTokenId && typeof particularTokenId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "particularTokenId inválido",
      });
    }

    const clinic = await deps.getClinicById(clinicId);

    if (!clinic) {
      return reply.code(404).send({
        success: false,
        error: "Clinica no encontrada",
      });
    }

    if (!file) {
      return reply.code(400).send({
        success: false,
        error: "No se proporciono ningun archivo",
      });
    }

    const selectedParticularToken =
      typeof particularTokenId === "number"
        ? await deps.getParticularTokenById(particularTokenId)
        : null;

    if (typeof particularTokenId === "number" && !selectedParticularToken) {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    if (
      selectedParticularToken &&
      selectedParticularToken.clinicId !== clinicId
    ) {
      return reply.code(400).send({
        success: false,
        error: "El token particular no pertenece a la clínica indicada",
      });
    }

    const storagePath = await deps.uploadReport({
      file: file.buffer,
      fileName: file.originalname,
      clinicId,
      mimeType: file.mimetype,
    });

    const patientName = normalizeSearchText(body.patientName);
    const studyType = parseReportStudyType(body.studyType);
    const uploadDate = parseOptionalDate(body.uploadDate);

    const report = await deps.upsertReport({
      clinicId,
      patientName: patientName ?? null,
      studyType: studyType ?? null,
      uploadDate: uploadDate ?? null,
      fileName: file.originalname,
      storagePath,
      createdByAdminUserId: admin.id,
    });

    const nowDate = new Date(now());
    let trackingCase: StudyTrackingCase | null = null;
    let previousTrackingCase: StudyTrackingCase | null = null;
    let linkedTokenId: number | null = null;

    if (selectedParticularToken) {
      previousTrackingCase =
        (await deps.getParticularStudyTrackingCase(selectedParticularToken.id)) ??
        (await deps.getStudyTrackingCaseByReportId(report.id)) ??
        null;

      const updatedToken = await deps.updateParticularTokenReport(
        selectedParticularToken.id,
        report.id,
      );
      const tokenForTracking = {
        ...selectedParticularToken,
        reportId: report.id,
        updatedAt: nowDate,
      } as ParticularToken;
      const linkedToken = updatedToken ?? tokenForTracking;

      linkedTokenId = linkedToken.id;
      trackingCase = await ensureTrackingForLinkedToken(deps, linkedToken, {
        adminUserId: admin.id,
        nowDate,
      });
    } else {
      previousTrackingCase =
        (await deps.getStudyTrackingCaseByReportId(report.id)) ?? null;

      trackingCase = await ensureDeliveredTrackingByReportId(
        deps,
        report.id,
        nowDate,
      );
      linkedTokenId = trackingCase?.particularTokenId ?? null;
    }

    await createReportDeliveredNotificationSafely(deps, {
      previousTrackingCase,
      trackingCase,
      clinicId: report.clinicId,
      reportId: report.id,
    });

    await deps.writeAuditLog(createAuditRequestLike(request, admin), {
      event: AUDIT_EVENTS.REPORT_UPLOADED,
      clinicId: report.clinicId,
      reportId: report.id,
      metadata: {
        fileName: file.originalname,
        mimeType: file.mimetype,
        patientName: patientName ?? null,
        studyType: studyType ?? null,
        uploadDate: uploadDate ?? null,
        uploadedVia: "admin",
        particularTokenId: linkedTokenId,
        trackingCaseId: trackingCase?.id ?? null,
        trackingStage: trackingCase?.currentStage ?? null,
      },
    });

    return reply.code(201).send({
      success: true,
      message: "Informe subido correctamente",
      report: await serializeReport(report, deps),
    });
  });
};
