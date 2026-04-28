import type { NextFunction, Request, Response } from "../lib/http-types.ts";
export function requireClinicManagementPermission(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.auth?.canManageClinicUsers) {
    return res.status(403).json({
      success: false,
      error: "No autorizado para administrar recursos de la clinica",
    });
  }
  next();
}

