import { Request } from "express";

import { logError, logInfo, logWarn, serializeError } from "./logger";

type AuditPayload = Record<string, unknown>;

function basePayload(req: Request): AuditPayload {
  return {
    requestId: req.requestId ?? null,
    clinicUserId: req.auth?.id ?? null,
    clinicId: req.auth?.clinicId ?? null,
    username: req.auth?.username ?? null,
    role: req.auth?.role ?? null,
    adminUserId: req.admin?.adminUser.id ?? null,
    adminEmail: req.admin?.adminUser.email ?? null,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("user-agent") ?? null,
  };
}

export function auditInfo(
  req: Request,
  action: string,
  payload?: AuditPayload,
) {
  logInfo(`audit:${action}`, {
    ...basePayload(req),
    ...(payload ?? {}),
  });
}

export function auditWarn(
  req: Request,
  action: string,
  payload?: AuditPayload,
) {
  logWarn(`audit:${action}`, {
    ...basePayload(req),
    ...(payload ?? {}),
  });
}

export function auditError(
  req: Request,
  action: string,
  error: unknown,
  payload?: AuditPayload,
) {
  logError(`audit:${action}`, {
    ...basePayload(req),
    ...(payload ?? {}),
    error: serializeError(error),
  });
}
