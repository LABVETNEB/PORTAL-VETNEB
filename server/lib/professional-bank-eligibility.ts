import { isReportStudyType, type ReportStudyType } from "./report-study-types.ts";

export const PROFESSIONAL_BANK_ELIGIBILITY_MONTHS = 3;
export const HISTOPATHOLOGY_REPORT_STUDY_TYPE =
  "histopatologia" satisfies ReportStudyType;

export type ProfessionalBankReportDeliveryCandidate = {
  studyType?: string | null;
  deliveredAt?: Date | string | number | null;
  deliveredByAdmin?: boolean | null;
};

export function isHistopathologyReport(input: {
  studyType?: string | null;
}): boolean {
  return (
    isReportStudyType(input.studyType) &&
    input.studyType === HISTOPATHOLOGY_REPORT_STUDY_TYPE
  );
}

function normalizeDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) {
    return null;
  }

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDaysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function addMonths(date: Date, months: number): Date {
  const resultMonth = date.getUTCMonth() + months;
  const resultYear = date.getUTCFullYear() + Math.floor(resultMonth / 12);
  const normalizedMonth = ((resultMonth % 12) + 12) % 12;
  const day = Math.min(
    date.getUTCDate(),
    getDaysInUtcMonth(resultYear, normalizedMonth),
  );

  return new Date(
    Date.UTC(
      resultYear,
      normalizedMonth,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

export function getProfessionalBankEligibilityWindow(now: Date) {
  return {
    now,
    deliveredFrom: addMonths(now, -PROFESSIONAL_BANK_ELIGIBILITY_MONTHS),
  };
}

export function getEligibleUntil(lastDeliveredAt: Date): Date {
  return addMonths(lastDeliveredAt, PROFESSIONAL_BANK_ELIGIBILITY_MONTHS);
}

export function isProfessionalBankEligible(
  lastDeliveredAt: Date | string | number | null | undefined,
  now: Date,
): boolean {
  const deliveredAt = normalizeDate(lastDeliveredAt);

  if (!deliveredAt) {
    return false;
  }

  const { deliveredFrom } = getProfessionalBankEligibilityWindow(now);
  return deliveredAt.getTime() >= deliveredFrom.getTime();
}

export function getLastHistopathologyReportDeliveredAt(
  reports: readonly ProfessionalBankReportDeliveryCandidate[],
): Date | null {
  let latest: Date | null = null;

  for (const report of reports) {
    if (!report.deliveredByAdmin || !isHistopathologyReport(report)) {
      continue;
    }

    const deliveredAt = normalizeDate(report.deliveredAt);

    if (!deliveredAt) {
      continue;
    }

    if (!latest || deliveredAt.getTime() > latest.getTime()) {
      latest = deliveredAt;
    }
  }

  return latest;
}

export function getProfessionalBankEligibility(
  reports: readonly ProfessionalBankReportDeliveryCandidate[],
  now: Date,
) {
  const lastHistopathologyReportDeliveredAt =
    getLastHistopathologyReportDeliveredAt(reports);
  const eligible = isProfessionalBankEligible(
    lastHistopathologyReportDeliveredAt,
    now,
  );

  return {
    eligible,
    lastHistopathologyReportDeliveredAt,
    eligibleUntil: lastHistopathologyReportDeliveredAt
      ? getEligibleUntil(lastHistopathologyReportDeliveredAt)
      : null,
  };
}
