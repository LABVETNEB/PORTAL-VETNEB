import 'express';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;

      auth?: {
        userId?: string;
        clinicId?: string;
        role?: string;
      };

      admin?: {
        adminId?: string;
        role?: string;
      };
    }
  }
}

export {};
