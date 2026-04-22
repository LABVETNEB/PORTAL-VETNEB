import type { NextFunction, Request, Response } from "express";
import type { ClinicUserRole } from "../../drizzle/schema";
import type { ClinicPermissions } from "../lib/permissions.ts";

import { getClinicPermissions, normalizeClinicUserRole } from "../lib/permissions.ts";

export type AuthenticatedUser = {
  id: number;
  clinicId: number;
  username: string;
  authProId: string | null;
  role: ClinicUserRole;
  permissions: ClinicPermissions;
  canUploadReports: boolean;
  canManageClinicUsers: boolean;
  sessionToken: string;
};

type ActiveSessionRecord = {
  clinicUserId: number;
  expiresAt: Date | null;
};

type ClinicUserRecord = {
  id: number;
  clinicId: number;
  username: string;
  authProId?: string | null;
  role: unknown;
};

type AuthDeps = {
  deleteActiveSession: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken: (tokenHash: string) => Promise<ActiveSessionRecord | null>;
  getClinicUserById: (id: number) => Promise<ClinicUserRecord | null>;
  updateSessionLastAccess: (tokenHash: string) => Promise<void>;
  hashSessionToken: (token: string) => string;
  cookieName: string;
  cookieSameSite: "lax" | "strict" | "none";
  cookieSecure: boolean;
  now: () => number;
};

function getSessionToken(
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

let defaultDepsPromise: Promise<AuthDeps> | null = null;

async function loadDefaultDeps(): Promise<AuthDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const envModule = await import("../lib/env.ts");

      return {
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        updateSessionLastAccess: db.updateSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        cookieName: envModule.ENV.cookieName,
        cookieSameSite: envModule.ENV.cookieSameSite,
        cookieSecure: envModule.ENV.cookieSecure,
        now: () => Date.now(),
      };
    })();
  }

  return defaultDepsPromise;
}

export function createRequireAuth(
  injectedDeps?: AuthDeps,
) {
  return async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const deps = injectedDeps ?? (await loadDefaultDeps());
      const token = getSessionToken(req, deps.cookieName);

      if (!token) {
        return res.status(401).json({
          success: false,
          error: "No autenticado",
        });
      }

      const tokenHash = deps.hashSessionToken(token);
      const session = await deps.getActiveSessionByToken(tokenHash);

      if (!session) {
        return res.status(401).json({
          success: false,
          error: "Sesión inválida",
        });
      }

      if (session.expiresAt && session.expiresAt.getTime() <= deps.now()) {
        await deps.deleteActiveSession(tokenHash);

        res.clearCookie(deps.cookieName, {
          httpOnly: true,
          path: "/",
          sameSite: deps.cookieSameSite,
          secure: deps.cookieSecure,
        });

        return res.status(401).json({
          success: false,
          error: "Sesión expirada",
        });
      }

      const clinicUser = await deps.getClinicUserById(session.clinicUserId);

      if (!clinicUser) {
        await deps.deleteActiveSession(tokenHash);

        res.clearCookie(deps.cookieName, {
          httpOnly: true,
          path: "/",
          sameSite: deps.cookieSameSite,
          secure: deps.cookieSecure,
        });

        return res.status(401).json({
          success: false,
          error: "Usuario de sesión no encontrado",
        });
      }

      await deps.updateSessionLastAccess(tokenHash);

      const role = normalizeClinicUserRole(clinicUser.role, "clinic_staff");
      const permissions = getClinicPermissions(role);

      req.auth = {
        id: clinicUser.id,
        clinicId: clinicUser.clinicId,
        username: clinicUser.username,
        authProId: clinicUser.authProId ?? null,
        role,
        permissions,
        canUploadReports: permissions.canUploadReports,
        canManageClinicUsers: permissions.canManageClinicUsers,
        sessionToken: token,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireAuth = createRequireAuth();

