import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { ENV } from "../lib/env.ts";
import { shouldRefreshSessionLastAccess } from "../lib/session-last-access.ts";
import type {
  AdminFailedLoginAlertReason,
  AdminFailedLoginAlertsQuery,
  AdminFailedLoginAlertsSnapshot,
  AdminFailedLoginAlertSurface,
} from "../db-admin-failed-login-alerts.ts";

type AdminSessionRecord = {
  id: number;
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

type AdminFailedLoginAlertsRequestQuery = {
  surface?: string;
  reason?: string;
  limit?: string;
  offset?: string;
};

const ADMIN_FAILED_LOGIN_ALERTS_CSV_EXPORT_MAX_ROWS = 10_000;

type AdminFailedLoginAlertCsvItem =
  AdminFailedLoginAlertsSnapshot["failedLoginAlerts"][number];

const ADMIN_FAILED_LOGIN_ALERT_CSV_HEADERS = [
  "id",
  "surface",
  "username",
  "reason",
  "ipAddress",
  "userAgent",
  "createdAt",
] as const;

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const raw = String(value);

  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }

  return raw;
}

export function buildAdminFailedLoginAlertsCsv(
  items: AdminFailedLoginAlertCsvItem[],
) {
  const rows = items.map((item) =>
    [
      item.id,
      item.surface,
      item.username,
      item.reason,
      item.ipAddress,
      item.userAgent,
      item.createdAt,
    ]
      .map(escapeCsvValue)
      .join(","),
  );

  return [ADMIN_FAILED_LOGIN_ALERT_CSV_HEADERS.join(","), ...rows].join("\n");
}

export function buildAdminFailedLoginAlertsCsvFilename(now = new Date()) {
  const timestamp = now.toISOString().replace(/[:.]/g, "-");

  return `admin-failed-login-alerts-${timestamp}.csv`;
}

export type AdminFailedLoginAlertsNativeRoutesOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken?: (
    tokenHash: string,
  ) => Promise<AdminSessionRecord | null>;
  getAdminUserById?: (
    adminUserId: number,
  ) => Promise<SessionAdminUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  listAdminFailedLoginAlerts?: (
    params: AdminFailedLoginAlertsQuery,
  ) => Promise<AdminFailedLoginAlertsSnapshot>;
  buildAdminFailedLoginAlertsCsv?: (
    items: AdminFailedLoginAlertCsvItem[],
  ) => string;
  buildAdminFailedLoginAlertsCsvFilename?: (now?: Date) => string;
  now?: () => number;
};

type NativeAdminFailedLoginAlertsDeps = Required<
  Pick<
    AdminFailedLoginAlertsNativeRoutesOptions,
    | "deleteAdminSession"
    | "getAdminSessionByToken"
    | "getAdminUserById"
    | "updateAdminSessionLastAccess"
    | "hashSessionToken"
    | "listAdminFailedLoginAlerts"
    | "buildAdminFailedLoginAlertsCsv"
    | "buildAdminFailedLoginAlertsCsvFilename"
  >
>;

let defaultDepsPromise:
  | Promise<NativeAdminFailedLoginAlertsDeps>
  | undefined;

async function loadDefaultDeps(): Promise<NativeAdminFailedLoginAlertsDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const failedLoginAlerts = await import(
        "../db-admin-failed-login-alerts.ts"
      );

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        listAdminFailedLoginAlerts:
          failedLoginAlerts.listAdminFailedLoginAlerts,
        buildAdminFailedLoginAlertsCsv: buildAdminFailedLoginAlertsCsv,
        buildAdminFailedLoginAlertsCsvFilename:
          buildAdminFailedLoginAlertsCsvFilename,
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
  deps: NativeAdminFailedLoginAlertsDeps,
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

function parseSurface(
  value: string | undefined,
): AdminFailedLoginAlertSurface | undefined | null {
  if (value === undefined) return undefined;

  if (value === "admin" || value === "clinic" || value === "particular") {
    return value;
  }

  return null;
}

function parseReason(
  value: string | undefined,
): AdminFailedLoginAlertReason | undefined | null {
  if (value === undefined) return undefined;

  if (
    value === "missing_credentials" ||
    value === "invalid_credentials" ||
    value === "rate_limited"
  ) {
    return value;
  }

  return null;
}

function parseIntegerParam(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  return Math.min(Math.max(parsed, min), max);
}

