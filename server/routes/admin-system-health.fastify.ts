import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { ENV } from "../lib/env.ts";
import {
  getAllowedOrigins,
  getAllowedOriginForCors,
  getRequestOrigin,
} from "../lib/cors-headers.ts";
import { authenticateFastifyAdmin } from "../lib/fastify-admin-auth.ts";
import {
  getObservabilityMetricsSnapshot as getProcessObservabilityMetricsSnapshot,
  type ObservabilityMetricsSnapshot,
} from "../lib/observability-metrics.ts";

type AdminSessionRecord = {
  adminUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type SessionAdminUserRecord = {
  id: number;
  username: string;
};

type AuthenticatedAdminUser = {
  id: number;
  username: string;
  sessionToken: string;
};

type SystemHealthSnapshot = {
  statusCode: number;
  payload: Record<string, unknown>;
};

export type AdminSystemHealthNativeRoutesOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken?: (
    tokenHash: string,
  ) => Promise<AdminSessionRecord | null>;
  getAdminUserById?: (
    adminUserId: number,
  ) => Promise<SessionAdminUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  getSystemHealthSnapshot?: () => Promise<SystemHealthSnapshot>;
  getBackendVersion?: () => string;
  getObservabilityMetricsSnapshot?: () => ObservabilityMetricsSnapshot;
  now?: () => number;
};

type NativeAdminSystemHealthDeps = Required<
  Pick<
    AdminSystemHealthNativeRoutesOptions,
    | "deleteAdminSession"
    | "getAdminSessionByToken"
    | "getAdminUserById"
    | "updateAdminSessionLastAccess"
    | "hashSessionToken"
    | "getSystemHealthSnapshot"
    | "getBackendVersion"
  >
>;

let defaultDepsPromise: Promise<NativeAdminSystemHealthDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeAdminSystemHealthDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const httpRuntime = await import("../lib/http-runtime.ts");

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        getSystemHealthSnapshot: httpRuntime.getHealthCheckResponse,
        getBackendVersion: () => process.env.npm_package_version ?? "unknown",
      };
    })();
  }

  return defaultDepsPromise;
}

async function authenticateAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeAdminSystemHealthDeps,
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

function toMegabytes(value: number) {
  return Math.round((value / 1024 / 1024) * 100) / 100;
}

function buildRuntimePayload() {
  const memory = process.memoryUsage();

  return {
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssMb: toMegabytes(memory.rss),
      heapTotalMb: toMegabytes(memory.heapTotal),
      heapUsedMb: toMegabytes(memory.heapUsed),
      externalMb: toMegabytes(memory.external),
      arrayBuffersMb: toMegabytes(memory.arrayBuffers),
    },
  };
}

function normalizeContactRecipients(values: string[]): string[] {
  const unique = new Set<string>();

  for (const value of values) {
    for (const recipient of value
      .split(/[;,]/g)
      .map((entry) => entry.trim())
      .filter(Boolean)) {
      unique.add(recipient);
    }
  }

  return Array.from(unique);
}

function isLocalOrLanHostname(hostname: string): boolean {
  const normalizedHostname = hostname.trim().toLowerCase();

  if (
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "::1"
  ) {
    return true;
  }

  return normalizedHostname.startsWith("192.168.");
}

