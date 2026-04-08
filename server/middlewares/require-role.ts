import { Request, Response, NextFunction } from "express";

import { normalizeUserRole, type UserRole } from "../lib/permissions";

function hasRequiredRole(
  currentRole: UserRole | null | undefined,
  allowedRoles: readonly UserRole[],
): boolean {
  if (!currentRole) {
    return false;
  }

  return allowedRoles.includes(currentRole);
}

export function requireAnyRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = normalizeUserRole(req.auth?.role);

    if (!req.auth || !hasRequiredRole(role, allowedRoles)) {
      return res.status(403).json({
        success: false,
        error: "No autorizado",
      });
    }

    return next();
  };
}

export function requireRole(role: UserRole) {
  return requireAnyRole(role);
}