function parseFailedLoginAlertsQuery(
  query: AdminFailedLoginAlertsRequestQuery,
): AdminFailedLoginAlertsQuery | null {
  const surface = parseSurface(query.surface);
  const reason = parseReason(query.reason);
  const limit = parseIntegerParam(query.limit, 50, 1, 100);
  const offset = parseIntegerParam(query.offset, 0, 0, 100_000);

  if (
    surface === null ||
    reason === null ||
    limit === null ||
    offset === null
  ) {
    return null;
  }

  return {
    ...(surface ? { surface } : {}),
    ...(reason ? { reason } : {}),
    limit,
    offset,
  };
}

export const adminFailedLoginAlertsNativeRoutes: FastifyPluginAsync<
  AdminFailedLoginAlertsNativeRoutesOptions
> = async (app, options) => {
  const now = options.now ?? (() => Date.now());

  async function resolveDeps(): Promise<NativeAdminFailedLoginAlertsDeps> {
    const hasAllInjectedDeps =
      !!options.deleteAdminSession &&
      !!options.getAdminSessionByToken &&
      !!options.getAdminUserById &&
      !!options.updateAdminSessionLastAccess &&
      !!options.hashSessionToken &&
      !!options.listAdminFailedLoginAlerts &&
      !!options.buildAdminFailedLoginAlertsCsv &&
      !!options.buildAdminFailedLoginAlertsCsvFilename;

    const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

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
      listAdminFailedLoginAlerts:
        options.listAdminFailedLoginAlerts ??
        defaultDeps!.listAdminFailedLoginAlerts,
      buildAdminFailedLoginAlertsCsv:
        options.buildAdminFailedLoginAlertsCsv ??
        buildAdminFailedLoginAlertsCsv,
      buildAdminFailedLoginAlertsCsvFilename:
        options.buildAdminFailedLoginAlertsCsvFilename ??
        buildAdminFailedLoginAlertsCsvFilename,
    };
  }

  app.get<{ Querystring: AdminFailedLoginAlertsRequestQuery }>(
    "/export.csv",
    async (request, reply) => {
      const deps = await resolveDeps();
      const admin = await authenticateAdminUser(request, reply, deps, now);

      if (!admin) {
        return reply;
      }

      const params = parseFailedLoginAlertsQuery(request.query);

      if (!params) {
        return reply.code(400).send({
          success: false,
          error:
            "Query inválida. surface debe ser admin, clinic o particular; reason debe ser missing_credentials, invalid_credentials o rate_limited; limit/offset deben ser enteros válidos.",
        });
      }

      const exportParams: AdminFailedLoginAlertsQuery = {
        ...params,
        limit: ADMIN_FAILED_LOGIN_ALERTS_CSV_EXPORT_MAX_ROWS,
        offset: 0,
      };

      const snapshot = await deps.listAdminFailedLoginAlerts(exportParams);

      if (snapshot.total > ADMIN_FAILED_LOGIN_ALERTS_CSV_EXPORT_MAX_ROWS) {
        return reply.code(400).send({
          success: false,
          error: `Demasiados registros para exportar. Aplica filtros mas especificos (maximo ${ADMIN_FAILED_LOGIN_ALERTS_CSV_EXPORT_MAX_ROWS}).`,
        });
      }

      const csv = deps.buildAdminFailedLoginAlertsCsv(
        snapshot.failedLoginAlerts,
      );
      const filename = deps.buildAdminFailedLoginAlertsCsvFilename();

      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header(
        "content-disposition",
        `attachment; filename="${filename}"`,
      );

      return reply.code(200).send(csv);
    },
  );

  app.get<{ Querystring: AdminFailedLoginAlertsRequestQuery }>(
    "/",
    async (request, reply) => {
      const deps = await resolveDeps();
      const admin = await authenticateAdminUser(request, reply, deps, now);

      if (!admin) {
        return reply;
      }

      const params = parseFailedLoginAlertsQuery(request.query);

      if (!params) {
        return reply.code(400).send({
          success: false,
          error:
            "Query inválida. surface debe ser admin, clinic o particular; reason debe ser missing_credentials, invalid_credentials o rate_limited; limit/offset deben ser enteros válidos.",
        });
      }

      const snapshot = await deps.listAdminFailedLoginAlerts(params);

      return reply.code(200).send({
        ...snapshot,
        checkedBy: {
          adminUserId: admin.id,
          username: admin.username,
        },
      });
    },
  );
};
