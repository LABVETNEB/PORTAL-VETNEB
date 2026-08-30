import type {
  FastifyPluginAsync,
  FastifyRequest,
} from "fastify";

import {
  buildAuditCsv as defaultBuildAdminAuditCsv,
  buildClinicAuditCsvFilename,
  buildClinicAuditListFilters as defaultBuildClinicAuditListFilters,
  type AuditListFilters as AdminAuditListFilters,
  type AuditLogListItem,
} from "../lib/clinic-audit.ts";
import { logRequestCompletion } from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";
import {
  getClinicPermissions,
  normalizeClinicUserRole,
} from "../lib/permissions.ts";
import {
  authenticateFastifyClinicUser,
  type FastifyAuthenticatedClinicUser,
} from "../lib/fastify-clinic-auth.ts";

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

type AuditListResult = {
  items: AuditLogListItem[];
  total: number;
};

type AuthenticatedClinicUser = {
  id: number;
  clinicId: number;
  username: string;
  authProId: string | null;
  role: ReturnType<typeof normalizeClinicUserRole>;
  permissions: ReturnType<typeof getClinicPermissions>;
  canManageClinicUsers: boolean;
  sessionToken: string;
};

export type ClinicAuditNativeRoutesOptions = {
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<ActiveSessionRecord | null>;
  getClinicUserById?: (
    clinicUserId: number,
  ) => Promise<ClinicUserRecord | null>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  listAuditLog?: (filters: AdminAuditListFilters) => Promise<AuditListResult>;
  buildClinicAuditListFilters?: (
    query: Record<string, unknown>,
    clinicId: number,
  ) => {
    filters: AdminAuditListFilters;
    errors: string[];
  };
  buildAdminAuditCsv?: (items: AuditLogListItem[]) => string;
  now?: () => number;
};

const REQUEST_TIMER_KEY = "__clinicAuditRequestTimer";
const CLINIC_AUDIT_CSV_EXPORT_MAX_ROWS = 10_000;

type ClinicAuditFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
};

type NativeClinicAuditDeps = Required<
  Pick<
    ClinicAuditNativeRoutesOptions,
    | "deleteActiveSession"
    | "getActiveSessionByToken"
    | "getClinicUserById"
    | "updateSessionLastAccess"
    | "hashSessionToken"
    | "listAuditLog"
    | "buildClinicAuditListFilters"
    | "buildAdminAuditCsv"
  >
>;

let defaultDepsPromise: Promise<NativeClinicAuditDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeClinicAuditDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const dbAudit = await import("../db-audit.ts");

      return {
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        updateSessionLastAccess: db.updateSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        listAuditLog: dbAudit.listAuditLog,
        buildClinicAuditListFilters: defaultBuildClinicAuditListFilters,
        buildAdminAuditCsv: defaultBuildAdminAuditCsv,
      };
    })();
  }

  return defaultDepsPromise!;
}

function getClinicAuditAuthorization(
  auth: FastifyAuthenticatedClinicUser,
): AuthenticatedClinicUser {
  const permissions = getClinicPermissions(auth.role);

  return {
    ...auth,
    permissions,
    canManageClinicUsers: permissions.canManageClinicUsers,
  };
}

export const clinicAuditNativeRoutes: FastifyPluginAsync<
  ClinicAuditNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.updateSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.listAuditLog &&
    !!options.buildClinicAuditListFilters &&
    !!options.buildAdminAuditCsv;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeClinicAuditDeps = {
    deleteActiveSession:
      options.deleteActiveSession ?? defaultDeps!.deleteActiveSession,
    getActiveSessionByToken:
      options.getActiveSessionByToken ?? defaultDeps!.getActiveSessionByToken,
    getClinicUserById:
      options.getClinicUserById ?? defaultDeps!.getClinicUserById,
    updateSessionLastAccess:
      options.updateSessionLastAccess ?? defaultDeps!.updateSessionLastAccess,
    hashSessionToken:
      options.hashSessionToken ?? defaultDeps!.hashSessionToken,
    listAuditLog: options.listAuditLog ?? defaultDeps!.listAuditLog,
    buildClinicAuditListFilters:
      options.buildClinicAuditListFilters ??
      defaultDeps!.buildClinicAuditListFilters,
    buildAdminAuditCsv:
      options.buildAdminAuditCsv ?? defaultDeps!.buildAdminAuditCsv,
  };

  const now = options.now ?? (() => Date.now());

  app.addHook("onRequest", async (request) => {
    (request as ClinicAuditFastifyRequest)[REQUEST_TIMER_KEY] =
      createRuntimeTimer();

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const timer =
      (request as ClinicAuditFastifyRequest)[REQUEST_TIMER_KEY] ??
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

  app.get<{
    Querystring: Record<string, unknown>;
  }>("/export.csv", async (request, reply) => {
    const clinicAuth = await authenticateFastifyClinicUser(
      request,
      reply,
      deps,
      now,
    );

    if (!clinicAuth) {
      return reply;
    }

    const auth = getClinicAuditAuthorization(clinicAuth);

    const { filters, errors } = deps.buildClinicAuditListFilters(
      request.query ?? {},
      auth.clinicId,
    );

    if (errors.length > 0) {
      return reply.code(400).send({
        success: false,
        error: errors[0],
      });
    }

    const exportFilters: AdminAuditListFilters = {
      ...filters,
      limit: CLINIC_AUDIT_CSV_EXPORT_MAX_ROWS,
      offset: 0,
    };

    const result = await deps.listAuditLog(exportFilters);

    if (result.total > CLINIC_AUDIT_CSV_EXPORT_MAX_ROWS) {
      return reply.code(400).send({
        success: false,
        error: `Demasiados registros para exportar. Aplica filtros mas especificos (maximo ${CLINIC_AUDIT_CSV_EXPORT_MAX_ROWS}).`,
      });
    }

    const csv = deps.buildAdminAuditCsv(result.items);
    const filename = buildClinicAuditCsvFilename();

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
    const clinicAuth = await authenticateFastifyClinicUser(
      request,
      reply,
      deps,
      now,
    );

    if (!clinicAuth) {
      return reply;
    }

    const auth = getClinicAuditAuthorization(clinicAuth);

    const { filters, errors } = deps.buildClinicAuditListFilters(
      request.query ?? {},
      auth.clinicId,
    );

    if (errors.length > 0) {
      return reply.code(400).send({
        success: false,
        error: errors[0],
      });
    }

    const result = await deps.listAuditLog(filters);

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
        clinicId: auth.clinicId,
        reportId: filters.reportId ?? null,
        actorClinicUserId: filters.actorClinicUserId ?? null,
        actorReportAccessTokenId: filters.actorReportAccessTokenId ?? null,
        targetReportAccessTokenId: filters.targetReportAccessTokenId ?? null,
        from: filters.from ?? null,
        to: filters.to ?? null,
      },
    });
  });
};
