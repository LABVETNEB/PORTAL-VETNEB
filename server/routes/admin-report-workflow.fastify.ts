import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  REPORT_WORKFLOW_STAGES,
  type ReportWorkflowStage,
} from "../../drizzle/schema.ts";
import type { AdminReportWorkflowItem } from "../db-report-workflow.ts";
import { AUDIT_EVENTS, type AuditWriteInput } from "../lib/audit.ts";
import { ENV } from "../lib/env.ts";
import { authenticateFastifyAdmin } from "../lib/fastify-admin-auth.ts";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
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

type WorkflowQuery = {
  limit?: unknown;
  offset?: unknown;
};

type WorkflowParams = {
  id?: unknown;
};

export type AdminReportWorkflowNativeRoutesOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken?: (
    tokenHash: string,
  ) => Promise<AdminSessionRecord | null>;
  getAdminUserById?: (
    adminUserId: number,
  ) => Promise<AuthenticatedAdminUser | null>;
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
    | "getAdminSessionByToken"
    | "getAdminUserById"
    | "updateAdminSessionLastAccess"
    | "hashSessionToken"
    | "listAdminReportWorkflowItems"
    | "getAdminReportWorkflowItem"
    | "updateAdminReportWorkflowStage"
    | "updateAdminReportSpecialStain"
    | "writeAuditLog"
  >
>;

let defaultDepsPromise: Promise<NativeAdminReportWorkflowDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeAdminReportWorkflowDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const workflow = await import("../db-report-workflow.ts");
      const audit = await import("../lib/audit.ts");

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        listAdminReportWorkflowItems: workflow.listAdminReportWorkflowItems,
        getAdminReportWorkflowItem: workflow.getAdminReportWorkflowItem,
        updateAdminReportWorkflowStage: workflow.updateAdminReportWorkflowStage,
        updateAdminReportSpecialStain: workflow.updateAdminReportSpecialStain,
        writeAuditLog: audit.writeAuditLog as (
          req: unknown,
          input: AuditWriteInput,
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

function getRequestOrigin(request: FastifyRequest): string | null {
  const origin =
    typeof request.headers.origin === "string"
      ? request.headers.origin.trim()
      : "";

  if (origin) {
    return normalizeOrigin(origin);
  }

  const referer =
    typeof request.headers.referer === "string"
      ? request.headers.referer.trim()
      : "";

  return referer ? normalizeOrigin(referer) : null;
}

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

function enforceTrustedOrigin(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: ReadonlySet<string>,
) {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) {
    return true;
  }

  const requestOrigin = getRequestOrigin(request);

  if (!requestOrigin || allowedOrigins.has(requestOrigin)) {
    return true;
  }

  reply.code(403).send({
    success: false,
    error: "Origen no permitido",
  });

  return false;
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

  async function resolveDeps(): Promise<NativeAdminReportWorkflowDeps> {
    const hasAllInjectedDeps =
      !!options.deleteAdminSession &&
      !!options.getAdminSessionByToken &&
      !!options.getAdminUserById &&
      !!options.updateAdminSessionLastAccess &&
      !!options.hashSessionToken &&
      !!options.listAdminReportWorkflowItems &&
      !!options.getAdminReportWorkflowItem &&
      !!options.updateAdminReportWorkflowStage &&
      !!options.updateAdminReportSpecialStain &&
      !!options.writeAuditLog;
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
      listAdminReportWorkflowItems:
        options.listAdminReportWorkflowItems ??
        defaultDeps!.listAdminReportWorkflowItems,
      getAdminReportWorkflowItem:
        options.getAdminReportWorkflowItem ??
        defaultDeps!.getAdminReportWorkflowItem,
      updateAdminReportWorkflowStage:
        options.updateAdminReportWorkflowStage ??
        defaultDeps!.updateAdminReportWorkflowStage,
      updateAdminReportSpecialStain:
        options.updateAdminReportSpecialStain ??
        defaultDeps!.updateAdminReportSpecialStain,
      writeAuditLog: options.writeAuditLog ?? defaultDeps!.writeAuditLog,
    };
  }

  async function authenticateAdminUser(
    request: FastifyRequest,
    reply: FastifyReply,
    deps: NativeAdminReportWorkflowDeps,
  ) {
    return authenticateFastifyAdmin(request, reply, {
      deleteAdminSession: deps.deleteAdminSession,
      getAdminSessionByToken: deps.getAdminSessionByToken,
      getAdminUserById: deps.getAdminUserById,
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
    const deps = await resolveDeps();
    const admin = await authenticateAdminUser(request, reply, deps);

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

    const listed = await deps.listAdminReportWorkflowItems({
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

      const deps = await resolveDeps();
      const admin = await authenticateAdminUser(request, reply, deps);

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

      const current = await deps.getAdminReportWorkflowItem(reportId);

      if (!current) {
        return reply.code(404).send({
          success: false,
          error: "Informe no encontrado",
        });
      }

      const updated = await deps.updateAdminReportWorkflowStage(
        reportId,
        request.body.stage,
        new Date(now()),
      );

      if (!updated) {
        return reply.code(404).send({
          success: false,
          error: "Informe no encontrado",
        });
      }

      await deps.writeAuditLog(createAuditRequestLike(request, admin), {
        event: AUDIT_EVENTS.REPORT_WORKFLOW_STAGE_CHANGED,
        clinicId: updated.clinicId,
        reportId: updated.id,
        metadata: {
          previousStage: current.workflowStage,
          nextStage: updated.workflowStage,
          workflowUpdatedAt: updated.workflowUpdatedAt,
        },
      });

      return reply.code(200).send({
        success: true,
        report: updated,
      });
    },
  );

  app.patch<{ Params: WorkflowParams; Body: unknown }>(
    "/:id/special-stain",
    async (request, reply) => {
      if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
        return reply;
      }

      const deps = await resolveDeps();
      const admin = await authenticateAdminUser(request, reply, deps);

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

      const current = await deps.getAdminReportWorkflowItem(reportId);

      if (!current) {
        return reply.code(404).send({
          success: false,
          error: "Informe no encontrado",
        });
      }

      const updated = await deps.updateAdminReportSpecialStain(
        reportId,
        request.body.requested,
        new Date(now()),
      );

      if (!updated) {
        return reply.code(404).send({
          success: false,
          error: "Informe no encontrado",
        });
      }

      await deps.writeAuditLog(createAuditRequestLike(request, admin), {
        event: AUDIT_EVENTS.REPORT_SPECIAL_STAIN_CHANGED,
        clinicId: updated.clinicId,
        reportId: updated.id,
        metadata: {
          previousRequested: current.specialStainRequested,
          requested: updated.specialStainRequested,
          specialStainAt: updated.specialStainAt,
        },
      });

      return reply.code(200).send({
        success: true,
        report: updated,
      });
    },
  );
};
