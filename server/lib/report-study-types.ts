export const REPORT_STUDY_TYPES = [
  "citologia",
  "histopatologia",
  "hemoparasitos",
] as const;

export type ReportStudyType = (typeof REPORT_STUDY_TYPES)[number];

export const REPORT_STUDY_TYPE_LABELS: Record<ReportStudyType, string> = {
  citologia: "Citología",
  histopatologia: "Histopatología",
  hemoparasitos: "Hemoparásitos",
};

export function isReportStudyType(value: unknown): value is ReportStudyType {
  return typeof value === "string" && REPORT_STUDY_TYPES.includes(value as ReportStudyType);
}

export function getReportStudyTypes(): ReportStudyType[] {
  return [...REPORT_STUDY_TYPES];
}

export function serializeReportStudyType(value: unknown) {
  if (!isReportStudyType(value)) {
    return null;
  }

  return {
    value,
    label: REPORT_STUDY_TYPE_LABELS[value],
  };
}

export function parseReportStudyType(value: unknown): ReportStudyType | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throwInvalidReportStudyType();
  }

  const normalized = value.trim();

  if (normalized === "") {
    return null;
  }

  if (isReportStudyType(normalized)) {
    return normalized;
  }

  throwInvalidReportStudyType();
}

function throwInvalidReportStudyType(): never {
  const error = new Error("Tipo de estudio inválido") as Error & {
    statusCode: number;
    details: {
      allowedValues: readonly ReportStudyType[];
    };
  };

  error.statusCode = 400;
  error.details = {
    allowedValues: REPORT_STUDY_TYPES,
  };

  throw error;
}