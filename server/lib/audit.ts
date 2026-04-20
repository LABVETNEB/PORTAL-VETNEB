import type { Request } from "express";
import type { AuditActorType, AuditEvent } from "../../drizzle/schema";
import { sanitizeUrlForLogs } from "../middlewares/request-logger.ts";
import { logError, logInfo, serializeError } from "./logger.ts";

export const AUDIT_EVENTS = {
  ADMIN_LOGIN_SUCCEEDED: "auth.admin.login.succeeded",
  CLINIC_LOGIN_SUCCEEDED: "auth.clinic.login.succeeded",
  REPORT_STATUS_CHANGED: "report.status.changed",
  REPORT_ACCESS_TOKEN_CREATED: "report_access_token.created",
  REPORT_ACCESS_TOKEN_REVOKED: "report_access_token.revoked",
  REPORT_PUBLIC_ACCESSED: "report.public_accessed",
} as const satisfies Record<string, AuditEvent>;

export type AuditActor = {
  type: AuditActorType;
  adminUserId?: number | null;
  clinicUserId?: number | null;
  reportAccessTokenId?: number | null;
};

export type AuditWriteInput = {
  event: AuditEvent;
  clinicId?: number | null;
  reportId?: number | null;
  targetAdminUserId?: number | null;
  targetClinicUserId?: number | null;
  targetReportAccessTokenId?: number | null;
  metadata?: Record<string, unknown>;
  actor?: AuditActor;
};

type RequestWithContext = Request & {
  requestId?: string;
  auth?: {
    id: number;
    clinicId: number;
    username: string;
    role?: string;
  };
  adminAuth?: {
    id: number;
    username: string;
  };
  particularAuth?: {
    tokenId: number;
    clinicId: number;
    reportId: number | null;
  };
};

function normalizeScalar(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeScalar(entry));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === "undefined") {
        continue;
      }

      result[key] = normalizeScalar(entry);
    }

    return result;
  }

  return String(value);
}

export function normalizeAuditMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  const normalized = normalizeScalar(metadata);

  if (!normalized || Array.isArray(normalized) || typeof normalized !== "object") {
    return null;
  }

  return normalized as Record<string, unknown>;
}

export function resolveAuditActorFromRequest(
  req: Pick<RequestWithContext, "auth" | "adminAuth">,
  override?: AuditActor,
): AuditActor {
  if (override) {
    return {
      type: override.type,
      adminUserId: override.adminUserId ?? null,
      clinicUserId: override.clinicUserId ?? null,
      reportAccessTokenId: override.reportAccessTokenId ?? null,
    };
  }

  if (req.adminAuth?.id) {
    return {
      type: "admin_user",
      adminUserId: req.adminAuth.id,
      clinicUserId: null,
      reportAccessTokenId: null,
    };
  }

  if (req.auth?.id) {
    return {
      type: "clinic_user",
      adminUserId: null,
      clinicUserId: req.auth.id,
      reportAccessTokenId: null,
    };
  }

  return {
    type: "system",
    adminUserId: null,
    clinicUserId: null,
    reportAccessTokenId: null,
  };
}

export function buildPublicReportAccessTokenActor(
  reportAccessTokenId: number,
): AuditActor {
  return {
    type: "public_report_access_token",
    adminUserId: null,
    clinicUserId: null,
    reportAccessTokenId,
  };
}

export function buildAuditLogInsert(
  req: Pick<
    RequestWithContext,
    "method" | "originalUrl" | "ip" | "headers" | "requestId" | "auth" | "adminAuth"
  >,
  input: AuditWriteInput,
) {
  const actor = resolveAuditActorFromRequest(req, input.actor);

  return {
    event: input.event,
    actorType: actor.type,
    actorAdminUserId: actor.adminUserId ?? null,
    actorClinicUserId: actor.clinicUserId ?? null,
    actorReportAccessTokenId: actor.reportAccessTokenId ?? null,
    clinicId: input.clinicId ?? req.auth?.clinicId ?? null,
    reportId: input.reportId ?? null,
    targetAdminUserId: input.targetAdminUserId ?? null,
    targetClinicUserId: input.targetClinicUserId ?? null,
    targetReportAccessTokenId: input.targetReportAccessTokenId ?? null,
    requestId: req.requestId ?? null,
    requestMethod: req.method ?? null,
    requestPath: req.originalUrl ? sanitizeUrlForLogs(req.originalUrl) : null,
    ipAddress: req.ip ?? null,
    userAgent:
      typeof req.headers?.["user-agent"] === "string"
        ? req.headers["user-agent"]
        : null,
    metadata: normalizeAuditMetadata(input.metadata),
  };
}

export async function writeAuditLog(
  req: Request,
  input: AuditWriteInput,
): Promise<void> {
  try {
    const payload = buildAuditLogInsert(req as RequestWithContext, input);
    const { createAuditLog } = await import("../db-audit.ts");

    await createAuditLog(payload);

    logInfo("AUDIT_LOG_WRITTEN", {
      event: payload.event,
      actorType: payload.actorType,
      clinicId: payload.clinicId,
      reportId: payload.reportId,
      targetReportAccessTokenId: payload.targetReportAccessTokenId,
    });
  } catch (error) {
    logError("AUDIT_LOG_WRITE_ERROR", {
      event: input.event,
      error: serializeError(error),
    });
  }
}
