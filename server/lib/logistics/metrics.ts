export type NumericMetricInput = number | null | undefined;

export type TimeWindowComplianceStatus =
  | "early"
  | "on_time"
  | "late"
  | "no_window"
  | "missing_actual";

export interface RouteDistanceComplianceInput {
  plannedKm?: NumericMetricInput;
  actualKm?: NumericMetricInput;
  tolerancePercent?: NumericMetricInput;
}

export interface RouteDistanceComplianceMetrics {
  plannedKm: number | null;
  actualKm: number | null;
  deltaKm: number | null;
  absoluteDeltaKm: number | null;
  deltaPercent: number | null;
  efficiencyRatio: number | null;
  withinTolerance: boolean | null;
}

export interface TimeWindowComplianceInput {
  windowStart?: Date | null;
  windowEnd?: Date | null;
  actualArrival?: Date | null;
  toleranceMin?: NumericMetricInput;
}

export interface TimeWindowComplianceResult {
  status: TimeWindowComplianceStatus;
  toleranceMin: number;
  deltaFromWindowMin: number | null;
  earlyByMin: number | null;
  lateByMin: number | null;
}

export interface WindowComplianceSummary {
  totalCount: number;
  evaluatedCount: number;
  earlyCount: number;
  onTimeCount: number;
  lateCount: number;
  noWindowCount: number;
  missingActualCount: number;
  complianceRate: number | null;
}

export interface BasicRouteComplianceInput {
  plannedKm?: NumericMetricInput;
  actualKm?: NumericMetricInput;
  totalStops?: NumericMetricInput;
  completedStops?: NumericMetricInput;
  distanceTolerancePercent?: NumericMetricInput;
  windowStatuses?: readonly TimeWindowComplianceStatus[];
}

export interface BasicRouteComplianceMetrics {
  distance: RouteDistanceComplianceMetrics;
  totalStops: number | null;
  completedStops: number | null;
  completionRate: number | null;
  kmPerCompletedVisit: number | null;
  windows: WindowComplianceSummary;
}

const METRIC_DECIMALS = 6;

function roundMetric(value: number): number {
  const rounded = Number(value.toFixed(METRIC_DECIMALS));

  if (Object.is(rounded, -0)) {
    return 0;
  }

  return rounded;
}

function normalizeNonNegativeNumber(value: NumericMetricInput): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

function normalizeNonNegativeInteger(value: NumericMetricInput): number | null {
  const normalized = normalizeNonNegativeNumber(value);

  if (normalized === null || !Number.isInteger(normalized)) {
    return null;
  }

  return normalized;
}

function getDateMs(date: Date | null | undefined): number | null {
  if (!(date instanceof Date)) {
    return null;
  }

  const time = date.getTime();

  if (!Number.isFinite(time)) {
    return null;
  }

  return time;
}

export function calculateRouteDistanceCompliance(
  input: RouteDistanceComplianceInput,
): RouteDistanceComplianceMetrics {
  const plannedKm = normalizeNonNegativeNumber(input.plannedKm);
  const actualKm = normalizeNonNegativeNumber(input.actualKm);
  const tolerancePercent = normalizeNonNegativeNumber(input.tolerancePercent);

  const hasBothDistances = plannedKm !== null && actualKm !== null;
  const deltaKm = hasBothDistances ? roundMetric(actualKm - plannedKm) : null;
  const absoluteDeltaKm = deltaKm === null ? null : roundMetric(Math.abs(deltaKm));
  const deltaPercent =
    hasBothDistances && plannedKm > 0
      ? roundMetric(((actualKm - plannedKm) / plannedKm) * 100)
      : null;
  const efficiencyRatio =
    hasBothDistances && plannedKm > 0 ? roundMetric(actualKm / plannedKm) : null;

  let withinTolerance: boolean | null = null;

  if (hasBothDistances && tolerancePercent !== null) {
    if (plannedKm === 0) {
      withinTolerance = actualKm === 0;
    } else if (deltaPercent !== null) {
      withinTolerance = Math.abs(deltaPercent) <= tolerancePercent;
    }
  }

  return {
    plannedKm,
    actualKm,
    deltaKm,
    absoluteDeltaKm,
    deltaPercent,
    efficiencyRatio,
    withinTolerance,
  };
}

