import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  REPORT_WORKFLOW_STAGES,
  type ReportWorkflowStage,
} from "../../drizzle/schema.ts";
import type { AdminReportWorkflowItem } from "../features/reports/infrastructure/index.ts";
import { createAdminReportWorkflowRouteComposition } from "../features/reports/composition/index.ts";
import type { AuditWriteInput } from "../lib/audit.ts";
import { ENV } from "../lib/env.ts";
import {
  getAllowedOrigins,
  normalizeOrigin,
  getRequestOrigin,
  enforceTrustedOrigin,
} from "../lib/cors-headers.ts";
import { authenticateFastifyAdmin } from "../lib/fastify-admin-auth.ts";

const MAX_PAGE_SIZE = 20;
const WORKFLOW_STAGE_SET = new Set<string>(REPORT_WORKFLOW_STAGES);

type AdminSessionRecord = {
  adminUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type AuthenticatedAdminUser = {
  id: number;
  username: string;
};

type AdminSessionWithUserRecord = {
  session: AdminSessionRecord;
  adminUser: AuthenticatedAdminUser | null;
};

type WorkflowQuery = {
  limit?: unknown;
  offset?: unknown;
};

type WorkflowParams = {
  id?: unknown;
};

export type AdminReportWorkflowNativeRoutesOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionWithUser?: (
    tokenHash: string,
  ) => Promise<AdminSessionWithUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  listAdminReportWorkflowItems?: (input: {
    limit: number;
    offset: number;
  }) => Promise<AdminReportWorkflowItem[]>;
  getAdminReportWorkflowItem?: (
    id: number,
  ) => Promise<AdminReportWorkflowItem | null>;
  updateAdminReportWorkflowStage?: (
    id: number,
    stage: ReportWorkflowStage,
    now: Date,
  ) => Promise<AdminReportWorkflowItem | null>;
  updateAdminReportSpecialStain?: (
    id: number,
    requested: boolean,
    now: Date,
  ) => Promise<AdminReportWorkflowItem | null>;
  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;
  now?: () => number;
};

type NativeAdminReportWorkflowDeps = Required<
  Pick<
    AdminReportWorkflowNativeRoutesOptions,
    | "deleteAdminSession"
    | "getAdminSessionWithUser"
    | "updateAdminSessionLastAccess"
    | "hashSessionToken"
  >
>;

function applyCorsHeaders(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: ReadonlySet<string>,
) {
  const rawOrigin =
    typeof request.headers.origin === "string"
      ? request.headers.origin.trim()
      : "";
  const origin = rawOrigin ? normalizeOrigin(rawOrigin) : null;

  if (!origin || !allowedOrigins.has(origin)) {
    return;
  }

  reply.header("vary", "Origin");
  reply.header("access-control-allow-origin", rawOrigin);
  reply.header("access-control-allow-credentials", "true");
}

