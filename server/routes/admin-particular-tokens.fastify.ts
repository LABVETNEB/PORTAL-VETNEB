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
import { ENV } from "../lib/env.ts";
import {
  getAllowedOrigins,
  getAllowedOriginForCors,
  getRequestOrigin,
  enforceTrustedOrigin,
} from "../lib/cors-headers.ts";
import { authenticateFastifyAdmin } from "../lib/fastify-admin-auth.ts";
import {
  adminCreateParticularTokenSchema,
  buildValidationError,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeParticularToken,
  serializeParticularTokenDetail,
  updateParticularTokenReportSchema,
} from "../features/particular-access/index.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";
import { getSafeEmailTransportErrorMetadata } from "../lib/email.ts";
import {
  createAdminParticularAccessOperations,
  type ParticularAccessIssue,
} from "../features/particular-access/application/index.ts";
import { loadAdminParticularAccessRouteDeps } from "../features/particular-access/particular-access-route-composition.ts";

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

type ParticularTokenEmailResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: "no_recipients" | "smtp_disabled" };

type AuthenticatedAdminUser = {
  id: number;
  username: string;
  sessionToken: string;
};

export type AdminParticularTokensNativeRoutesOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken?: (
    tokenHash: string,
  ) => Promise<AdminSessionRecord | null>;
  getAdminUserById?: (
    adminUserId: number,
  ) => Promise<AdminUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  generateSessionToken?: () => string;
  hashSessionToken?: (token: string) => string;
  getClinicById?: (clinicId: number) => Promise<ClinicRecord | null>;
  getReportById?: (reportId: number) => Promise<Report | null>;
  createParticularToken?: (input: {
    clinicId: number;
    reportId: number | null;
    createdByAdminId: number | null;
    createdByClinicUserId: number | null;
    tokenHash: string;
    tokenLast4: string;
    tutorLastName: string;
    petName: string;
    petAge: string;
    petBreed: string;
    petSex: string;
    petSpecies: string;
    sampleLocation: string;
    sampleEvolution: string;
    detailsLesion: string | null;
    extractionDate: Date;
    shippingDate: Date;
    isActive: boolean;
    lastLoginAt: Date | null;
  }) => Promise<ParticularToken>;
  getParticularTokenById?: (
    tokenId: number,
  ) => Promise<ParticularToken | null | undefined>;
  listParticularTokens?: (params: {
    clinicId?: number;
    limit: number;
    offset: number;
  }) => Promise<ParticularToken[]>;
  updateParticularTokenReport?: (
    id: number,
    reportId: number | null,
  ) => Promise<ParticularToken | null | undefined>;
  revokeParticularToken?: (
    id: number,
  ) => Promise<ParticularToken | null | undefined>;
  deleteParticularToken?: (
    id: number,
  ) => Promise<{ id: number } | null>;
  sendParticularTokenEmail?: (input: {
    to: string;
    token: string;
    tutorLastName: string;
    petName: string;
  }) => Promise<ParticularTokenEmailResult>;
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
  now?: () => number;
};

const REQUEST_TIMER_KEY = "__adminParticularTokensRequestTimer";
type AdminParticularTokensFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
};

type NativeAdminParticularTokensDeps = Required<
  Pick<
    AdminParticularTokensNativeRoutesOptions,
    | "deleteAdminSession"
    | "getAdminSessionByToken"
    | "getAdminUserById"
    | "updateAdminSessionLastAccess"
    | "generateSessionToken"
    | "hashSessionToken"
    | "getClinicById"
    | "getReportById"
    | "createParticularToken"
    | "getParticularTokenById"
    | "listParticularTokens"
    | "updateParticularTokenReport"
    | "revokeParticularToken"
    | "deleteParticularToken"
    | "sendParticularTokenEmail"
    | "getParticularStudyTrackingCase"
    | "getStudyTrackingCaseByReportId"
    | "createStudyTrackingCase"
    | "updateStudyTrackingCase"
    | "createStudyTrackingNotification"
  >
>;

let defaultDepsPromise: Promise<NativeAdminParticularTokensDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeAdminParticularTokensDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = loadAdminParticularAccessRouteDeps();
  }

  return defaultDepsPromise;
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

function getSafeErrorName(error: unknown) {
  return error instanceof Error && error.name.trim()
    ? error.name
    : "unknown_error";
}

async function authenticateAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeAdminParticularTokensDeps,
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

