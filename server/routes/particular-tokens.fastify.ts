import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type { ParticularToken, Report, StudyTrackingCase } from "../../drizzle/schema.ts";
import { ENV } from "../lib/env.ts";
import {
  enforceTrustedOrigin,
  getAllowedOrigins,
  getAllowedOriginForCors,
  getRequestOrigin,
} from "../lib/cors-headers.ts";
import {
  buildValidationError,
  clinicCreateParticularTokenSchema,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeParticularToken,
  serializeParticularTokenDetail,
  updateParticularTokenReportSchema,
} from "../features/particular-access/index.ts";
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
import { getSafeEmailTransportErrorMetadata } from "../lib/email.ts";
import {
  createClinicParticularAccessOperations,
  type ParticularAccessIssue,
} from "../features/particular-access/application/index.ts";
import { loadClinicParticularAccessRouteDeps } from "../features/particular-access/particular-access-route-composition.ts";

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

type ParticularTokenEmailResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: "no_recipients" | "smtp_disabled" };

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

export type ParticularTokensNativeRoutesOptions = {
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<ActiveSessionRecord | null>;
  getClinicUserById?: (
    clinicUserId: number,
  ) => Promise<ClinicUserRecord | null>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  generateSessionToken?: () => string;
  hashSessionToken?: (token: string) => string;
  getReportById?: (reportId: number) => Promise<Report | null>;
  getClinicScopedReportById?: (
    reportId: number,
    clinicId: number,
  ) => Promise<Report | null | undefined>;
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
  getClinicScopedParticularToken?: (
    tokenId: number,
    clinicId: number,
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
  now?: () => number;
};

const REQUEST_TIMER_KEY = "__particularTokensRequestTimer";

type ParticularTokensFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
};

type NativeParticularTokensDeps = Required<
  Pick<
    ParticularTokensNativeRoutesOptions,
    | "deleteActiveSession"
    | "getActiveSessionByToken"
    | "getClinicUserById"
    | "updateSessionLastAccess"
    | "generateSessionToken"
    | "hashSessionToken"
    | "getClinicScopedReportById"
    | "createParticularToken"
    | "getClinicScopedParticularToken"
    | "listParticularTokens"
    | "updateParticularTokenReport"
    | "revokeParticularToken"
    | "sendParticularTokenEmail"
    | "getParticularStudyTrackingCase"
    | "getStudyTrackingCaseByReportId"
    | "createStudyTrackingCase"
    | "updateStudyTrackingCase"
  >
>;

let defaultDepsPromise: Promise<NativeParticularTokensDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeParticularTokensDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = loadClinicParticularAccessRouteDeps();
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

function getSafeErrorName(error: unknown) {
  return error instanceof Error && error.name.trim()
    ? error.name
    : "unknown_error";
}

async function authenticateClinicUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeParticularTokensDeps,
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

function requireParticularTokenManagementPermission(
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

export const particularTokensNativeRoutes: FastifyPluginAsync<
  ParticularTokensNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.updateSessionLastAccess &&
    !!options.generateSessionToken &&
    !!options.hashSessionToken &&
    (!!options.getClinicScopedReportById || !!options.getReportById) &&
    !!options.createParticularToken &&
    !!options.getClinicScopedParticularToken &&
    !!options.listParticularTokens &&
    !!options.updateParticularTokenReport &&
    !!options.revokeParticularToken &&
    !!options.sendParticularTokenEmail &&
    !!options.getParticularStudyTrackingCase &&
    !!options.getStudyTrackingCaseByReportId &&
    !!options.createStudyTrackingCase &&
    !!options.updateStudyTrackingCase;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeParticularTokensDeps = {
    deleteActiveSession:
      options.deleteActiveSession ?? defaultDeps!.deleteActiveSession,
    getActiveSessionByToken:
      options.getActiveSessionByToken ?? defaultDeps!.getActiveSessionByToken,
    getClinicUserById:
      options.getClinicUserById ?? defaultDeps!.getClinicUserById,
    updateSessionLastAccess:
      options.updateSessionLastAccess ?? defaultDeps!.updateSessionLastAccess,
    generateSessionToken:
      options.generateSessionToken ?? defaultDeps!.generateSessionToken,
    hashSessionToken:
      options.hashSessionToken ?? defaultDeps!.hashSessionToken,
    getClinicScopedReportById:
      options.getClinicScopedReportById ??
      (options.getReportById
        ? async (reportId: number, clinicId: number) => {
            const report = await options.getReportById!(reportId);
            return report?.clinicId === clinicId ? report : null;
          }
        : defaultDeps!.getClinicScopedReportById),
    createParticularToken:
      options.createParticularToken ?? defaultDeps!.createParticularToken,
    getClinicScopedParticularToken:
      options.getClinicScopedParticularToken ??
      defaultDeps!.getClinicScopedParticularToken,
    listParticularTokens:
      options.listParticularTokens ?? defaultDeps!.listParticularTokens,
    updateParticularTokenReport:
      options.updateParticularTokenReport ??
      defaultDeps!.updateParticularTokenReport,
    revokeParticularToken:
      options.revokeParticularToken ?? defaultDeps!.revokeParticularToken,
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
  };

  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(getAllowedOrigins());
  const clinicOperations = createClinicParticularAccessOperations({
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
      if (issue.kind !== "tracking") {
        continue;
      }
      console.error("[TRACKING] ensure-by-token failed", {
        tokenId: issue.tokenId,
        clinicId: issue.clinicId,
        errorName: getSafeErrorName(issue.error),
      });
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
    (request as ParticularTokensFastifyRequest)[REQUEST_TIMER_KEY] =
      createRuntimeTimer();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const timer =
      (request as ParticularTokensFastifyRequest)[REQUEST_TIMER_KEY] ??
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
  app.options("/:tokenId", optionsHandler);
  app.options("/:tokenId/report", optionsHandler);

  app.post<{
    Body: {
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

    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    if (!requireParticularTokenManagementPermission(auth, reply)) {
      return reply;
    }

    const parsed = clinicCreateParticularTokenSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: buildValidationError(parsed.error),
      });
    }

    const result = await clinicOperations.createToken(
      {
        ...parsed.data,
        reportId:
          typeof parsed.data.reportId === "number" ? parsed.data.reportId : null,
        detailsLesion: parsed.data.detailsLesion ?? null,
      },
      {
        clinicId: auth.clinicId,
        clinicUserId: auth.id,
      },
    );

    if (result.kind === "report_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
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
      limit?: unknown;
      offset?: unknown;
    };
  }>("/", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const limit = parsePositiveInt(request.query.limit, 50, 100);
    const offset = parseOffset(request.query.offset, 0);

    const tokens = await clinicOperations.listTokens(
      auth.clinicId,
      limit,
      offset,
    );

    return reply.code(200).send({
      success: true,
      count: tokens.length,
      particularTokens: tokens.map((token) => serializeParticularToken(token)),
      pagination: {
        limit,
        offset,
      },
    });
  });

  app.get<{
    Params: {
      tokenId: string;
    };
  }>("/:tokenId", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const tokenId = parseEntityId(request.params.tokenId);

    if (typeof tokenId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de token inválido",
      });
    }

    const result = await clinicOperations.getToken(
      tokenId,
      auth.clinicId,
    );

    if (result.kind === "not_found") {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

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

    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    if (!requireParticularTokenManagementPermission(auth, reply)) {
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

    const result = await clinicOperations.updateTokenReport(
      tokenId,
      parsed.data.reportId,
      auth.clinicId,
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
};
