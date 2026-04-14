import "express";

import type { ClinicUserRole } from "../../drizzle/schema";
import type { ClinicPermissions } from "../lib/permissions";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: {
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
      adminAuth?: {
        id: number;
        username: string;
        sessionToken: string;
      };
      particularAuth?: {
        tokenId: number;
        clinicId: number;
        reportId: number | null;
        sessionToken: string;
      };
    }
  }
}

export {};
