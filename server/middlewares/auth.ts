import type { NextFunction, Request, Response } from "express";

import {
  deleteActiveSession,
  getActiveSessionByToken,
  getClinicUserById,
  updateSessionLastAccess,
} from "../db";
import { ENV } from "../lib/env";
import { asyncHandler } from "../utils/async-handler";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        sessionToken: string;
        clinicUserId: number;
        clinicId: number;
        username: string;
      };
    }
  }
}

function getBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
    return undefined;
  }

  return token.trim();
}

function getSessionToken(req: Request): string | undefined {
  if (typeof req.cookies?.[ENV.cookieName] === "string") {
    return req.cookies[ENV.cookieName];
  }

  return getBearerToken(req.headers.authorization);
}

export const requireAuth = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = getSessionToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Sesión no encontrada",
      });
    }

    const session = await getActiveSessionByToken(token);

    if (!session) {
      return res.status(401).json({
        success: false,
        error: "Sesión inválida",
      });
    }

    if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
      await deleteActiveSession(token);

      res.clearCookie(ENV.cookieName, {
        httpOnly: true,
        path: "/",
        sameSite: ENV.isProduction ? "none" : "lax",
        secure: ENV.isProduction,
      });

      return res.status(401).json({
        success: false,
        error: "Sesión expirada",
      });
    }

    const clinicUser = await getClinicUserById(session.clinicUserId);

    if (!clinicUser) {
      await deleteActiveSession(token);

      return res.status(401).json({
        success: false,
        error: "Usuario de sesión no encontrado",
      });
    }

    await updateSessionLastAccess(token);

    req.auth = {
      sessionToken: token,
      clinicUserId: clinicUser.id,
      clinicId: clinicUser.clinicId,
      username: clinicUser.username,
    };

    next();
  },
);
