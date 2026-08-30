import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type { Report, ReportStatus } from "../../drizzle/schema.ts";
import { AUDIT_EVENTS } from "../lib/audit.ts";
import {
  enforceTrustedOrigin,
  getAllowedOrigins,
  getAllowedOriginForCors,
  getRequestOrigin,
} from "../lib/cors-headers.ts";
import {
  REPORT_STATUSES,
  normalizeOptionalNote,
  parseReportId,
  parseReportStatus,
} from "../features/reports/domain/index.ts";
import { createClinicReportStatusRouteComposition } from "../features/reports/composition/index.ts";
import {
  getClinicPermissions,
} from "../lib/permissions.ts";
import {
  authenticateFastifyClinicUser,
  type FastifyAuthenticatedClinicUser,
  type FastifyClinicSessionRecord,
} from "../lib/fastify-clinic-auth.ts";
import { logRequestCompletion } from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";

type ClinicUserRecord = {
  id: number;
  clinicId: number;
  username: string;
  authProId?: string | null;
  role: unknown;
};

type AuthenticatedClinicUser = FastifyAuthenticatedClinicUser & {
  permissions: ReturnType<typeof getClinicPermissions>;
  canManageClinicUsers: boolean;
};

type AuditWriteInput = {
  event: string;
  clinicId?: number | null;
  reportId?: number | null;
  metadata?: Record<string, unknown>;
  actor?: {
    type: string;
    clinicUserId?: number | null;
  };
};

export type ReportsStatusNativeRoutesOptions = {
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<FastifyClinicSessionRecord | null>;
  getClinicUserById?: (
    clinicUserId: number,
  ) => Promise<ClinicUserRecord | null>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  getReportById?: (reportId: number) => Promise<Report | null>;
  getClinicScopedReportById?: (
    reportId: number,
    clinicId: number,
  ) => Promise<Report | null | undefined>;
  updateReportStatus?: (input: {
    reportId: number;
    toStatus: ReportStatus;
    note: string | null;
    changedByClinicUserId?: number | null;
    changedByAdminUserId?: number | null;
  }) => Promise<Report | null | undefined>;
  createSignedReportUrl?: (storagePath: string) => Promise<string>;
  createSignedReportDownloadUrl?: (
    storagePath: string,
    fileName?: string,
  ) => Promise<string>;
  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;
  now?: () => number;
};

const REQUEST_TIMER_KEY = "__reportsStatusRequestTimer";

type ReportsStatusFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
};

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

function createAuditRequestLike(
  request: FastifyRequest,
  auth: AuthenticatedClinicUser,
) {
  return {
    method: request.method,
    originalUrl: request.url,
    ip: request.ip,
    headers: request.headers,
    auth: {
      id: auth.id,
      clinicId: auth.clinicId,
      username: auth.username,
      role: auth.role,
      canManageClinicUsers: auth.canManageClinicUsers,
    },
  };
}

function getReportsStatusAuthorization(
  auth: FastifyAuthenticatedClinicUser,
): AuthenticatedClinicUser {
  const permissions = getClinicPermissions(auth.role);

  return {
    ...auth,
    permissions,
    canManageClinicUsers: permissions.canManageClinicUsers,
  };
}

function requireReportStatusWritePermission(
  auth: AuthenticatedClinicUser,
  reply: FastifyReply,
) {
  if (auth.canManageClinicUsers) {
    return true;
  }

  reply.code(403).send({
    success: false,
    error: "No autorizado para cambiar el estado de informes",
  });

  return false;
}

export const reportsStatusNativeRoutes: FastifyPluginAsync<
  ReportsStatusNativeRoutesOptions
> = async (app, options) => {
  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(getAllowedOrigins());

  app.addHook("onRequest", async (request, reply) => {
    (request as ReportsStatusFastifyRequest)[REQUEST_TIMER_KEY] =
      createRuntimeTimer();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const timer =
      (request as ReportsStatusFastifyRequest)[REQUEST_TIMER_KEY] ??
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
    reply.header("access-control-allow-methods", "PATCH,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/:reportId/status", optionsHandler);

  app.patch<{
    Params: {
      reportId?: unknown;
    };
    Body: {
      status?: unknown;
      note?: unknown;
    };
  }>("/:reportId/status", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const composition =
      await createClinicReportStatusRouteComposition(options);
    const clinicAuth = await authenticateFastifyClinicUser(
      request,
      reply,
      composition.auth,
      now,
    );

    if (!clinicAuth) {
      return reply;
    }

    const auth = getReportsStatusAuthorization(clinicAuth);

    if (!requireReportStatusWritePermission(auth, reply)) {
      return reply;
    }

    const reportId = parseReportId(request.params.reportId);
    const nextStatus = parseReportStatus(request.body?.status);
    const note = normalizeOptionalNote(request.body?.note);

    if (typeof reportId !== "number") {
      return reply.code(400).send({
        success: false,
        error: "ID de informe invalido",
      });
    }

    if (!nextStatus) {
      return reply.code(400).send({
        success: false,
        error: "Estado de informe invalido",
        allowedStatuses: REPORT_STATUSES,
      });
    }

    const result = await composition.queries.transitionClinicReportStatus({
      clinicId: auth.clinicId,
      reportId,
      toStatus: nextStatus,
      note,
      changedByClinicUserId: auth.id,
      changedByAdminUserId: null,
    });

    if (result.type === "not_found" || result.type === "concurrent_not_found") {
      return reply.code(404).send({
        success: false,
        error: "Informe no encontrado",
      });
    }

    if (result.type === "same_status") {
      return reply.code(400).send({
        success: false,
        error: "El informe ya se encuentra en ese estado",
      });
    }

    if (result.type === "transition_not_allowed") {
      return reply.code(400).send({
        success: false,
        error: "La transición de estado no está permitida",
        currentStatus: result.currentStatus,
        requestedStatus: result.requestedStatus,
        allowedStatuses: REPORT_STATUSES,
      });
    }

    await composition.writeAuditLog(createAuditRequestLike(request, auth), {
      event: AUDIT_EVENTS.REPORT_STATUS_CHANGED,
      clinicId: result.report.clinicId,
      reportId: result.report.id,
      metadata: {
        fromStatus: result.previousStatus,
        toStatus: nextStatus,
        note,
      },
    });

    return reply.code(200).send({
      success: true,
      message: "Estado de informe actualizado correctamente",
      report: result.report,
    });
  });
};
