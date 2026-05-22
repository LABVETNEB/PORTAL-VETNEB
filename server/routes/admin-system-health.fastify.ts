import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { ENV } from "../lib/env.ts";
import { shouldRefreshSessionLastAccess } from "../lib/session-last-access.ts";

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

async function authenticateAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeAdminSystemHealthDeps,
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
