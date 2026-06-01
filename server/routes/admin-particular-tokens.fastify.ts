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
  adminCreateParticularTokenSchema,
  buildValidationError,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeParticularToken,
  serializeParticularTokenDetail,
  updateParticularTokenReportSchema,
} from "../lib/particular-token.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";
import { shouldRefreshSessionLastAccess } from "../lib/session-last-access.ts";
import { getSafeEmailTransportErrorMetadata } from "../lib/email.ts";
import { ensureStudyTrackingCaseForToken } from "../lib/token-study-tracking.ts";

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
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const dbParticular = await import("../db-particular.ts");
      const dbStudyTracking = await import("../db-study-tracking.ts");
      const email = await import("../lib/email.ts");

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        generateSessionToken: authSecurity.generateSessionToken,
        hashSessionToken: authSecurity.hashSessionToken,
        getClinicById: db.getClinicById,
        getReportById: db.getReportById,
        createParticularToken: dbParticular.createParticularToken,
        getParticularTokenById: dbParticular.getParticularTokenById,
        listParticularTokens: dbParticular.listParticularTokens,
        updateParticularTokenReport: dbParticular.updateParticularTokenReport,
        revokeParticularToken: dbParticular.revokeParticularToken,
        deleteParticularToken: dbParticular.deleteParticularToken,
        sendParticularTokenEmail: email.sendParticularTokenEmail,
        getParticularStudyTrackingCase:
          dbStudyTracking.getParticularStudyTrackingCase,
        getStudyTrackingCaseByReportId:
          dbStudyTracking.getStudyTrackingCaseByReportId,
        createStudyTrackingCase: dbStudyTracking.createStudyTrackingCase,
        updateStudyTrackingCase: dbStudyTracking.updateStudyTrackingCase,
        createStudyTrackingNotification:
          dbStudyTracking.createStudyTrackingNotification,
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

function getSafeErrorName(error: unknown) {
  return error instanceof Error && error.name.trim()
    ? error.name
    : "unknown_error";
}

async function revokeParticularTokenAfterEmailFailure(
  deps: NativeAdminParticularTokensDeps,
  tokenId: number,
) {
  try {
    await deps.revokeParticularToken(tokenId);
  } catch (error) {
    console.error("[EMAIL] particular_token cleanup failed", {
      tokenId,
      errorName: getSafeErrorName(error),
    });
  }
}


