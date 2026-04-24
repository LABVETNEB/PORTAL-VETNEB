import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { Report, ReportAccessToken } from "../../drizzle/schema";

import {
  AUDIT_EVENTS,
  buildPublicReportAccessTokenActor,
} from "../lib/audit.ts";
import { hashSessionToken as defaultHashSessionToken } from "../lib/auth-security.ts";
import {
  PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE,
  PUBLIC_REPORT_ACCESS_RATE_LIMIT_MAX_ATTEMPTS,
  PUBLIC_REPORT_ACCESS_RATE_LIMIT_WINDOW_MS,
} from "../lib/public-report-access-rate-limit.ts";
import {
  canAccessReportPublicly,
  getReportAccessTokenState,
  reportAccessTokenRawTokenSchema,
  serializePublicReportAccess,
} from "../lib/report-access-token.ts";
import {
  createSignedReportDownloadUrl as defaultCreateSignedReportDownloadUrl,
  createSignedReportUrl as defaultCreateSignedReportUrl,
} from "../lib/supabase.ts";
import { ENV } from "../lib/env.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";

type ReportAccessTokenWithReportRecord = {
  token: ReportAccessToken;
  report: Report;
};

type PublicReportAccessAuditInput = {
  event: string;
  clinicId?: number | null;
  reportId?: number | null;
  targetReportAccessTokenId?: number | null;
  actor?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type PublicReportAccessNativeRoutesOptions = {
  getReportAccessTokenWithReportByTokenHash?: (
    tokenHash: string,
  ) => Promise<ReportAccessTokenWithReportRecord | null>;
  recordReportAccessTokenAccess?: (
    tokenId: number,
  ) => Promise<ReportAccessToken | null>;
  createSignedReportUrl?: (storagePath: string) => Promise<string>;
  createSignedReportDownloadUrl?: (
    storagePath: string,
    fileName?: string,
  ) => Promise<string>;
  hashSessionToken?: (token: string) => string;
  writeAuditLog?: (
    req: unknown,
    input: PublicReportAccessAuditInput,
  ) => Promise<void>;
  publicReportAccessRateLimitWindowMs?: number;
  publicReportAccessRateLimitMaxAttempts?: number;
  now?: () => number;
};

const REQUEST_START_TIME_KEY = "__publicReportAccessRequestStartTimeNs";

type PublicReportAccessFastifyRequest = FastifyRequest & {
  [REQUEST_START_TIME_KEY]?: bigint;
};

type NativePublicReportAccessDeps = Required<
  Pick<
    PublicReportAccessNativeRoutesOptions,
    | "getReportAccessTokenWithReportByTokenHash"
    | "recordReportAccessTokenAccess"
    | "createSignedReportUrl"
    | "createSignedReportDownloadUrl"
    | "hashSessionToken"
    | "writeAuditLog"
  >
>;

let defaultDepsPromise: Promise<NativePublicReportAccessDeps> | undefined;

async function loadDefaultDeps(): Promise<NativePublicReportAccessDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const dbReportAccess = await import("../db-report-access.ts");
      const audit = await import("../lib/audit.ts");

      return {
        getReportAccessTokenWithReportByTokenHash:
          dbReportAccess.getReportAccessTokenWithReportByTokenHash,
        recordReportAccessTokenAccess:
          dbReportAccess.recordReportAccessTokenAccess,
        createSignedReportUrl: defaultCreateSignedReportUrl,
        createSignedReportDownloadUrl: defaultCreateSignedReportDownloadUrl,
        hashSessionToken: defaultHashSessionToken,
        writeAuditLog: audit.writeAuditLog as (
          req: unknown,
          input: PublicReportAccessAuditInput,
        ) => Promise<void>,
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
  reply.header(
    "access-control-expose-headers",
    "RateLimit-Policy, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset",
  );
}

function setRateLimitHeaders(
  reply: FastifyReply,
  input: {
    max: number;
    windowMs: number;
    count: number;
    resetAt: number;
    now: number;
  },
) {
  reply.header(
    "RateLimit-Policy",
    `${input.max};w=${Math.ceil(input.windowMs / 1000)}`,
  );
  reply.header("RateLimit-Limit", String(input.max));
  reply.header(
    "RateLimit-Remaining",
    String(Math.max(input.max - input.count, 0)),
  );
  reply.header(
    "RateLimit-Reset",
    String(Math.max(Math.ceil((input.resetAt - input.now) / 1000), 0)),
  );
}

function getAccessEntry(
  attempts: Map<string, { count: number; resetAt: number }>,
  key: string,
  windowMs: number,
  now: number,
) {
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    const fresh = {
      count: 0,
      resetAt: now + windowMs,
    };
    attempts.set(key, fresh);
    return fresh;
  }

  return current;
}