export const adminParticularTokensNativeRoutes: FastifyPluginAsync<
  AdminParticularTokensNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.deleteAdminSession &&
    !!options.getAdminSessionByToken &&
    !!options.getAdminUserById &&
    !!options.updateAdminSessionLastAccess &&
    !!options.generateSessionToken &&
    !!options.hashSessionToken &&
    !!options.getClinicById &&
    !!options.getReportById &&
    !!options.createParticularToken &&
    !!options.getParticularTokenById &&
    !!options.listParticularTokens &&
    !!options.updateParticularTokenReport &&
    !!options.revokeParticularToken &&
    !!options.deleteParticularToken &&
    !!options.sendParticularTokenEmail &&
    !!options.getParticularStudyTrackingCase &&
    !!options.getStudyTrackingCaseByReportId &&
    !!options.createStudyTrackingCase &&
    !!options.updateStudyTrackingCase &&
    !!options.createStudyTrackingNotification;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeAdminParticularTokensDeps = {
    deleteAdminSession:
      options.deleteAdminSession ?? defaultDeps!.deleteAdminSession,
    getAdminSessionByToken:
      options.getAdminSessionByToken ?? defaultDeps!.getAdminSessionByToken,
    getAdminUserById:
      options.getAdminUserById ?? defaultDeps!.getAdminUserById,
    updateAdminSessionLastAccess:
      options.updateAdminSessionLastAccess ??
      defaultDeps!.updateAdminSessionLastAccess,
    generateSessionToken:
      options.generateSessionToken ?? defaultDeps!.generateSessionToken,
    hashSessionToken:
      options.hashSessionToken ?? defaultDeps!.hashSessionToken,
    getClinicById: options.getClinicById ?? defaultDeps!.getClinicById,
    getReportById: options.getReportById ?? defaultDeps!.getReportById,
    createParticularToken:
      options.createParticularToken ?? defaultDeps!.createParticularToken,
    getParticularTokenById:
      options.getParticularTokenById ?? defaultDeps!.getParticularTokenById,
    listParticularTokens:
      options.listParticularTokens ?? defaultDeps!.listParticularTokens,
    updateParticularTokenReport:
      options.updateParticularTokenReport ??
      defaultDeps!.updateParticularTokenReport,
    revokeParticularToken:
      options.revokeParticularToken ?? defaultDeps!.revokeParticularToken,
    deleteParticularToken:
      options.deleteParticularToken ?? defaultDeps!.deleteParticularToken,
    sendParticularTokenEmail:
      options.sendParticularTokenEmail ??
      defaultDeps!.sendParticularTokenEmail,
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
  };

  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(getAllowedOrigins());
  const adminOperations = createAdminParticularAccessOperations({
    ...deps,
    studyTracking: {
      getParticularStudyTrackingCase: deps.getParticularStudyTrackingCase,
      getStudyTrackingCaseByReportId: deps.getStudyTrackingCaseByReportId,
      createStudyTrackingCase: deps.createStudyTrackingCase,
      updateStudyTrackingCase: deps.updateStudyTrackingCase,
    },
    now,
  });

  function logApplicationIssues(issues: ParticularAccessIssue[]) {
    for (const issue of issues) {
      if (issue.kind === "tracking") {
      console.error("[TRACKING] ensure-by-token failed", {
          tokenId: issue.tokenId,
          clinicId: issue.clinicId,
          errorName: getSafeErrorName(issue.error),
        });
      } else {
        console.error("[TRACKING] notification token_created failed", {
          tokenId: issue.tokenId,
          trackingCaseId: issue.trackingCaseId,
          errorName: getSafeErrorName(issue.error),
        });
      }
    }
  }

  function logCleanupError(
    result: { tokenId: number; cleanupError?: unknown },
  ) {
    if (result.cleanupError !== undefined) {
      console.error("[EMAIL] particular_token cleanup failed", {
        tokenId: result.tokenId,
        errorName: getSafeErrorName(result.cleanupError),
      });
    }
  }

  app.addHook("onRequest", async (request, reply) => {
    (request as AdminParticularTokensFastifyRequest)[REQUEST_TIMER_KEY] =
      createRuntimeTimer();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const timer =
      (request as AdminParticularTokensFastifyRequest)[REQUEST_TIMER_KEY] ??
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
    reply.header("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/", optionsHandler);
  app.options("/:tokenId", optionsHandler);
  app.options("/:tokenId/report", optionsHandler);
  app.options("/:tokenId/revoke", optionsHandler);

  app.post<{
    Body: {
      clinicId?: unknown;
      reportId?: unknown;
      tutorLastName?: unknown;
      petName?: unknown;
      petAge?: unknown;
      petBreed?: unknown;
      petSex?: unknown;
      petSpecies?: unknown;
      sampleLocation?: unknown;
      sampleEvolution?: unknown;
      detailsLesion?: unknown;
      extractionDate?: unknown;
      shippingDate?: unknown;
      recipientEmail?: unknown;
    };
  }>("/", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const parsed = adminCreateParticularTokenSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: buildValidationError(parsed.error),
      });
    }

    const result = await adminOperations.createToken(
      {
        ...parsed.data,
        reportId:
          typeof parsed.data.reportId === "number" ? parsed.data.reportId : null,
        detailsLesion: parsed.data.detailsLesion ?? null,
      },
      admin.id,
    );

    if (result.kind === "clinic_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Clínica no encontrada",
      });
    }

    if (result.kind === "report_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
      });
    }

    if (result.kind === "report_wrong_clinic") {
      return reply.code(400).send({
        success: false,
        error: "El informe no pertenece a la clínica indicada",
      });
    }

    if (result.kind === "email_unavailable") {
      logCleanupError(result);
      return reply.code(503).send({
        success: false,
        reason: result.reason,
        error:
          "No se pudo enviar el email del token particular. El token fue desactivado; reintentá la generación cuando el servicio de email esté disponible.",
      });
    }

    if (result.kind === "email_failed") {
      logCleanupError(result);
      console.error("[EMAIL] particular_token failed", {
        tokenId: result.tokenId,
        ...getSafeEmailTransportErrorMetadata(result.error),
      });
      return reply.code(502).send({
        success: false,
        reason: "email_delivery_failed",
        error:
          "No se pudo enviar el email del token particular. El token fue desactivado; reintentá la generación más tarde.",
      });
    }

    logApplicationIssues(result.issues);

    return reply.code(201).send({
      success: true,
      message: "Token particular creado correctamente",
      token: result.rawToken,
      particularToken: serializeParticularToken(result.particularToken),
    });
  });

  app.get<{
    Querystring: {
      clinicId?: unknown;
      limit?: unknown;
      offset?: unknown;
    };
  }>("/", async (request, reply) => {
    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const clinicId = parseEntityId(request.query.clinicId);
    const limit = parsePositiveInt(request.query.limit, 50, 100);
    const offset = parseOffset(request.query.offset, 0);

    const result = await adminOperations.listTokens({
      clinicId,
      limit,
      offset,
      adminId: admin.id,
    });
    logApplicationIssues(result.issues);

    return reply.code(200).send({
      success: true,
      count: result.tokens.length,
      particularTokens: result.tokens.map((token) =>
        serializeParticularToken(token),
      ),
      pagination: {
        limit,
        offset,
      },
      filters: {
        clinicId: clinicId ?? null,
      },
    });
  });

  app.get<{
    Params: {
      tokenId: string;
    };
  }>("/:tokenId", async (request, reply) => {
    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const tokenId = parseEntityId(request.params.tokenId);

    if (typeof tokenId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de token inválido",
      });
    }

    const result = await adminOperations.getToken(tokenId, admin.id);

    if (result.kind === "not_found") {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    logApplicationIssues(result.issues);

    return reply.code(200).send({
      success: true,
      particularToken: serializeParticularTokenDetail(
        result.token,
        result.report,
      ),
    });
  });

  app.patch<{
    Params: {
      tokenId: string;
    };
    Body: {
      reportId?: unknown;
    };
  }>("/:tokenId/report", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const tokenId = parseEntityId(request.params.tokenId);

    if (typeof tokenId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de token inválido",
      });
    }

    const parsed = updateParticularTokenReportSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: buildValidationError(parsed.error),
      });
    }

    const result = await adminOperations.updateTokenReport(
      tokenId,
      parsed.data.reportId,
      admin.id,
    );

    if (result.kind === "token_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    if (result.kind === "report_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
      });
    }

    if (result.kind === "report_wrong_clinic") {
      return reply.code(400).send({
        success: false,
        error: "El informe no pertenece a la clínica del token",
      });
    }

    logApplicationIssues(result.issues);

    return reply.code(200).send({
      success: true,
      message:
        typeof parsed.data.reportId === "number"
          ? "Informe vinculado al token correctamente"
          : "Informe desvinculado del token correctamente",
      particularToken: result.updated
        ? serializeParticularTokenDetail(result.updated, result.report)
        : null,
    });
  });

  app.delete<{
    Params: {
      tokenId: string;
    };
  }>("/:tokenId", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const tokenId = parseEntityId(request.params.tokenId);

    if (typeof tokenId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de token inválido",
      });
    }

    const result = await adminOperations.deleteToken(tokenId);

    if (result.kind === "not_found") {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Token particular eliminado correctamente",
      deletedTokenId: result.deletedTokenId,
    });
  });

  app.patch<{
    Params: {
      tokenId: string;
    };
  }>("/:tokenId/revoke", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const tokenId = parseEntityId(request.params.tokenId);

    if (typeof tokenId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de token inválido",
      });
    }

    const result = await adminOperations.deleteToken(tokenId);

    if (result.kind === "not_found") {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Token particular eliminado correctamente",
      deletedTokenId: result.deletedTokenId,
    });
  });
};
