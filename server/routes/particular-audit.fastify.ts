import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  buildAdminAuditCsv as defaultBuildAuditCsv,
  buildParticularAuditCsvFilename as defaultBuildParticularAuditCsvFilename,
  buildParticularAuditListFilters as defaultBuildParticularAuditListFilters,
  type AdminAuditListFilters,
  type AuditLogListItem,
} from "../lib/admin-audit.ts";
import { ENV } from "../lib/env.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";

type ParticularSessionRecord = {
  particularTokenId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type ParticularTokenAuthRecord = {
  id: number;
  clinicId: number;
  reportId: number | null;
  isActive: boolean;
};

type AuthenticatedParticularUser = {
  tokenId: number;
  clinicId: number;
  reportId: number | null;
  sessionToken: string;
};

type AuditListResult = {
  items: AuditLogListItem[];
  total: number;
};

export type ParticularAuditNativeRoutesOptions = {
  deleteParticularSession?: (tokenHash: string) => Promise<void>;
  getParticularSessionByToken?: (
    tokenHash: string,
  ) => Promise<ParticularSessionRecord | null>;
  getParticularTokenById?: (
    id: number,
  ) => Promise<ParticularTokenAuthRecord | null>;
  updateParticularSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  listParticularAuditLog?: (
    filters: AdminAuditListFilters,
    particularTokenId: number,
  ) => Promise<AuditListResult>;
  buildParticularAuditListFilters?: (
    query: Record<string, unknown>,
  ) => {
    filters: AdminAuditListFilters;
    errors: string[];
  };
  buildAuditCsv?: (items: AuditLogListItem[]) => string;
  buildParticularAuditCsvFilename?: (now?: Date) => string;
  now?: () => number;
};

const REQUEST_START_TIME_KEY = "__particularAuditRequestStartTimeNs";
const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;
const PARTICULAR_AUDIT_CSV_EXPORT_MAX_ROWS = 10_000;

type ParticularAuditFastifyRequest = FastifyRequest & {
  [REQUEST_START_TIME_KEY]?: bigint;
};

type NativeParticularAuditDeps = Required<
  Pick<
    ParticularAuditNativeRoutesOptions,
    | "deleteParticularSession"
    | "getParticularSessionByToken"
    | "getParticularTokenById"
    | "updateParticularSessionLastAccess"
    | "hashSessionToken"
    | "listParticularAuditLog"
    | "buildParticularAuditListFilters"
    | "buildAuditCsv"
    | "buildParticularAuditCsvFilename"
  >
>;

let defaultDepsPromise: Promise<NativeParticularAuditDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeParticularAuditDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const authSecurity = await import("../lib/auth-security.ts");
      const dbParticular = await import("../db-particular.ts");
      const dbAudit = await import("../db-audit.ts");

      return {
        deleteParticularSession: dbParticular.deleteParticularSession,
        getParticularSessionByToken: dbParticular.getParticularSessionByToken,
        getParticularTokenById: dbParticular.getParticularTokenById,
        updateParticularSessionLastAccess:
          dbParticular.updateParticularSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        listParticularAuditLog: dbAudit.listParticularAuditLog,
        buildParticularAuditListFilters:
          defaultBuildParticularAuditListFilters,
        buildAuditCsv: defaultBuildAuditCsv,
        buildParticularAuditCsvFilename:
          defaultBuildParticularAuditCsvFilename,
      };
    })();
  }

  return defaultDepsPromise;
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

