import type { NextFunction, Request, Response } from "express";
import {
  deleteAdminSession,
  getAdminSessionByToken,
  getAdminUserById,
  updateAdminSessionLastAccess,
} from "../db";
import { hashSessionToken } from "../lib/auth-security";
import { ENV } from "../lib/env";

type AuthenticatedAdmin = {
  id: number;
  username: string;
  sessionToken: string;
};

declare global {
  namespace Express {
    interface Request {
      adminAuth?: AuthenticatedAdmin;
    }
  }
}

const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

function getAdminSessionToken(req: Request): string | undefined {
  const raw = req.cookies?.[ENV.adminCookieName];

  if (typeof raw !== "string") {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function shouldRefreshSessionLastAccess(lastAccess: Date | null | undefined) {
  if (!(lastAccess instanceof Date)) {
    return true;
  }

  return Date.now() - lastAccess.getTime() >= SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS;
}

export async function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = getAdminSessionToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Admin no autenticado",
      });
    }

    const tokenHash = hashSessionToken(token);
    const session = await getAdminSessionByToken(tokenHash);

    if (!session) {
      return res.status(401).json({
        success: false,
        error: "Sesión admin inválida",
      });
    }

    if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
      await deleteAdminSession(tokenHash);

      res.clearCookie(ENV.adminCookieName, {
        httpOnly: true,
        path: "/",
        sameSite: ENV.cookieSameSite,
        secure: ENV.cookieSecure,
      });

      return res.status(401).json({
        success: false,
        error: "Sesión admin expirada",
      });
    }

    const adminUser = await getAdminUserById(session.adminUserId);

    if (!adminUser) {
      await deleteAdminSession(tokenHash);

      res.clearCookie(ENV.adminCookieName, {
        httpOnly: true,
        path: "/",
        sameSite: ENV.cookieSameSite,
        secure: ENV.cookieSecure,
      });

      return res.status(401).json({
        success: false,
        error: "Usuario admin de sesión no encontrado",
      });
    }

    if (shouldRefreshSessionLastAccess(session.lastAccess ?? null)) {
      await updateAdminSessionLastAccess(tokenHash);
    }

    req.adminAuth = {
      id: adminUser.id,
      username: adminUser.username,
      sessionToken: token,
    };

    next();
  } catch (error) {
    next(error);
  }
}
