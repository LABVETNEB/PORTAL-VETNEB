import type { NextFunction, Request, Response } from "../lib/http-types.ts";

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

type AdminSessionRecord = {
  adminUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type AdminUserRecord = {
  id: number;
  username: string;
};

type AdminAuthDeps = {
  deleteAdminSession: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken: (tokenHash: string) => Promise<AdminSessionRecord | null>;
  getAdminUserById: (id: number) => Promise<AdminUserRecord | null>;
  updateAdminSessionLastAccess: (tokenHash: string) => Promise<void>;
  hashSessionToken: (token: string) => string;
  cookieName: string;
  cookieSameSite: "lax" | "strict" | "none";
  cookieSecure: boolean;
  now: () => number;
};

function getAdminSessionToken(
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

let defaultDepsPromise: Promise<AdminAuthDeps> | null = null;

async function loadDefaultDeps(): Promise<AdminAuthDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const envModule = await import("../lib/env.ts");

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        cookieName: envModule.ENV.adminCookieName,
        cookieSameSite: envModule.ENV.cookieSameSite,
        cookieSecure: envModule.ENV.cookieSecure,
        now: () => Date.now(),
      };
    })();
  }

  return defaultDepsPromise;
}

export function createRequireAdminAuth(
  injectedDeps?: AdminAuthDeps,
) {
  return async function requireAdminAuth(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const deps = injectedDeps ?? (await loadDefaultDeps());
      const token = getAdminSessionToken(req, deps.cookieName);

      if (!token) {
        return res.status(401).json({
          success: false,
          error: "Admin no autenticado",
        });
      }

      const tokenHash = deps.hashSessionToken(token);
      const session = await deps.getAdminSessionByToken(tokenHash);

      if (!session) {
        return res.status(401).json({
          success: false,
          error: "Sesión admin inválida",
        });
      }

      if (session.expiresAt && session.expiresAt.getTime() <= deps.now()) {
        await deps.deleteAdminSession(tokenHash);

        res.clearCookie(deps.cookieName, {
          httpOnly: true,
          path: "/",
          sameSite: deps.cookieSameSite,
          secure: deps.cookieSecure,
        });

        return res.status(401).json({
          success: false,
          error: "Sesión admin expirada",
        });
      }

      const adminUser = await deps.getAdminUserById(session.adminUserId);

      if (!adminUser) {
        await deps.deleteAdminSession(tokenHash);

        res.clearCookie(deps.cookieName, {
          httpOnly: true,
          path: "/",
          sameSite: deps.cookieSameSite,
          secure: deps.cookieSecure,
        });

        return res.status(401).json({
          success: false,
          error: "Usuario admin de sesión no encontrado",
        });
      }

      if (
        shouldRefreshSessionLastAccess(
          session.lastAccess ?? null,
          deps.now(),
        )
      ) {
        await deps.updateAdminSessionLastAccess(tokenHash);
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
  };
}

export const requireAdminAuth = createRequireAdminAuth();

