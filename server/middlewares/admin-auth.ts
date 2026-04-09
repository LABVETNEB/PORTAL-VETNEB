import { type NextFunction, type Request, type Response } from "express";

import { getAdminUserByEmail } from "../db";
import {
  AdminJwtError,
  AdminJwtExpiredError,
  type AdminJwtPayload,
  verifyAdminJwt,
} from "../lib/admin-jwt";
import { ENV } from "../lib/env";
import { asyncHandler } from "../utils/async-handler";

export interface AdminAuthContext {
  adminUser: NonNullable<Awaited<ReturnType<typeof getAdminUserByEmail>>>;
  tokenPayload: AdminJwtPayload;
  token: string;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminAuthContext;
    }
  }
}

function readAdminToken(req: Request): string | null {
  const authHeader = req.header("authorization");

  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice("bearer ".length).trim();
    if (token) {
      return token;
    }
  }

  const headerToken = req.header("x-admin-token");
  if (headerToken && headerToken.trim()) {
    return headerToken.trim();
  }

  const cookieToken = req.cookies?.[ENV.adminCookieName];
  if (typeof cookieToken === "string" && cookieToken.trim()) {
    return cookieToken.trim();
  }

  return null;
}

function unauthorized(res: Response, error: string) {
  return res.status(401).json({
    success: false,
    error,
  });
}

export const requireAdminAuth = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = readAdminToken(req);

    if (!token) {
      return unauthorized(res, "Token de admin requerido");
    }

    let payload: AdminJwtPayload;

    try {
      payload = verifyAdminJwt(token);
    } catch (error) {
      if (error instanceof AdminJwtExpiredError) {
        return unauthorized(res, "Token de admin expirado");
      }

      if (error instanceof AdminJwtError) {
        return unauthorized(res, "Token de admin invalido");
      }

      throw error;
    }

    const adminUser = await getAdminUserByEmail(payload.email);

    if (!adminUser || !adminUser.isActive) {
      return res.status(403).json({
        success: false,
        error: "Admin no autorizado",
      });
    }

    if (String(adminUser.id) !== payload.sub) {
      return unauthorized(res, "Token de admin invalido");
    }

    req.admin = {
      adminUser,
      tokenPayload: payload,
      token,
    };

    return next();
  },
);
