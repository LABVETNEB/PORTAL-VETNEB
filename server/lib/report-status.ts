import type { ReportStatus } from "../../drizzle/schema";

export const REPORT_STATUSES: ReadonlyArray<ReportStatus> = [
  "uploaded",
  "processing",
  "ready",
  "delivered",
] as const;

export function isReportStatus(value: unknown): value is ReportStatus {
  return (
    value === "uploaded" ||
    value === "processing" ||
    value === "ready" ||
    value === "delivered"
  );
}

export function normalizeReportStatus(
  value: unknown,
  fallback?: ReportStatus,
): ReportStatus | undefined {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "uploaded") {
    return "uploaded";
  }

  if (normalized === "processing") {
    return "processing";
  }

  if (normalized === "ready") {
    return "ready";
  }

  if (normalized === "delivered") {
    return "delivered";
  }

  return fallback;
}

const allowedTransitions: Record<ReportStatus, ReadonlyArray<ReportStatus>> = {
  uploaded: ["processing", "ready", "delivered"],
  processing: ["ready", "delivered"],
  ready: ["delivered"],
  delivered: [],
};

export function canTransitionReportStatus(
  currentStatus: ReportStatus,
  nextStatus: ReportStatus,
): boolean {
  if (currentStatus === nextStatus) {
    return false;
  }

  return allowedTransitions[currentStatus].includes(nextStatus);
}
