import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { Report, ReportAccessToken } from "../../drizzle/schema.ts";

import { buildPublicReportAccessTokenActor } from "../lib/audit.ts";
import { createPublicReportAccessOperations } from "../features/report-access/application/index.ts";
import { loadReportAccessRepository } from "../features/report-access/composition/report-access-route-composition.ts";
import { hashSessionToken as defaultHashSessionToken } from "../lib/auth-security.ts";
import {
  PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE,
  PUBLIC_REPORT_ACCESS_RATE_LIMIT_MAX_ATTEMPTS,
  PUBLIC_REPORT_ACCESS_RATE_LIMIT_WINDOW_MS,
} from "../lib/public-report-access-rate-limit.ts";
import {
  createPersistentRateLimitStore,
  consumeRateLimitAttempt,
  type RateLimitStore,
} from "../lib/rate-limit-store.ts";
import {
  reportAccessTokenRawTokenSchema,
  serializePublicReportAccess,
} from "../features/report-access/index.ts";
import {
  createSignedReportDownloadUrl as defaultCreateSignedReportDownloadUrl,
  createSignedReportUrl as defaultCreateSignedReportUrl,
} from "../lib/supabase.ts";
import { ENV } from "../lib/env.ts";
import {
  getAllowedOrigins,
  getAllowedOriginForCors,
} from "../lib/cors-headers.ts";
import { logRequestCompletion } from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";

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
  publicReportAccessRateLimitStore?: RateLimitStore;
  now?: () => number;
};

const REQUEST_TIMER_KEY = "__publicReportAccessRequestTimer";

type PublicReportAccessFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
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

type NativePublicReportAccessDefaultDeps = NativePublicReportAccessDeps & {
  publicReportAccessRateLimitStore: RateLimitStore;
};

const REPORT_NOT_FOUND_RESPONSE = {
  success: false,
  error: "Informe no encontrado",
} as const;

let defaultDepsPromise:
  | Promise<NativePublicReportAccessDefaultDeps>
  | undefined;

async function loadDefaultDeps(): Promise<NativePublicReportAccessDefaultDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const reportAccessRepository = await loadReportAccessRepository();
      const audit = await import("../lib/audit.ts");
      const db = await import("../db.ts");

      return {
        getReportAccessTokenWithReportByTokenHash:
          reportAccessRepository.getReportAccessTokenWithReportByTokenHash,
        recordReportAccessTokenAccess:
          reportAccessRepository.recordReportAccessTokenAccess,
        createSignedReportUrl: defaultCreateSignedReportUrl,
        createSignedReportDownloadUrl: defaultCreateSignedReportDownloadUrl,
        hashSessionToken: defaultHashSessionToken,
        writeAuditLog: audit.writeAuditLog as (
          req: unknown,
          input: PublicReportAccessAuditInput,
        ) => Promise<void>,
        publicReportAccessRateLimitStore: createPersistentRateLimitStore({
          get: db.getLoginRateLimitEntry,
          set: db.setLoginRateLimitEntry,
          increment: db.incrementLoginRateLimitEntry,
          consume: db.consumeLoginRateLimitAttempt,
          cleanupExpired: db.deleteExpiredLoginRateLimitEntries,
          delete: db.deleteLoginRateLimitEntry,
        }),
      };
    })();
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

export const publicReportAccessNativeRoutes: FastifyPluginAsync<
  PublicReportAccessNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.getReportAccessTokenWithReportByTokenHash &&
    !!options.recordReportAccessTokenAccess &&
    !!options.createSignedReportUrl &&
    !!options.createSignedReportDownloadUrl &&
    !!options.hashSessionToken &&
    !!options.writeAuditLog &&
    !!options.publicReportAccessRateLimitStore;

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
  const reportAccess = createPublicReportAccessOperations({
    ...deps,
    buildPublicActor: buildPublicReportAccessTokenActor,
  });
  const publicReportAccessRateLimitWindowMs =
    options.publicReportAccessRateLimitWindowMs ??
    PUBLIC_REPORT_ACCESS_RATE_LIMIT_WINDOW_MS;
  const publicReportAccessRateLimitMaxAttempts =
    options.publicReportAccessRateLimitMaxAttempts ??
    PUBLIC_REPORT_ACCESS_RATE_LIMIT_MAX_ATTEMPTS;
  const allowedOrigins = new Set(getAllowedOrigins());
  const publicReportAccessRateLimitStore =
    options.publicReportAccessRateLimitStore ??
    defaultDeps!.publicReportAccessRateLimitStore;

  app.addHook("onRequest", async (request, reply) => {
    (request as PublicReportAccessFastifyRequest)[REQUEST_TIMER_KEY] =
      createRuntimeTimer();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const timer =
      (request as PublicReportAccessFastifyRequest)[REQUEST_TIMER_KEY] ??
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
    const accessEntry = await consumeRateLimitAttempt(
      publicReportAccessRateLimitStore,
      rateLimitKey,
      { windowMs: publicReportAccessRateLimitWindowMs, now: currentTime },
    );

    if (accessEntry.count > publicReportAccessRateLimitMaxAttempts) {
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

    setRateLimitHeaders(reply, {
      max: publicReportAccessRateLimitMaxAttempts,
      windowMs: publicReportAccessRateLimitWindowMs,
      count: accessEntry.count,
      resetAt: accessEntry.resetAt,
      now: currentTime,
    });

    const parsed = reportAccessTokenRawTokenSchema.safeParse(request.params.token);

    if (!parsed.success) {
      return reply.code(404).send(REPORT_NOT_FOUND_RESPONSE);
    }

    const result = await reportAccess.access(
      parsed.data,
      currentTime,
      request,
    );

    if (result.kind === "not_found") {
      return reply.code(404).send(REPORT_NOT_FOUND_RESPONSE);
    }

    if (result.kind === "unavailable") {
      return reply.code(409).send({
        success: false,
        error: "El informe todavía no está disponible para acceso público",
        currentStatus: result.currentStatus,
      });
    }

    return reply.code(200).send({
      success: true,
      report: serializePublicReportAccess({
        report: result.report,
        previewUrl: result.previewUrl,
        downloadUrl: result.downloadUrl,
      }),
      token: {
        accessCount: result.accessCount,
        lastAccessAt: result.lastAccessAt,
        expiresAt: result.expiresAt,
      },
    });
  });
};
