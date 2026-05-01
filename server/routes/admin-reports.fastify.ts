import { parseReportStudyType } from "../lib/report-study-types.ts";
import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import multer from "multer";

import type { Report } from "../../drizzle/schema";
import type { Multer } from "multer";
import { AUDIT_EVENTS } from "../lib/audit.ts";
import { ENV } from "../lib/env.ts";
import { ALLOWED_MIME_TYPES } from "../lib/supabase.ts";
import {
  normalizeSearchText,
  parseOptionalDate,
  parseReportId,
} from "../lib/reports.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";

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
  uploadReport?: (input: ReportUploadInput) => Promise<string>;
  upsertReport?: (input: UpsertReportInput) => Promise<Report>;
  createSignedReportUrl?: (storagePath: string) => Promise<string>;
  createSignedReportDownloadUrl?: (
    storagePath: string,
    fileName?: string,
  ) => Promise<string>;
  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;
  now?: () => number;
};

const REQUEST_START_TIME_KEY = "__adminReportsRequestStartTimeNs";
const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type AdminReportsFastifyRequest = FastifyRequest & {
  [REQUEST_START_TIME_KEY]?: bigint;
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
    | "uploadReport"
    | "upsertReport"
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

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        getClinicById: db.getClinicById,
        uploadReport: storage.uploadReport,
        upsertReport: db.upsertReport,
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
    !!options.uploadReport &&
    !!options.upsertReport &&
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
    uploadReport: options.uploadReport ?? defaultDeps!.uploadReport,
    upsertReport: options.upsertReport ?? defaultDeps!.upsertReport,
    createSignedReportUrl:
      options.createSignedReportUrl ?? defaultDeps!.createSignedReportUrl,
    createSignedReportDownloadUrl:
      options.createSignedReportDownloadUrl ??
      defaultDeps!.createSignedReportDownloadUrl,
    writeAuditLog: options.writeAuditLog ?? defaultDeps!.writeAuditLog,
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

function enforceTrustedOrigin(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: ReadonlySet<string>,
) {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) {
    return true;
  }

  const requestOrigin = getRequestOrigin(request);

  if (!requestOrigin || allowedOrigins.has(requestOrigin)) {
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

function getAdminSessionToken(request: FastifyRequest) {
  const cookieHeader =
    typeof request.headers.cookie === "string"
      ? request.headers.cookie
      : undefined;

  const cookies = parseCookies(cookieHeader);
  const raw = cookies[ENV.adminCookieName];

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

function buildClearAdminSessionCookie() {
  return serializeCookie({
    name: ENV.adminCookieName,
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

async function authenticateAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeAdminReportsDeps,
  now: () => number,
): Promise<AuthenticatedAdminUser | null> {
  const token = getAdminSessionToken(request);

  if (!token) {
    reply.code(401).send({
      success: false,
      error: "Admin no autenticado",
    });
    return null;
  }

  const tokenHash = deps.hashSessionToken(token);
  const session = await deps.getAdminSessionByToken(tokenHash);

  if (!session) {
    reply.code(401).send({
      success: false,
      error: "Sesion admin invalida",
    });
    return null;
  }

  if (session.expiresAt && session.expiresAt.getTime() <= now()) {
    await deps.deleteAdminSession(tokenHash);

    reply.header("set-cookie", buildClearAdminSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Sesion admin expirada",
    });
    return null;
  }

  const adminUser = await deps.getAdminUserById(session.adminUserId);

  if (!adminUser) {
    await deps.deleteAdminSession(tokenHash);

    reply.header("set-cookie", buildClearAdminSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Usuario admin de sesion no encontrado",
    });
    return null;
  }

  if (shouldRefreshSessionLastAccess(session.lastAccess ?? null, now())) {
    await deps.updateAdminSessionLastAccess(tokenHash);
  }

  return {
    id: adminUser.id,
    username: adminUser.username,
    sessionToken: token,
  };
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

async function serializeReport(report: Report, deps: NativeAdminReportsDeps) {
  const [previewUrl, downloadUrl] = await Promise.all([
    deps.createSignedReportUrl(report.storagePath),
    deps.createSignedReportDownloadUrl(
      report.storagePath,
      report.fileName ?? undefined,
    ),
  ]);

  return {
    ...report,
    previewUrl,
    downloadUrl,
  };
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
    (request as AdminReportsFastifyRequest)[REQUEST_START_TIME_KEY] =
      process.hrtime.bigint();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt =
      (request as AdminReportsFastifyRequest)[REQUEST_START_TIME_KEY] ??
      process.hrtime.bigint();

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
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

    if (typeof clinicId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "clinicId es obligatorio",
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

    await deps.writeAuditLog(createAuditRequestLike(request, admin), {
      event: AUDIT_EVENTS.REPORT_UPLOADED,
      clinicId: report.clinicId,
      reportId: report.id,
      metadata: {
        fileName: file.originalname,
        mimeType: file.mimetype,
        storagePath,
        patientName: patientName ?? null,
        studyType: studyType ?? null,
        uploadDate: uploadDate ?? null,
        uploadedVia: "admin",
      },
    });

    return reply.code(201).send({
      success: true,
      message: "Informe subido correctamente",
      report: await serializeReport(report, deps),
    });
  });
};
