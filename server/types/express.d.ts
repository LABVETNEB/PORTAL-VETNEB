import "express";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: {
        id: number;
        clinicId: number;
        username: string;
        authProId: string | null;
        canUploadReports: boolean;
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