function parsePositiveInteger(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeInteger(value: unknown): number | null {
  if (value === undefined) {
    return 0;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseLimit(value: unknown): number | null {
  if (value === undefined) {
    return MAX_PAGE_SIZE;
  }

  const parsed = parsePositiveInteger(value);
  return parsed === null ? null : Math.min(parsed, MAX_PAGE_SIZE);
}

function hasOnlyProperty(body: unknown, property: string): body is Record<string, unknown> {
  return (
    !!body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    Object.keys(body).length === 1 &&
    Object.prototype.hasOwnProperty.call(body, property)
  );
}

function isReportWorkflowStage(value: unknown): value is ReportWorkflowStage {
  return typeof value === "string" && WORKFLOW_STAGE_SET.has(value);
}

function createAuditRequestLike(
  request: FastifyRequest,
  admin: AuthenticatedAdminUser,
) {
  return {
    method: request.method,
    originalUrl: request.url,
    ip: request.ip,
    headers: request.headers,
    requestId: request.id,
    adminAuth: admin,
  };
}

export const adminReportWorkflowNativeRoutes: FastifyPluginAsync<
  AdminReportWorkflowNativeRoutesOptions
> = async (app, options) => {
  const allowedOrigins = new Set(getAllowedOrigins());
  const now = options.now ?? (() => Date.now());

  async function authenticateAdminUser(
    request: FastifyRequest,
    reply: FastifyReply,
    deps: NativeAdminReportWorkflowDeps,
  ) {
    return authenticateFastifyAdmin(request, reply, {
      deleteAdminSession: deps.deleteAdminSession,
      getAdminSessionWithUser: deps.getAdminSessionWithUser,
      updateAdminSessionLastAccess: deps.updateAdminSessionLastAccess,
      hashSessionToken: deps.hashSessionToken,
      now,
    });
  }

  app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply, allowedOrigins);
  });

  const optionsHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const origin = getRequestOrigin(request);

    if (origin && !allowedOrigins.has(origin)) {
      return reply.code(403).send({
        success: false,
        error: "Origen no permitido",
      });
    }

    applyCorsHeaders(request, reply, allowedOrigins);
    reply.header("access-control-allow-methods", "GET,PATCH,OPTIONS");
    reply.header(
      "access-control-allow-headers",
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type",
    );
    return reply.code(204).send();
  };

  app.options("/", optionsHandler);
  app.options("/:id/stage", optionsHandler);
  app.options("/:id/special-stain", optionsHandler);

  app.get<{ Querystring: WorkflowQuery }>("/", async (request, reply) => {
    const composition =
      await createAdminReportWorkflowRouteComposition(options);
    const admin = await authenticateAdminUser(
      request,
      reply,
      composition.auth,
    );

    if (!admin) {
      return reply;
    }

    const limit = parseLimit(request.query.limit);
    const offset = parseNonNegativeInteger(request.query.offset);

    if (limit === null || offset === null) {
      return reply.code(400).send({
        success: false,
        error: "Paginación inválida",
      });
    }

    const listed = await composition.service.listAdminWorkflow({
      limit: limit + 1,
      offset,
    });
    const reports = listed.slice(0, limit);

    return reply.code(200).send({
      success: true,
      reports,
      pagination: {
        limit,
        offset,
        hasMore: listed.length > limit,
      },
    });
  });

  app.patch<{ Params: WorkflowParams; Body: unknown }>(
    "/:id/stage",
    async (request, reply) => {
      if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
        return reply;
      }

      const composition =
        await createAdminReportWorkflowRouteComposition(options);
      const admin = await authenticateAdminUser(
        request,
        reply,
        composition.auth,
      );

      if (!admin) {
        return reply;
      }

      const reportId = parsePositiveInteger(request.params.id);

      if (reportId === null) {
        return reply.code(400).send({
          success: false,
          error: "ID de informe inválido",
        });
      }

      if (
        !hasOnlyProperty(request.body, "stage") ||
        !isReportWorkflowStage(request.body.stage)
      ) {
        return reply.code(400).send({
          success: false,
          error: "Etapa de workflow inválida",
          allowedStages: REPORT_WORKFLOW_STAGES,
        });
      }

      const result = await composition.service.changeWorkflowStage({
        reportId,
        stage: request.body.stage,
        now: new Date(now()),
        auditContext: createAuditRequestLike(request, admin),
      });

      if (result.type === "not_found") {
        return reply.code(404).send({
          success: false,
          error: "Informe no encontrado",
        });
      }

      return reply.code(200).send({
        success: true,
        report: result.report,
      });
    },
  );

  app.patch<{ Params: WorkflowParams; Body: unknown }>(
    "/:id/special-stain",
    async (request, reply) => {
      if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
        return reply;
      }

      const composition =
        await createAdminReportWorkflowRouteComposition(options);
      const admin = await authenticateAdminUser(
        request,
        reply,
        composition.auth,
      );

      if (!admin) {
        return reply;
      }

      const reportId = parsePositiveInteger(request.params.id);

      if (reportId === null) {
        return reply.code(400).send({
          success: false,
          error: "ID de informe inválido",
        });
      }

      if (
        !hasOnlyProperty(request.body, "requested") ||
        typeof request.body.requested !== "boolean"
      ) {
        return reply.code(400).send({
          success: false,
          error: "Solicitud de tinción especial inválida",
        });
      }

      const result = await composition.service.changeSpecialStain({
        reportId,
        requested: request.body.requested,
        now: new Date(now()),
        auditContext: createAuditRequestLike(request, admin),
      });

      if (result.type === "not_found") {
        return reply.code(404).send({
          success: false,
          error: "Informe no encontrado",
        });
      }

      return reply.code(200).send({
        success: true,
        report: result.report,
      });
    },
  );
};
