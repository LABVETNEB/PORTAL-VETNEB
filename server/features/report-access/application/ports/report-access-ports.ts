export type ReportAccessTokenRecord = {
  id: number;
  clinicId: number;
  reportId: number;
  tokenLast4: string;
  accessCount: number;
  lastAccessAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdByClinicUserId: number | null;
  createdByAdminUserId: number | null;
  revokedByClinicUserId: number | null;
  revokedByAdminUserId: number | null;
};

export type ReportAccessReportRecord = {
  id: number;
  clinicId: number;
  currentStatus: string;
  storagePath: string;
  fileName: string | null;
};

export type CreateReportAccessTokenInput = {
  clinicId: number;
  reportId: number;
  tokenHash: string;
  tokenLast4: string;
  expiresAt: Date | null;
  createdByClinicUserId: number | null;
  createdByAdminUserId: number | null;
  revokedByClinicUserId: number | null;
  revokedByAdminUserId: number | null;
};

export type ReportAccessAuditInput = {
  event: string;
  clinicId?: number | null;
  reportId?: number | null;
  targetReportAccessTokenId?: number | null;
  actor?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type ReportAccessRepository<TToken extends ReportAccessTokenRecord> = {
  createReportAccessToken: (
    input: CreateReportAccessTokenInput,
  ) => Promise<TToken>;
  getReportAccessTokenById: (
    tokenId: number,
  ) => Promise<TToken | null | undefined>;
  getClinicScopedReportAccessToken: (
    tokenId: number,
    clinicId: number,
  ) => Promise<TToken | null | undefined>;
  listReportAccessTokens: (params: {
    clinicId?: number;
    reportId?: number;
    limit: number;
    offset: number;
  }) => Promise<TToken[]>;
  revokeReportAccessToken: (input: {
    id: number;
    revokedByClinicUserId?: number | null;
    revokedByAdminUserId?: number | null;
  }) => Promise<TToken | null | undefined>;
  recordReportAccessTokenAccess: (
    tokenId: number,
  ) => Promise<TToken | null | undefined>;
};
