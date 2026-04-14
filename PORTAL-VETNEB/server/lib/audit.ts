import { Request } from 'express';
import { logError, logInfo, logWarn, serializeError } from './logger.js';

type RequestWithContext = Request & {
  requestId?: string;
  auth?: {
    userId?: string | number;
    clinicId?: string | number;
    role?: string;
  };
  admin?: {
    adminId?: string | number;
    role?: string;
  };
};

function getReq(req: Request): RequestWithContext {
  return req as RequestWithContext;
}

export function auditInfo(req: Request, action: string, metadata: Record<string, unknown> = {}) {
  const r = getReq(req);

  logInfo('AUDIT_INFO', {
    action,
    requestId: r.requestId ?? null,
    auth: r.auth ?? null,
    admin: r.admin ?? null,
    metadata
  });
}

export function auditWarn(req: Request, action: string, metadata: Record<string, unknown> = {}) {
  const r = getReq(req);

  logWarn('AUDIT_WARN', {
    action,
    requestId: r.requestId ?? null,
    auth: r.auth ?? null,
    admin: r.admin ?? null,
    metadata
  });
}

export function auditError(
  req: Request,
  action: string,
  error: unknown,
  metadata: Record<string, unknown> = {}
) {
  const r = getReq(req);

  logError('AUDIT_ERROR', {
    action,
    requestId: r.requestId ?? null,
    auth: r.auth ?? null,
    admin: r.admin ?? null,
    metadata,
    error: serializeError(error)
  });
}
