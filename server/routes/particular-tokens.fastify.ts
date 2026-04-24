import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type { ParticularToken, Report } from "../../drizzle/schema";
import { ENV } from "../lib/env.ts";
import {
  buildValidationError,
  clinicCreateParticularTokenSchema,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeParticularToken,
  serializeParticularTokenDetail,
  updateParticularTokenReportSchema,
} from "../lib/particular-token.ts";
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
  now?: () => number;
};

const REQUEST_START_TIME_KEY = "__particularTokensRequestStartTimeNs";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

type ParticularTokensFastifyRequest = FastifyRequest & {
  [REQUEST_START_TIME_KEY]?: bigint;
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
    | "getReportById"
    | "createParticularToken"
    | "getClinicScopedParticularToken"
    | "listParticularTokens"
    | "updateParticularTokenReport"
  >
>;

let defaultDepsPromise: Promise<NativeParticularTokensDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeParticularTokensDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const dbParticular = await import("../db-particular.ts");

      return {
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        updateSessionLastAccess: db.updateSessionLastAccess,
        generateSessionToken: authSecurity.generateSessionToken,
        hashSessionToken: authSecurity.hashSessionToken,
        getReportById: db.getReportById,
        createParticularToken: dbParticular.createParticularToken,
        getClinicScopedParticularToken:
          dbParticular.getClinicScopedParticularToken,
        listParticularTokens: dbParticular.listParticularTokens,
        updateParticularTokenReport: dbParticular.updateParticularTokenReport,
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
    !!options.getReportById &&
    !!options.createParticularToken &&
    !!options.getClinicScopedParticularToken &&
    !!options.listParticularTokens &&
    !!options.updateParticularTokenReport;

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
    getReportById: options.getReportById ?? defaultDeps!.getReportById,
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
  };

  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(getAllowedOrigins());

  app.addHook("onRequest", async (request, reply) => {
    (request as ParticularTokensFastifyRequest)[REQUEST_START_TIME_KEY] =
      process.hrtime.bigint();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt =
      (request as ParticularTokensFastifyRequest)[REQUEST_START_TIME_KEY] ??
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

    const rawToken = deps.generateSessionToken();
    const tokenHash = deps.hashSessionToken(rawToken);

    const particularToken = await deps.createParticularToken({
      clinicId: auth.clinicId,
      reportId:
        typeof parsed.data.reportId === "number" ? parsed.data.reportId : null,
      createdByAdminId: null,
      createdByClinicUserId: auth.id,
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

    return reply.code(201).send({
      success: true,
      message: "Token particular creado correctamente",
      token: rawToken,
      particularToken: serializeParticularToken(particularToken),
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

    const tokens = await deps.listParticularTokens({
      clinicId: auth.clinicId,
      limit,
      offset,
    });

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

    const token = await deps.getClinicScopedParticularToken(
      tokenId,
      auth.clinicId,
    );

    if (!token) {
      return reply.code(404).send({
        success: false,
        error: "Token particular no encontrado",
      });
    }

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

    const token = await deps.getClinicScopedParticularToken(
      tokenId,
      auth.clinicId,
    );

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

      if (report.clinicId !== auth.clinicId) {
        return reply.code(400).send({
          success: false,
          error: "El informe no pertenece a la clínica autenticada",
        });
      }
    }

    const updated = await deps.updateParticularTokenReport(
      tokenId,
      parsed.data.reportId,
    );

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
};
