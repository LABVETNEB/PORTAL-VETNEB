export {
  buildAuditCsv,
  buildClinicAuditListFilters,
} from "./audit-log.ts";

export type {
  AuditListFilterBuildResult,
  AuditListFilters,
  AuditLogListItem,
} from "./audit-log.ts";

export function buildClinicAuditCsvFilename(now = new Date()): string {
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  return `clinic-audit-log-${timestamp}.csv`;
}