export const publicReportAccessNativeRoutes: FastifyPluginAsync<
  PublicReportAccessNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.getReportAccessTokenWithReportByTokenHash &&
    !!options.recordReportAccessTokenAccess &&
    !!options.createSignedReportUrl &&
    !!options.createSignedReportDownloadUrl &&
    !!options.hashSessionToken &&
    !!options.writeAuditLog;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativePublicReportAccessDeps = {
    getReportAccessTokenWithReportByTokenHash:
      options.getReportAccessTokenWithReportByTokenHash ??
      defaultDeps!.getReportAccessTokenWithReportByTokenHash,
    recordReportAccessTokenAccess:
      options.recordReportAccessTokenAccess ??
      defaultDeps!.recordReportAccessTokenAccess,
    createSignedReportUrl:
      options.createSignedReportUrl ?? defaultDeps!.createSignedReportUrl,
    createSignedReportDownloadUrl:
      options.createSignedReportDownloadUrl ??
      defaultDeps!.createSignedReportDownloadUrl,
    hashSessionToken: options.hashSessionToken ?? defaultDeps!.hashSessionToken,
    writeAuditLog: options.writeAuditLog ?? defaultDeps!.writeAuditLog,
  };

  const now = options.now ?? (() => Date.now());
  const publicReportAccessRateLimitWindowMs =
    options.publicReportAccessRateLimitWindowMs ??
    PUBLIC_REPORT_ACCESS_RATE_LIMIT_WINDOW_MS;
  const publicReportAccessRateLimitMaxAttempts =
    options.publicReportAccessRateLimitMaxAttempts ??
    PUBLIC_REPORT_ACCESS_RATE_LIMIT_MAX_ATTEMPTS;
  const allowedOrigins = new Set(getAllowedOrigins());
  const accessAttempts = new Map<string, { count: number; resetAt: number }>();

  app.addHook("onRequest", async (request, reply) => {
    (request as PublicReportAccessFastifyRequest)[REQUEST_START_TIME_KEY] =
      process.hrtime.bigint();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt =
      (request as PublicReportAccessFastifyRequest)[REQUEST_START_TIME_KEY] ??
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

  app.options("/:token", async (request, reply) => {
    applyCorsHeaders(request, reply, allowedOrigins);
    reply.header("access-control-allow-methods", "GET,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  });

  app.get<{
    Params: {
      token: string;
    };
  }>("/:token", async (request, reply) => {
    const rateLimitKey = request.ip || "unknown";
    const currentTime = now();
    const accessEntry = getAccessEntry(
      accessAttempts,
      rateLimitKey,
      publicReportAccessRateLimitWindowMs,
      currentTime,
    );

    if (accessEntry.count >= publicReportAccessRateLimitMaxAttempts) {
      setRateLimitHeaders(reply, {
        max: publicReportAccessRateLimitMaxAttempts,
        windowMs: publicReportAccessRateLimitWindowMs,
        count: accessEntry.count,
        resetAt: accessEntry.resetAt,
        now: currentTime,
      });

      return reply.code(429).send({
        success: false,
        error: PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE,
      });
    }

    accessEntry.count += 1;

    setRateLimitHeaders(reply, {
      max: publicReportAccessRateLimitMaxAttempts,
      windowMs: publicReportAccessRateLimitWindowMs,
      count: accessEntry.count,
      resetAt: accessEntry.resetAt,
      now: currentTime,
    });

    const parsed = reportAccessTokenRawTokenSchema.safeParse(request.params.token);

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: "Token de acceso inválido",
      });
    }

    const tokenHash = deps.hashSessionToken(parsed.data);
    const record = await deps.getReportAccessTokenWithReportByTokenHash(tokenHash);

    if (!record) {
      return reply.code(404).send({
        success: false,
        error: "Token público de informe no encontrado",
      });
    }

    const tokenState = getReportAccessTokenState(record.token);

    if (tokenState === "revoked") {
      return reply.code(410).send({
        success: false,
        error: "El token público de informe fue revocado",
      });
    }

    if (tokenState === "expired") {
      return reply.code(410).send({
        success: false,
        error: "El token público de informe expiró",
      });
    }

    if (!canAccessReportPublicly(record.report.currentStatus)) {
      return reply.code(409).send({
        success: false,
        error: "El informe todavía no está disponible para acceso público",
        currentStatus: record.report.currentStatus,
      });
    }

    const updatedToken = await deps.recordReportAccessTokenAccess(record.token.id);
    const [previewUrl, downloadUrl] = await Promise.all([
      deps.createSignedReportUrl(record.report.storagePath),
      deps.createSignedReportDownloadUrl(
        record.report.storagePath,
        record.report.fileName ?? undefined,
      ),
    ]);

    await deps.writeAuditLog(request, {
      event: AUDIT_EVENTS.REPORT_PUBLIC_ACCESSED,
      clinicId: record.token.clinicId,
      reportId: record.token.reportId,
      targetReportAccessTokenId: record.token.id,
      actor: buildPublicReportAccessTokenActor(record.token.id),
      metadata: {
        tokenLast4: record.token.tokenLast4,
        accessCount: updatedToken?.accessCount ?? record.token.accessCount + 1,
        lastAccessAt: updatedToken?.lastAccessAt ?? new Date(currentTime),
      },
    });

    return reply.code(200).send({
      success: true,
      report: serializePublicReportAccess({
        report: record.report,
        previewUrl,
        downloadUrl,
      }),
      token: {
        accessCount: updatedToken?.accessCount ?? record.token.accessCount + 1,
        lastAccessAt: updatedToken?.lastAccessAt ?? new Date(currentTime),
        expiresAt: record.token.expiresAt,
      },
    });
  });
};
