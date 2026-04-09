import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

import { logInfo } from "../lib/logger";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      requestStartAt?: number;
    }
  }
}

export function requestContext(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.requestId = crypto.randomUUID();
  req.requestStartAt = Date.now();

  res.setHeader("x-request-id", req.requestId);

  res.on("finish", () => {
    const durationMs =
      typeof req.requestStartAt === "number"
        ? Date.now() - req.requestStartAt
        : null;

    logInfo("http_request", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      clinicUserId: req.auth?.id ?? null,
      clinicId: req.auth?.clinicId ?? null,
      username: req.auth?.username ?? null,
      role: req.auth?.role ?? null,
      adminUserId: req.admin?.adminUser.id ?? null,
      adminEmail: req.admin?.adminUser.email ?? null,
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
    });
  });

  next();
}