function getParticularSessionToken(request: FastifyRequest) {
  const cookieHeader =
    typeof request.headers.cookie === "string"
      ? request.headers.cookie
      : undefined;

  const cookies = parseCookies(cookieHeader);
  const raw = cookies[ENV.particularCookieName];

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

function buildClearParticularSessionCookie() {
  return serializeCookie({
    name: ENV.particularCookieName,
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

async function authenticateParticularUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeParticularAuditDeps,
  now: () => number,
): Promise<AuthenticatedParticularUser | null> {
  const token = getParticularSessionToken(request);

  if (!token) {
    reply.code(401).send({
      success: false,
      error: "Particular no autenticado",
    });
    return null;
  }

  const tokenHash = deps.hashSessionToken(token);
  const session = await deps.getParticularSessionByToken(tokenHash);

  if (!session) {
    reply.code(401).send({
      success: false,
      error: "Sesión particular inválida",
    });
    return null;
  }

  if (session.expiresAt && session.expiresAt.getTime() <= now()) {
    await deps.deleteParticularSession(tokenHash);

    reply.header("set-cookie", buildClearParticularSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Sesión particular expirada",
    });
    return null;
  }

  const particularToken = await deps.getParticularTokenById(
    session.particularTokenId,
  );

  if (!particularToken || !particularToken.isActive) {
    await deps.deleteParticularSession(tokenHash);

    reply.header("set-cookie", buildClearParticularSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Token particular inválido o inactivo",
    });
    return null;
  }

  if (shouldRefreshSessionLastAccess(session.lastAccess ?? null, now())) {
    await deps.updateParticularSessionLastAccess(tokenHash);
  }

  return {
    tokenId: particularToken.id,
    clinicId: particularToken.clinicId,
    reportId: particularToken.reportId ?? null,
    sessionToken: token,
  };
}

export const particularAuditNativeRoutes: FastifyPluginAsync<
  ParticularAuditNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.deleteParticularSession &&
    !!options.getParticularSessionByToken &&
    !!options.getParticularTokenById &&
    !!options.updateParticularSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.listParticularAuditLog &&
    !!options.buildParticularAuditListFilters &&
    !!options.buildAuditCsv &&
    !!options.buildParticularAuditCsvFilename;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeParticularAuditDeps = {
    deleteParticularSession:
      options.deleteParticularSession ??
      defaultDeps!.deleteParticularSession,
    getParticularSessionByToken:
      options.getParticularSessionByToken ??
      defaultDeps!.getParticularSessionByToken,
    getParticularTokenById:
      options.getParticularTokenById ?? defaultDeps!.getParticularTokenById,
    updateParticularSessionLastAccess:
      options.updateParticularSessionLastAccess ??
      defaultDeps!.updateParticularSessionLastAccess,
    hashSessionToken:
      options.hashSessionToken ?? defaultDeps!.hashSessionToken,
    listParticularAuditLog:
      options.listParticularAuditLog ?? defaultDeps!.listParticularAuditLog,
    buildParticularAuditListFilters:
      options.buildParticularAuditListFilters ??
      defaultDeps!.buildParticularAuditListFilters,
    buildAuditCsv: options.buildAuditCsv ?? defaultDeps!.buildAuditCsv,
    buildParticularAuditCsvFilename:
      options.buildParticularAuditCsvFilename ??
      defaultDeps!.buildParticularAuditCsvFilename,
  };

  const now = options.now ?? (() => Date.now());

  app.addHook("onRequest", async (request) => {
    (request as ParticularAuditFastifyRequest)[REQUEST_START_TIME_KEY] =
      process.hrtime.bigint();

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt =
      (request as ParticularAuditFastifyRequest)[REQUEST_START_TIME_KEY] ??
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

  app.get<{
    Querystring: Record<string, unknown>;
  }>("/export.csv", async (request, reply) => {
    const particular = await authenticateParticularUser(
      request,
      reply,
      deps,
      now,
    );

    if (!particular) {
      return reply;
    }

    const { filters, errors } = deps.buildParticularAuditListFilters(
      request.query ?? {},
    );

    if (errors.length > 0) {
      return reply.code(400).send({
        success: false,
        error: errors[0],
      });
    }

    const exportFilters: AdminAuditListFilters = {
      ...filters,
      limit: PARTICULAR_AUDIT_CSV_EXPORT_MAX_ROWS,
      offset: 0,
    };

    const result = await deps.listParticularAuditLog(
      exportFilters,
      particular.tokenId,
    );

    if (result.total > PARTICULAR_AUDIT_CSV_EXPORT_MAX_ROWS) {
      return reply.code(400).send({
        success: false,
        error: `Demasiados registros para exportar. Aplica filtros mas especificos (maximo ${PARTICULAR_AUDIT_CSV_EXPORT_MAX_ROWS}).`,
      });
    }

    const csv = deps.buildAuditCsv(result.items);
    const filename = deps.buildParticularAuditCsvFilename();

    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header(
      "content-disposition",
      `attachment; filename="${filename}"`,
    );

    return reply.code(200).send(csv);
  });

  app.get<{
    Querystring: Record<string, unknown>;
  }>("/", async (request, reply) => {
    const particular = await authenticateParticularUser(
      request,
      reply,
      deps,
      now,
    );

    if (!particular) {
      return reply;
    }

    const { filters, errors } = deps.buildParticularAuditListFilters(
      request.query ?? {},
    );

    if (errors.length > 0) {
      return reply.code(400).send({
        success: false,
        error: errors[0],
      });
    }

    const result = await deps.listParticularAuditLog(
      filters,
      particular.tokenId,
    );

    return reply.code(200).send({
      success: true,
      count: result.items.length,
      items: result.items,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: result.total,
      },
      filters: {
        event: filters.event ?? null,
        actorType: filters.actorType ?? null,
        reportId: filters.reportId ?? null,
        particularTokenId: particular.tokenId,
        from: filters.from ?? null,
        to: filters.to ?? null,
      },
    });
  });
};