export function calculateKmPerCompletedVisit(
  actualKm: NumericMetricInput,
  completedVisits: NumericMetricInput,
): number | null {
  const normalizedActualKm = normalizeNonNegativeNumber(actualKm);
  const normalizedCompletedVisits = normalizeNonNegativeInteger(completedVisits);

  if (
    normalizedActualKm === null ||
    normalizedCompletedVisits === null ||
    normalizedCompletedVisits === 0
  ) {
    return null;
  }

  return roundMetric(normalizedActualKm / normalizedCompletedVisits);
}

export function classifyTimeWindowCompliance(
  input: TimeWindowComplianceInput,
): TimeWindowComplianceResult {
  const windowStartMs = getDateMs(input.windowStart);
  const windowEndMs = getDateMs(input.windowEnd);
  const actualArrivalMs = getDateMs(input.actualArrival);
  const toleranceMin = normalizeNonNegativeNumber(input.toleranceMin) ?? 0;

  if (
    windowStartMs === null ||
    windowEndMs === null ||
    windowStartMs >= windowEndMs
  ) {
    return {
      status: "no_window",
      toleranceMin,
      deltaFromWindowMin: null,
      earlyByMin: null,
      lateByMin: null,
    };
  }

  if (actualArrivalMs === null) {
    return {
      status: "missing_actual",
      toleranceMin,
      deltaFromWindowMin: null,
      earlyByMin: null,
      lateByMin: null,
    };
  }

  const earlyByMin = roundMetric((windowStartMs - actualArrivalMs) / 60000);
  const lateByMin = roundMetric((actualArrivalMs - windowEndMs) / 60000);

  if (earlyByMin > toleranceMin) {
    return {
      status: "early",
      toleranceMin,
      deltaFromWindowMin: -earlyByMin,
      earlyByMin,
      lateByMin: null,
    };
  }

  if (lateByMin > toleranceMin) {
    return {
      status: "late",
      toleranceMin,
      deltaFromWindowMin: lateByMin,
      earlyByMin: null,
      lateByMin,
    };
  }

  return {
    status: "on_time",
    toleranceMin,
    deltaFromWindowMin: 0,
    earlyByMin: null,
    lateByMin: null,
  };
}

export function summarizeWindowCompliance(
  statuses: readonly TimeWindowComplianceStatus[],
): WindowComplianceSummary {
  let earlyCount = 0;
  let onTimeCount = 0;
  let lateCount = 0;
  let noWindowCount = 0;
  let missingActualCount = 0;

  for (const status of statuses) {
    if (status === "early") {
      earlyCount += 1;
    } else if (status === "on_time") {
      onTimeCount += 1;
    } else if (status === "late") {
      lateCount += 1;
    } else if (status === "no_window") {
      noWindowCount += 1;
    } else if (status === "missing_actual") {
      missingActualCount += 1;
    }
  }

  const evaluatedCount = earlyCount + onTimeCount + lateCount;

  return {
    totalCount: statuses.length,
    evaluatedCount,
    earlyCount,
    onTimeCount,
    lateCount,
    noWindowCount,
    missingActualCount,
    complianceRate:
      evaluatedCount > 0 ? roundMetric((onTimeCount / evaluatedCount) * 100) : null,
  };
}

export function calculateBasicRouteComplianceMetrics(
  input: BasicRouteComplianceInput,
): BasicRouteComplianceMetrics {
  const totalStops = normalizeNonNegativeInteger(input.totalStops);
  const completedStops = normalizeNonNegativeInteger(input.completedStops);
  const completionRate =
    totalStops !== null && totalStops > 0 && completedStops !== null
      ? roundMetric((completedStops / totalStops) * 100)
      : null;

  return {
    distance: calculateRouteDistanceCompliance({
      plannedKm: input.plannedKm,
      actualKm: input.actualKm,
      tolerancePercent: input.distanceTolerancePercent,
    }),
    totalStops,
    completedStops,
    completionRate,
    kmPerCompletedVisit: calculateKmPerCompletedVisit(
      input.actualKm,
      completedStops,
    ),
    windows: summarizeWindowCompliance(input.windowStatuses ?? []),
  };
}