function buildCorsReadinessSnapshot() {
  const origins = Array.from(
    new Set(
      ENV.corsOrigins
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  );

  const hasLocalOrLanOrigins = origins.some((origin) => {
    try {
      return isLocalOrLanHostname(new URL(origin).hostname);
    } catch {
      return false;
    }
  });

  return {
    status: origins.length > 0 ? "configured" : "not_configured",
    origins,
    originCount: origins.length,
    hasLocalOrLanOrigins,
  };
}

function getContactEmailRoutingSnapshot() {
  const explicitRecipients = normalizeContactRecipients(ENV.contactTo);
  const fallbackRecipients = ENV.isProduction
    ? []
    : normalizeContactRecipients([
        ENV.gmailApi.enabled ? ENV.gmailApi.from : ENV.smtp.from,
      ]);
  const configuredRecipients =
    explicitRecipients.length > 0 ? explicitRecipients : fallbackRecipients;
  const contactToConfigured = explicitRecipients.length > 0;
  const smtpFromConfigured = ENV.smtp.from.trim().length > 0;
  const gmailApiFromConfigured = ENV.gmailApi.from.trim().length > 0;
  const emailTransportReady = ENV.gmailApi.enabled || ENV.smtp.enabled;
  const contactReady = emailTransportReady && (
    ENV.isProduction ? contactToConfigured : configuredRecipients.length > 0
  );

  return {
    status: contactReady ? "configured" : "degraded",
    recipients: configuredRecipients,
    recipientCount: configuredRecipients.length,
    contactToConfigured,
    smtpFromConfigured,
    gmailApiFromConfigured,
  };
}

function buildServiceChecksPayload(checks: unknown) {
  const baseChecks =
    checks && typeof checks === "object" && !Array.isArray(checks)
      ? (checks as Record<string, unknown>)
      : {};

  const contactRouting = getContactEmailRoutingSnapshot();
  const corsReadiness = buildCorsReadinessSnapshot();

  return {
    ...baseChecks,
    smtp: ENV.smtp.enabled ? "configured" : "not_configured",
    gmail_api: ENV.gmailApi.enabled ? "configured" : "not_configured",
    email_transport: ENV.gmailApi.enabled
      ? "gmail_api"
      : ENV.smtp.enabled
        ? "smtp"
        : "not_configured",
    contact_email: contactRouting.status,
    contact_email_recipients: contactRouting.recipients,
    contact_email_recipient_count: contactRouting.recipientCount,
    contact_to_configured: contactRouting.contactToConfigured,
    smtp_from_configured: contactRouting.smtpFromConfigured,
    gmail_api_from_configured: contactRouting.gmailApiFromConfigured,
    cors: corsReadiness.status,
    cors_origins: corsReadiness.origins,
    cors_origin_count: corsReadiness.originCount,
    cors_has_local_or_lan_origins: corsReadiness.hasLocalOrLanOrigins,
    node_env: ENV.nodeEnv,
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

export const adminSystemHealthNativeRoutes: FastifyPluginAsync<
  AdminSystemHealthNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.deleteAdminSession &&
    !!options.getAdminSessionByToken &&
    !!options.getAdminUserById &&
    !!options.updateAdminSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.getSystemHealthSnapshot &&
    !!options.getBackendVersion;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeAdminSystemHealthDeps = {
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
    getSystemHealthSnapshot:
      options.getSystemHealthSnapshot ?? defaultDeps!.getSystemHealthSnapshot,
    getBackendVersion:
      options.getBackendVersion ?? defaultDeps!.getBackendVersion,
  };

  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(getAllowedOrigins());

  app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply, allowedOrigins);
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
    reply.header("access-control-allow-methods", "GET,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  const getObservabilityMetrics =
    options.getObservabilityMetricsSnapshot ??
    getProcessObservabilityMetricsSnapshot;

  app.options("/", optionsHandler);
  app.options("/metrics", optionsHandler);

  app.get("/metrics", async (request, reply) => {
    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    return reply.code(200).send({
      success: true,
      metrics: getObservabilityMetrics(),
    });
  });

  app.get("/", async (request, reply) => {
    const admin = await authenticateAdminUser(request, reply, deps, now);

    if (!admin) {
      return reply;
    }

    const health = await deps.getSystemHealthSnapshot();
    const healthPayload = health.payload;
    const serviceChecks = buildServiceChecksPayload(healthPayload.checks);

    const status =
      typeof healthPayload.status === "string" ? healthPayload.status : "unknown";

    return reply.code(health.statusCode).send({
      success: health.statusCode >= 200 && health.statusCode < 400,
      status,
      version: deps.getBackendVersion(),
      checkedBy: {
        adminUserId: admin.id,
        username: admin.username,
      },
      services: serviceChecks,
      runtime: buildRuntimePayload(),
      health: healthPayload,
    });
  });
};
