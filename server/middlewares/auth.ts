import type { NextFunction, Request, Response } from "express";

import {
  deleteActiveSession,
  getActiveSessionByToken,
  getClinicUserById,
  updateSessionLastAccess,
} from "../db";
import { hashSessionToken } from "../lib/auth-security";
import { ENV } from "../lib/env";
import { canUploadReports } from "../lib/permissions";
import { asyncHandler } from "../utils/async-handler";

type AuthenticatedUser = {
  id: number;
  clinicId: number;
  username: string;
  authProId: string | null;
  canUploadReports: boolean;
  sessionToken: string;
  role?: string | null;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
    }
  }
}

function getSessionToken(req: Request): string | undefined {
  const raw = req.cookies?.[ENV.cookieName];

  if (typeof raw !== "string") {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const requireAuth = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = getSessionToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "No autenticado",
      });
    }

    const tokenHash = hashSessionToken(token);
    const session = await getActiveSessionByToken(tokenHash);

    if (!session) {
      return res.status(401).json({
        success: false,
        error: "Sesión inválida",
      });
    }

    if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
      await deleteActiveSession(tokenHash);

      res.clearCookie(ENV.cookieName, {
        httpOnly: true,
        path: "/",
        sameSite: ENV.cookieSameSite,
        secure: ENV.cookieSecure,
      });

      return res.status(401).json({
        success: false,
        error: "Sesión expirada",
      });
    }

    const clinicUser = await getClinicUserById(session.clinicUserId);

    if (!clinicUser) {
      await deleteActiveSession(tokenHash);

      res.clearCookie(ENV.cookieName, {
        httpOnly: true,
        path: "/",
        sameSite: ENV.cookieSameSite,
        secure: ENV.cookieSecure,
      });

      return res.status(401).json({
        success: false,
        error: "Usuario de sesión no encontrado",
      });
    }

    await updateSessionLastAccess(tokenHash);

    req.auth = {
      id: clinicUser.id,
      clinicId: clinicUser.clinicId,
      username: clinicUser.username,
      authProId: clinicUser.authProId ?? null,
      canUploadReports: canUploadReports({`r`n        username: clinicUser.username,`r`n        authProId: clinicUser.authProId ?? null,`r`n        role: clinicUser.role ?? null,`r`n      }),
      role: clinicUser.role ?? null,
      sessionToken: token,
    };

    next();
  },
);

