import { Request, Response, NextFunction } from "express";

import { getActiveSessionByToken, getClinicUserById } from "../db";
import { hashSessionToken } from "../lib/auth-security";
import {
  canManageUsers,
  canUploadReports,
  normalizeUserRole,
  USER_ROLES,
  type UserRole,
} from "../lib/permissions";
import { ENV } from "../lib/env";

export interface AuthContext {
  id: number;
  clinicId: number;
  username: string;
  role: UserRole;
  authProId: string | null;
  sessionToken: string;
  canUploadReports: boolean;
  canManageUsers: boolean;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.cookies?.[ENV.cookieName];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "No autenticado",
      });
    }

    const tokenHash = hashSessionToken(token);
    const session = await getActiveSessionByToken(tokenHash);

    if (!session || !session.expiresAt || session.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        error: "Sesion invalida o expirada",
      });
    }

    const clinicUser = await getClinicUserById(session.clinicUserId);

    if (!clinicUser) {
      return res.status(401).json({
        success: false,
        error: "Usuario no encontrado",
      });
    }

    const role = normalizeUserRole(clinicUser.role) ?? USER_ROLES.LAB;

    req.auth = {
      id: clinicUser.id,
      clinicId: clinicUser.clinicId,
      username: clinicUser.username,
      role,
      authProId: clinicUser.authProId ?? null,
      sessionToken: token,
      canUploadReports: canUploadReports({ role }),
      canManageUsers: canManageUsers({ role }),
    };

    return next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    return res.status(500).json({
      success: false,
      error: "Error interno de autenticacion",
    });
  }
};
