import type {
  ReportAccessReportRecord,
  ReportAccessTokenRecord,
} from "../../server/features/report-access/application/index.ts";
import { reportAccessNow } from "../fixtures/report-access.ts";

export const now = reportAccessNow;

export function token(
  overrides: Partial<ReportAccessTokenRecord> = {},
): ReportAccessTokenRecord {
  return {
    id: 31,
    clinicId: 7,
    reportId: 41,
    tokenLast4: "cdef",
    accessCount: 0,
    lastAccessAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
    createdByClinicUserId: null,
    createdByAdminUserId: 5,
    revokedByClinicUserId: null,
    revokedByAdminUserId: null,
    ...overrides,
  };
}

export function report(
  overrides: Partial<ReportAccessReportRecord> = {},
): ReportAccessReportRecord {
  return {
    id: 41,
    clinicId: 7,
    currentStatus: "ready",
    storagePath: "reports/fixture.pdf",
    fileName: "fixture.pdf",
    ...overrides,
  };
}
