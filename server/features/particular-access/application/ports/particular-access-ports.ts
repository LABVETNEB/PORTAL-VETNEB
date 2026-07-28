import type { TokenStudyTrackingOperationsDeps } from "../../../study-tracking/index.ts";

export type ParticularAccessTokenRecord = {
  id: number;
  clinicId: number;
  reportId: number | null;
  tokenLast4: string;
  tutorLastName: string;
  petName: string;
  petAge: string;
  petBreed: string;
  petSex: string;
  petSpecies: string;
  sampleLocation: string;
  sampleEvolution: string;
  detailsLesion: string | null;
  extractionDate: Date;
  shippingDate: Date;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdByAdminId: number | null;
  createdByClinicUserId: number | null;
};

export type ParticularAccessReportRecord = {
  clinicId: number;
};

export type CreateParticularAccessTokenInput = {
  clinicId: number;
  reportId: number | null;
  createdByAdminId: number | null;
  createdByClinicUserId: number | null;
  tokenHash: string;
  tokenLast4: string;
  tutorLastName: string;
  petName: string;
  petAge: string;
  petBreed: string;
  petSex: string;
  petSpecies: string;
  sampleLocation: string;
  sampleEvolution: string;
  detailsLesion: string | null;
  extractionDate: Date;
  shippingDate: Date;
  isActive: boolean;
  lastLoginAt: Date | null;
};

export type CreateParticularAccessTokenData = Omit<
  CreateParticularAccessTokenInput,
  | "clinicId"
  | "createdByAdminId"
  | "createdByClinicUserId"
  | "tokenHash"
  | "tokenLast4"
  | "isActive"
  | "lastLoginAt"
> & {
  recipientEmail: string;
};

export type ParticularTokenEmailResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: "no_recipients" | "smtp_disabled" };

export type ParticularAccessIssue =
  | {
      kind: "tracking";
      tokenId: number;
      clinicId: number;
      error: unknown;
    }
  | {
      kind: "notification";
      tokenId: number;
      trackingCaseId: number;
      error: unknown;
    };

export type EmailFailureResult =
  | {
      kind: "email_unavailable";
      tokenId: number;
      reason: "no_recipients" | "smtp_disabled";
      cleanupError?: unknown;
    }
  | {
      kind: "email_failed";
      tokenId: number;
      error: unknown;
      cleanupError?: unknown;
    };

export type ParticularTokenRepository<
  TToken extends ParticularAccessTokenRecord,
> = {
  createParticularToken: (
    input: CreateParticularAccessTokenInput,
  ) => Promise<TToken>;
  getParticularTokenById: (
    tokenId: number,
  ) => Promise<TToken | null | undefined>;
  getClinicScopedParticularToken: (
    tokenId: number,
    clinicId: number,
  ) => Promise<TToken | null | undefined>;
  listParticularTokens: (params: {
    clinicId?: number;
    limit: number;
    offset: number;
  }) => Promise<TToken[]>;
  updateParticularTokenReport: (
    tokenId: number,
    reportId: number | null,
  ) => Promise<TToken | null | undefined>;
  revokeParticularToken: (
    tokenId: number,
  ) => Promise<TToken | null | undefined>;
  deleteParticularToken: (
    tokenId: number,
  ) => Promise<{ id: number } | null>;
};

export type ParticularAccessSideEffectPorts = {
  generateSessionToken: () => string;
  hashSessionToken: (token: string) => string;
  sendParticularTokenEmail: (input: {
    to: string;
    token: string;
    tutorLastName: string;
    petName: string;
  }) => Promise<ParticularTokenEmailResult>;
  studyTracking: TokenStudyTrackingOperationsDeps;
  now: () => number;
};
