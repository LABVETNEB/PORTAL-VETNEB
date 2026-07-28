import { z } from "zod";
import type {
  Report,
  ReportAccessToken,
} from "../../../drizzle/schema.ts";
import { serializeSafeReport } from "../reports/index.ts";
import {
  canAccessReportPublicly,
  getReportAccessTokenState,
  isReportAccessTokenExpired,
  isReportAccessTokenRevoked,
} from "./domain/index.ts";

export {
  canAccessReportPublicly,
  getReportAccessTokenState,
  isReportAccessTokenExpired,
  isReportAccessTokenRevoked,
};

const rawTokenPattern = /^[a-f0-9]{64}$/i;

function emptyStringToUndefined(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const optionalFutureDateSchema = z
  .preprocess(
    (value) => {
      if (value === null) {
        return null;
      }

      return emptyStringToUndefined(value);
    },
    z.union([z.coerce.date(), z.null(), z.undefined()]),
  )
  .refine(
    (value) => value == null || value.getTime() > Date.now(),
    "expiresAt debe ser una fecha futura",
  );

export const reportAccessTokenRawTokenSchema = z
  .string()
  .trim()
  .regex(rawTokenPattern, "Token de acceso inválido");

const reportIdSchema = z.coerce
  .number()
  .int()
  .positive("reportId es obligatorio");

export const clinicCreateReportAccessTokenSchema = z.object({
  reportId: reportIdSchema,
  expiresAt: optionalFutureDateSchema.optional(),
});

export const adminCreateReportAccessTokenSchema =
  clinicCreateReportAccessTokenSchema.extend({
    clinicId: z.coerce.number().int().positive("clinicId es obligatorio"),
  });

export function parsePositiveInt(
  value: unknown,
  fallback: number,
  max?: number,
): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  if (typeof max === "number") {
    return Math.min(parsed, max);
  }

  return parsed;
}

export function parseOffset(value: unknown, fallback = 0): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export function parseEntityId(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function buildValidationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

export function buildPublicReportAccessPath(rawToken: string): string {
  return `/api/public/report-access/${encodeURIComponent(rawToken)}`;
}

export function serializeReportAccessToken(token: ReportAccessToken) {
  return {
    id: token.id,
    clinicId: token.clinicId,
    reportId: token.reportId,
    tokenLast4: token.tokenLast4,
    accessCount: token.accessCount,
    lastAccessAt: token.lastAccessAt,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
    createdAt: token.createdAt,
    updatedAt: token.updatedAt,
    createdByClinicUserId: token.createdByClinicUserId,
    createdByAdminUserId: token.createdByAdminUserId,
    revokedByClinicUserId: token.revokedByClinicUserId,
    revokedByAdminUserId: token.revokedByAdminUserId,
    state: getReportAccessTokenState(token),
    isExpired: isReportAccessTokenExpired(token.expiresAt),
    isRevoked: isReportAccessTokenRevoked(token.revokedAt),
  };
}

export function serializeReportAccessTokenDetail(
  token: ReportAccessToken,
  report?: Report | null,
) {
  return {
    ...serializeReportAccessToken(token),
    report: report ? serializeSafeReport(report) : null,
  };
}

export function serializePublicReportAccess(input: {
  report: Report;
  previewUrl: string;
  downloadUrl: string;
}) {
  return {
    ...serializeSafeReport(input.report),
    previewUrl: input.previewUrl,
    downloadUrl: input.downloadUrl,
  };
}
