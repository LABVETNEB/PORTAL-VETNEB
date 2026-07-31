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
  parseReportId,
  serializeSafeReport,
} from "../features/reports/domain/index.ts";
import { logRequestCompletion } from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";
import { createAdminReportsRouteComposition } from "../features/reports/composition/index.ts";

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
  >
>;

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

function serializeReport(report: Report) {
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

    logRequestCompletion({
      method: request.method,
      routeTemplate: request.routeOptions?.url,
      statusCode: reply.statusCode,
      durationMs,
      requestId: request.id,
    });
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
    const composition = await createAdminReportsRouteComposition(options);
    const admin = await authenticateAdminUser(
      request,
      reply,
      composition.auth,
      now,
    );

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

    const result =
      await composition.service.getSignedPreviewUrl(reportId);

    if (result.type === "not_found") {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
      });
    }

    return reply.code(200).send({
      success: true,
      previewUrl: result.previewUrl,
    });
  });

  app.get<{
    Params: {
      reportId?: unknown;
    };
  }>("/:reportId/download-url", async (request, reply) => {
    const composition = await createAdminReportsRouteComposition(options);
    const admin = await authenticateAdminUser(
      request,
      reply,
      composition.auth,
      now,
    );

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

    const result =
      await composition.service.getSignedDownloadUrl(reportId);

    if (result.type === "not_found") {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
      });
    }

    return reply.code(200).send({
      success: true,
      downloadUrl: result.downloadUrl,
    });
  });

  app.post("/upload", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const composition = await createAdminReportsRouteComposition(options);
    const admin = await authenticateAdminUser(
      request,
      reply,
      composition.auth,
      now,
    );

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

    const result = await composition.service.uploadAdminReport({
      clinicId,
      particularTokenId,
      file: file
        ? {
            buffer: file.buffer,
            fileName: file.originalname,
            mimeType: file.mimetype,
          }
        : undefined,
      patientName: body.patientName,
      studyType: body.studyType,
      uploadDate: body.uploadDate,
      adminUserId: admin.id,
      auditContext: createAuditRequestLike(request, admin),
      now: new Date(now()),
    });

    if (result.type === "clinic_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Clinica no encontrada",
      });
    }

    if (result.type === "file_missing") {
      return reply.code(400).send({
        success: false,
        error: "No se proporciono ningun archivo",
      });
    }

    if (result.type === "token_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    if (result.type === "token_clinic_mismatch") {
      return reply.code(400).send({
        success: false,
        error: "El token particular no pertenece a la clínica indicada",
      });
    }

    return reply.code(201).send({
      success: true,
      message: "Informe subido correctamente",
      report: serializeReport(result.report as Report),
    });
  });
};