async function authenticateAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeAdminParticularTokensDeps,
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
      error: "Sesión admin inválida",
    });
    return null;
  }

  if (session.expiresAt && session.expiresAt.getTime() <= now()) {
    await deps.deleteAdminSession(tokenHash);

    reply.header("set-cookie", buildClearAdminSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Sesión admin expirada",
    });
    return null;
  }

  const adminUser = await deps.getAdminUserById(session.adminUserId);

  if (!adminUser) {
    await deps.deleteAdminSession(tokenHash);

    reply.header("set-cookie", buildClearAdminSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Usuario admin de sesión no encontrado",
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

  async function ensureTrackingForToken(
    token: ParticularToken,
    createdByAdminId: number | null,
  ): Promise<StudyTrackingCase | null> {
    try {
      return await ensureStudyTrackingCaseForToken(
        {
          getParticularStudyTrackingCase: deps.getParticularStudyTrackingCase,
          getStudyTrackingCaseByReportId: deps.getStudyTrackingCaseByReportId,
          createStudyTrackingCase: deps.createStudyTrackingCase,
          updateStudyTrackingCase: deps.updateStudyTrackingCase,
        },
        {
          token,
          createdByAdminId,
          createdByClinicUserId: token.createdByClinicUserId ?? null,
          now: new Date(now()),
        },
      );
    } catch (error) {
      console.error("[TRACKING] ensure-by-token failed", {
        tokenId: token.id,
        clinicId: token.clinicId,
        errorName: getSafeErrorName(error),
      });
      return null;
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

    const clinic = await deps.getClinicById(parsed.data.clinicId);

    if (!clinic) {
      return reply.code(404).send({
        success: false,
        error: "Clínica no encontrada",
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

      if (report.clinicId !== parsed.data.clinicId) {
        return reply.code(400).send({
          success: false,
          error: "El informe no pertenece a la clínica indicada",
        });
      }
    }

    const rawToken = deps.generateSessionToken();
    const tokenHash = deps.hashSessionToken(rawToken);

    const particularToken = await deps.createParticularToken({
      clinicId: parsed.data.clinicId,
      reportId:
        typeof parsed.data.reportId === "number" ? parsed.data.reportId : null,
      createdByAdminId: admin.id,
      createdByClinicUserId: null,
      tokenHash,
      tokenLast4: rawToken.slice(-4),
      tutorLastName: parsed.data.tutorLastName,
      petName: parsed.data.petName,
      petAge: parsed.data.petAge,
      petBreed: parsed.data.petBreed,
      petSex: parsed.data.petSex,
      petSpecies: parsed.data.petSpecies,
      sampleLocation: parsed.data.sampleLocation,
      sampleEvolution: parsed.data.sampleEvolution,
      detailsLesion: parsed.data.detailsLesion ?? null,
      extractionDate: parsed.data.extractionDate,
      shippingDate: parsed.data.shippingDate,
      isActive: true,
      lastLoginAt: null,
    });

    try {
      const emailResult = await deps.sendParticularTokenEmail({
        to: parsed.data.recipientEmail,
        token: rawToken,
        tutorLastName: parsed.data.tutorLastName,
        petName: parsed.data.petName,
      });

      if (!emailResult.sent) {
        await revokeParticularTokenAfterEmailFailure(deps, particularToken.id);

        return reply.code(503).send({
          success: false,
          reason: emailResult.reason,
          error:
            "No se pudo enviar el email del token particular. El token fue desactivado; reintentá la generación cuando el servicio de email esté disponible.",
        });
      }
    } catch (error) {
      await revokeParticularTokenAfterEmailFailure(deps, particularToken.id);

      console.error("[EMAIL] particular_token failed", {
        tokenId: particularToken.id,
        ...getSafeEmailTransportErrorMetadata(error),
      });

      return reply.code(502).send({
        success: false,
        reason: "email_delivery_failed",
        error:
          "No se pudo enviar el email del token particular. El token fue desactivado; reintentá la generación más tarde.",
      });
    }

    const trackingCase = await ensureTrackingForToken(particularToken, admin.id);

    if (trackingCase) {
      try {
        await deps.createStudyTrackingNotification({
          studyTrackingCaseId: trackingCase.id,
          clinicId: particularToken.clinicId,
          reportId:
            particularToken.reportId ?? trackingCase.reportId ?? null,
          particularTokenId: particularToken.id,
          type: "token_created",
          title: "Token particular generado",
          message: `Se generó un token particular para ${particularToken.petName}.`,
          isRead: false,
          readAt: null,
        });
      } catch (error) {
        console.error("[TRACKING] notification token_created failed", {
          tokenId: particularToken.id,
          trackingCaseId: trackingCase.id,
          errorName: getSafeErrorName(error),
        });
      }
    }

    return reply.code(201).send({
      success: true,
      message: "Token particular creado correctamente",
      token: rawToken,
      particularToken: serializeParticularToken(particularToken),
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

    const tokens = await deps.listParticularTokens({
      clinicId,
      limit,
      offset,
    });

    await Promise.all(
      tokens.map((token) => ensureTrackingForToken(token, admin.id)),
    );

    return reply.code(200).send({
      success: true,
      count: tokens.length,
      particularTokens: tokens.map((token) => serializeParticularToken(token)),
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

    const token = await deps.getParticularTokenById(tokenId);

    if (!token) {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    await ensureTrackingForToken(token, admin.id);

    const report =
      typeof token.reportId === "number"
        ? await deps.getReportById(token.reportId)
        : null;

    return reply.code(200).send({
      success: true,
      particularToken: serializeParticularTokenDetail(token, report),
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

    const token = await deps.getParticularTokenById(tokenId);

    if (!token) {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
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

      if (report.clinicId !== token.clinicId) {
        return reply.code(400).send({
          success: false,
          error: "El informe no pertenece a la clínica del token",
        });
      }
    }

    const updated = await deps.updateParticularTokenReport(
      tokenId,
      parsed.data.reportId,
    );

    if (updated) {
      await ensureTrackingForToken(updated, admin.id);
    }

    const report =
      updated && typeof updated.reportId === "number"
        ? await deps.getReportById(updated.reportId)
        : null;

    return reply.code(200).send({
      success: true,
      message:
        typeof parsed.data.reportId === "number"
          ? "Informe vinculado al token correctamente"
          : "Informe desvinculado del token correctamente",
      particularToken: updated
        ? serializeParticularTokenDetail(updated, report)
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

    const existing = await deps.getParticularTokenById(tokenId);

    if (!existing) {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    const deleted = await deps.deleteParticularToken(tokenId);

    if (!deleted) {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Token particular eliminado correctamente",
      deletedTokenId: tokenId,
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

    const existing = await deps.getParticularTokenById(tokenId);

    if (!existing) {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    const deleted = await deps.deleteParticularToken(tokenId);

    if (!deleted) {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Token particular eliminado correctamente",
      deletedTokenId: tokenId,
    });
  });
};
