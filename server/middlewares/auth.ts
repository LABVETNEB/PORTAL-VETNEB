import type { NextFunction, Request, Response } from "express";

import {
  deleteActiveSession,
  getActiveSessionByToken,
  getClinicUserById,
  updateSessionLastAccess,
} from "../db";
import { hashSessionToken } from "../lib/auth-security";
import { ENV } from "../lib/env";
import { getClinicPermissions, normalizeClinicUserRole } from "../lib/permissions";
import { asyncHandler } from "../utils/async-handler";

export type AuthenticatedUser = {
  id: number;
  clinicId: number;
  username: string;
  authProId: string | null;
  role: import("../../drizzle/schema").ClinicUserRole;
  permissions: import("../lib/permissions").ClinicPermissions;
  canUploadReports: boolean;
  canManageClinicUsers: boolean;
  sessionToken: string;
};

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
  },
);
