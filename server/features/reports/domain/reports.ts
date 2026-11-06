import type { Report, ReportStatus } from "../../../../drizzle/schema.ts";
import { normalizeReportStatus } from "./report-status.ts";

type ReportWithDisplayFields = Pick<
  Report,
  | "id"
  | "clinicId"
  | "patientName"
  | "studyType"
  | "currentStatus"
  | "uploadDate"
  | "fileName"
  | "storagePath"
  | "createdAt"
  | "updatedAt"
  | "statusChangedAt"
> & {
  clinicName?: string | null;
};

export function parsePositiveInt(value: unknown, fallback: number, max?: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  if (typeof max === "number") {
    return Math.min(parsed, max);
  }

  return parsed;
}

export function parseOffset(value: unknown, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export function normalizeSearchText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function normalizeOptionalNote(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 2000) : null;
}

export function parseOptionalDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parseClinicId(value: unknown): number | undefined {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return undefined;
}

export function parseReportStatus(value: unknown): ReportStatus | undefined {
  return normalizeReportStatus(value);
}

export function getReadClinicScope(reqClinicId: unknown, authClinicId: number) {
  const requestedClinicId = parseClinicId(reqClinicId);

  if (requestedClinicId && requestedClinicId !== authClinicId) {
    return {
      clinicId: authClinicId,
      isForbidden: true,
    };
  }

  return {
    clinicId: authClinicId,
    isForbidden: false,
  };
}

export function parseReportId(value: unknown): number | undefined {
  const reportId = Number(value);
  return Number.isInteger(reportId) && reportId > 0 ? reportId : undefined;
}

const STRICT_REPORT_ID_PATTERN = /^[1-9][0-9]{0,9}$/;
const MAX_REPORT_ID = 2_147_483_647;

/**
 * Path identifier of the by-id reads (GLOBAL-SEARCH-3A): canonical decimal
 * digits only, within the `integer` column range. `"1e3"`, `" 12 "`, `"012"`
 * or an out-of-range value is a malformed id (400), never a database error.
 */
export function parseStrictReportId(value: unknown): number | undefined {
  if (typeof value !== "string" || !STRICT_REPORT_ID_PATTERN.test(value)) {
    return undefined;
  }
  const reportId = Number(value);
  return reportId <= MAX_REPORT_ID ? reportId : undefined;
}

export function serializeSafeReport(report: ReportWithDisplayFields) {
  return {
    id: report.id,
    clinicId: report.clinicId,
    clinicName: report.clinicName,
    patientName: report.patientName,
    studyType: report.studyType,
    status: report.currentStatus,
    currentStatus: report.currentStatus,
    uploadDate: report.uploadDate,
    fileName: report.fileName,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    statusChangedAt: report.statusChangedAt,
    hasFile: Boolean(report.storagePath),
  };
}
