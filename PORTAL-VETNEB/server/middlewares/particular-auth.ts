import type { NextFunction, Request, Response } from "express";
import {
  deleteParticularSession,
  getParticularSessionByToken,
  getParticularTokenById,
  updateParticularSessionLastAccess,
} from "../db-particular";
import { hashSessionToken } from "../lib/auth-security";
import { ENV } from "../lib/env";

const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

function getParticularSessionToken(req: Request): string | undefined {
  const raw = req.cookies?.[ENV.particularCookieName];

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

export async function requireParticularAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = getParticularSessionToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Particular no autenticado",
      });
    }

    const tokenHash = hashSessionToken(token);
    const session = await getParticularSessionByToken(tokenHash);

    if (!session) {
      return res.status(401).json({
        success: false,
        error: "Sesión particular inválida",
      });
    }

    if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
      await deleteParticularSession(tokenHash);

      res.clearCookie(ENV.particularCookieName, {
        httpOnly: true,
        path: "/",
        sameSite: ENV.cookieSameSite,
        secure: ENV.cookieSecure,
      });

      return res.status(401).json({
        success: false,
        error: "Sesión particular expirada",
      });
    }

    const particularToken = await getParticularTokenById(session.particularTokenId);

    if (!particularToken || !particularToken.isActive) {
      await deleteParticularSession(tokenHash);

      res.clearCookie(ENV.particularCookieName, {
        httpOnly: true,
        path: "/",
        sameSite: ENV.cookieSameSite,
        secure: ENV.cookieSecure,
      });

      return res.status(401).json({
        success: false,
        error: "Token particular inválido o inactivo",
      });
    }

    if (shouldRefreshSessionLastAccess(session.lastAccess ?? null)) {
      await updateParticularSessionLastAccess(tokenHash);
    }

    req.particularAuth = {
      tokenId: particularToken.id,
      clinicId: particularToken.clinicId,
      reportId: particularToken.reportId ?? null,
      sessionToken: token,
    };

    next();
  } catch (error) {
    next(error);
  }
}
