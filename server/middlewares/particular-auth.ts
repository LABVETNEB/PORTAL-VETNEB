import type { NextFunction, Request, Response } from "express";

const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

type ParticularSessionRecord = {
  particularTokenId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type ParticularTokenRecord = {
  id: number;
  clinicId: number;
  reportId: number | null;
  isActive: boolean;
};

type ParticularAuthDeps = {
  deleteParticularSession: (tokenHash: string) => Promise<void>;
  getParticularSessionByToken: (
    tokenHash: string,
  ) => Promise<ParticularSessionRecord | null>;
  getParticularTokenById: (
    id: number,
  ) => Promise<ParticularTokenRecord | null>;
  updateParticularSessionLastAccess: (tokenHash: string) => Promise<void>;
  hashSessionToken: (token: string) => string;
  cookieName: string;
  cookieSameSite: "lax" | "strict" | "none";
  cookieSecure: boolean;
  now: () => number;
};

function getParticularSessionToken(
  req: Request,
  cookieName: string,
): string | undefined {
  const raw = req.cookies?.[cookieName];

  if (typeof raw !== "string") {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function shouldRefreshSessionLastAccess(
  lastAccess: Date | null | undefined,
  nowMs: number,
) {
  if (!(lastAccess instanceof Date)) {
    return true;
  }

  return nowMs - lastAccess.getTime() >= SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS;
}

let defaultDepsPromise: Promise<ParticularAuthDeps> | null = null;

async function loadDefaultDeps(): Promise<ParticularAuthDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db-particular.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const envModule = await import("../lib/env.ts");

      return {
        deleteParticularSession: db.deleteParticularSession,
        getParticularSessionByToken: db.getParticularSessionByToken,
        getParticularTokenById: db.getParticularTokenById,
        updateParticularSessionLastAccess: db.updateParticularSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        cookieName: envModule.ENV.particularCookieName,
        cookieSameSite: envModule.ENV.cookieSameSite,
        cookieSecure: envModule.ENV.cookieSecure,
        now: () => Date.now(),
      };
    })();
  }

  return defaultDepsPromise;
}

export function createRequireParticularAuth(
  injectedDeps?: ParticularAuthDeps,
) {
  return async function requireParticularAuth(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const deps = injectedDeps ?? (await loadDefaultDeps());
      const token = getParticularSessionToken(req, deps.cookieName);

      if (!token) {
        return res.status(401).json({
          success: false,
          error: "Particular no autenticado",
        });
      }

      const tokenHash = deps.hashSessionToken(token);
      const session = await deps.getParticularSessionByToken(tokenHash);

      if (!session) {
        return res.status(401).json({
          success: false,
          error: "Sesión particular inválida",
        });
      }

      if (session.expiresAt && session.expiresAt.getTime() <= deps.now()) {
        await deps.deleteParticularSession(tokenHash);

        res.clearCookie(deps.cookieName, {
          httpOnly: true,
          path: "/",
          sameSite: deps.cookieSameSite,
          secure: deps.cookieSecure,
        });

        return res.status(401).json({
          success: false,
          error: "Sesión particular expirada",
        });
      }

      const particularToken = await deps.getParticularTokenById(
        session.particularTokenId,
      );

      if (!particularToken || !particularToken.isActive) {
        await deps.deleteParticularSession(tokenHash);

        res.clearCookie(deps.cookieName, {
          httpOnly: true,
          path: "/",
          sameSite: deps.cookieSameSite,
          secure: deps.cookieSecure,
        });

        return res.status(401).json({
          success: false,
          error: "Token particular inválido o inactivo",
        });
      }

      if (
        shouldRefreshSessionLastAccess(
          session.lastAccess ?? null,
          deps.now(),
        )
      ) {
        await deps.updateParticularSessionLastAccess(tokenHash);
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
  };
}

export const requireParticularAuth = createRequireParticularAuth();
