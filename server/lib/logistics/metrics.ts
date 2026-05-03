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
export type SlaComplianceStatus =
  | "active"
  | "paused"
  | "breached"
  | "resolved"
  | "canceled"
  | "missing_due_date";

export interface SlaComplianceInput {
  now?: Date | null;
  dueAt?: Date | null;
  pausedAt?: Date | null;
  breachedAt?: Date | null;
  resolvedAt?: Date | null;
  canceledAt?: Date | null;
}

export interface SlaComplianceResult {
  status: SlaComplianceStatus;
  isBreached: boolean | null;
  overdueMin: number | null;
  remainingMin: number | null;
  resolvedLateMin: number | null;
}

export interface SlaComplianceSummary {
  totalCount: number;
  evaluatedCount: number;
  activeCount: number;
  pausedCount: number;
  breachedCount: number;
  resolvedCount: number;
  canceledCount: number;
  missingDueDateCount: number;
  breachRate: number | null;
  resolvedLateCount: number;
}

function calculateMinuteDelta(fromMs: number, toMs: number): number {
  return roundMetric((toMs - fromMs) / 60000);
}

export function classifySlaCompliance(
  input: SlaComplianceInput,
): SlaComplianceResult {
  const nowMs = getDateMs(input.now) ?? Date.now();
  const dueAtMs = getDateMs(input.dueAt);
  const pausedAtMs = getDateMs(input.pausedAt);
  const breachedAtMs = getDateMs(input.breachedAt);
  const resolvedAtMs = getDateMs(input.resolvedAt);
  const canceledAtMs = getDateMs(input.canceledAt);

  if (dueAtMs === null) {
    return {
      status: "missing_due_date",
      isBreached: null,
      overdueMin: null,
      remainingMin: null,
      resolvedLateMin: null,
    };
  }

  if (canceledAtMs !== null) {
    return {
      status: "canceled",
      isBreached: false,
      overdueMin: null,
      remainingMin: null,
      resolvedLateMin: null,
    };
  }

  if (resolvedAtMs !== null) {
    const resolvedLateMin = calculateMinuteDelta(dueAtMs, resolvedAtMs);
    const isBreached = resolvedLateMin > 0 || breachedAtMs !== null;

    return {
      status: isBreached ? "breached" : "resolved",
      isBreached,
      overdueMin: null,
      remainingMin: null,
      resolvedLateMin: isBreached ? Math.max(resolvedLateMin, 0) : 0,
    };
  }

  if (pausedAtMs !== null) {
    const overdueMin = calculateMinuteDelta(dueAtMs, pausedAtMs);
    const isBreached = overdueMin > 0 || breachedAtMs !== null;

    return {
      status: isBreached ? "breached" : "paused",
      isBreached,
      overdueMin: isBreached ? Math.max(overdueMin, 0) : null,
      remainingMin: isBreached
        ? null
        : Math.max(calculateMinuteDelta(pausedAtMs, dueAtMs), 0),
      resolvedLateMin: null,
    };
  }

  const overdueMin = calculateMinuteDelta(dueAtMs, nowMs);
  const isBreached = overdueMin > 0 || breachedAtMs !== null;

  if (isBreached) {
    return {
      status: "breached",
      isBreached: true,
      overdueMin: Math.max(overdueMin, 0),
      remainingMin: null,
      resolvedLateMin: null,
    };
  }

  return {
    status: "active",
    isBreached: false,
    overdueMin: null,
    remainingMin: Math.max(calculateMinuteDelta(nowMs, dueAtMs), 0),
    resolvedLateMin: null,
  };
}

export function summarizeSlaCompliance(
  results: readonly SlaComplianceResult[],
): SlaComplianceSummary {
  let activeCount = 0;
  let pausedCount = 0;
  let breachedCount = 0;
  let resolvedCount = 0;
  let canceledCount = 0;
  let missingDueDateCount = 0;
  let resolvedLateCount = 0;

  for (const result of results) {
    if (result.status === "active") {
      activeCount += 1;
    } else if (result.status === "paused") {
      pausedCount += 1;
    } else if (result.status === "breached") {
      breachedCount += 1;
    } else if (result.status === "resolved") {
      resolvedCount += 1;
    } else if (result.status === "canceled") {
      canceledCount += 1;
    } else if (result.status === "missing_due_date") {
      missingDueDateCount += 1;
    }

    if ((result.resolvedLateMin ?? 0) > 0) {
      resolvedLateCount += 1;
    }
  }

  const evaluatedCount =
    activeCount + pausedCount + breachedCount + resolvedCount + canceledCount;

  return {
    totalCount: results.length,
    evaluatedCount,
    activeCount,
    pausedCount,
    breachedCount,
    resolvedCount,
    canceledCount,
    missingDueDateCount,
    breachRate:
      evaluatedCount > 0
        ? roundMetric((breachedCount / evaluatedCount) * 100)
        : null,
    resolvedLateCount,
  };
}

export interface RouteEventMetricInput {
  routePlanId?: number | null;
  routeStopId?: number | null;
  eventType: string;
  source?: string | null;
  eventTime: Date;
}

export interface RouteEventBoundary {
  eventType: string;
  eventTime: Date;
  routePlanId: number | null;
  routeStopId: number | null;
}

export interface RouteEventAggregationSummary {
  totalCount: number;
  byEventType: Record<string, number>;
  bySource: Record<string, number>;
  firstEvent: RouteEventBoundary | null;
  lastEvent: RouteEventBoundary | null;
}

export interface RouteEventDurationResult {
  durationMin: number | null;
  missingEvents: string[];
}

function isValidRouteEvent(event: RouteEventMetricInput): boolean {
  return (
    typeof event.eventType === "string" &&
    event.eventType.trim().length > 0 &&
    event.eventTime instanceof Date &&
    Number.isFinite(event.eventTime.getTime())
  );
}

function toRouteEventBoundary(
  event: RouteEventMetricInput,
): RouteEventBoundary {
  return {
    eventType: event.eventType,
    eventTime: event.eventTime,
    routePlanId:
      typeof event.routePlanId === "number" && Number.isInteger(event.routePlanId)
        ? event.routePlanId
        : null,
    routeStopId:
      typeof event.routeStopId === "number" && Number.isInteger(event.routeStopId)
        ? event.routeStopId
        : null,
  };
}

function sortRouteEvents(
  events: readonly RouteEventMetricInput[],
): RouteEventMetricInput[] {
  return events
    .filter(isValidRouteEvent)
    .slice()
    .sort((left, right) => left.eventTime.getTime() - right.eventTime.getTime());
}

export function summarizeRouteEvents(
  events: readonly RouteEventMetricInput[],
): RouteEventAggregationSummary {
  const sortedEvents = sortRouteEvents(events);
  const byEventType: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  for (const event of sortedEvents) {
    byEventType[event.eventType] = (byEventType[event.eventType] ?? 0) + 1;

    const source = event.source?.trim() || "unknown";
    bySource[source] = (bySource[source] ?? 0) + 1;
  }

  const first = sortedEvents[0] ?? null;
  const last = sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1] : null;

  return {
    totalCount: sortedEvents.length,
    byEventType,
    bySource,
    firstEvent: first ? toRouteEventBoundary(first) : null,
    lastEvent: last ? toRouteEventBoundary(last) : null,
  };
}

export function getRouteEventBoundariesByRoutePlan(
  events: readonly RouteEventMetricInput[],
): Record<number, { firstEvent: RouteEventBoundary; lastEvent: RouteEventBoundary }> {
  const grouped: Record<number, RouteEventMetricInput[]> = {};

  for (const event of sortRouteEvents(events)) {
    if (typeof event.routePlanId !== "number" || !Number.isInteger(event.routePlanId)) {
      continue;
    }

    grouped[event.routePlanId] = grouped[event.routePlanId] ?? [];
    grouped[event.routePlanId].push(event);
  }

  const result: Record<
    number,
    { firstEvent: RouteEventBoundary; lastEvent: RouteEventBoundary }
  > = {};

  for (const [routePlanId, routeEvents] of Object.entries(grouped)) {
    const first = routeEvents[0];
    const last = routeEvents.length > 0 ? routeEvents[routeEvents.length - 1] : undefined;

    if (first && last) {
      result[Number(routePlanId)] = {
        firstEvent: toRouteEventBoundary(first),
        lastEvent: toRouteEventBoundary(last),
      };
    }
  }

  return result;
}

export function getRouteEventBoundariesByRouteStop(
  events: readonly RouteEventMetricInput[],
): Record<number, { firstEvent: RouteEventBoundary; lastEvent: RouteEventBoundary }> {
  const grouped: Record<number, RouteEventMetricInput[]> = {};

  for (const event of sortRouteEvents(events)) {
    if (typeof event.routeStopId !== "number" || !Number.isInteger(event.routeStopId)) {
      continue;
    }

    grouped[event.routeStopId] = grouped[event.routeStopId] ?? [];
    grouped[event.routeStopId].push(event);
  }

  const result: Record<
    number,
    { firstEvent: RouteEventBoundary; lastEvent: RouteEventBoundary }
  > = {};

  for (const [routeStopId, routeEvents] of Object.entries(grouped)) {
    const first = routeEvents[0];
    const last = routeEvents.length > 0 ? routeEvents[routeEvents.length - 1] : undefined;

    if (first && last) {
      result[Number(routeStopId)] = {
        firstEvent: toRouteEventBoundary(first),
        lastEvent: toRouteEventBoundary(last),
      };
    }
  }

  return result;
}

export function calculateDurationBetweenRouteEvents(
  events: readonly RouteEventMetricInput[],
  startEventType: string,
  endEventType: string,
): RouteEventDurationResult {
  const sortedEvents = sortRouteEvents(events);
  const start = sortedEvents.find((event) => event.eventType === startEventType);
  const end = sortedEvents.find(
    (event) =>
      event.eventType === endEventType &&
      (!start || event.eventTime.getTime() >= start.eventTime.getTime()),
  );

  const missingEvents: string[] = [];

  if (!start) {
    missingEvents.push(startEventType);
  }

  if (!end) {
    missingEvents.push(endEventType);
  }

  if (!start || !end) {
    return { durationMin: null, missingEvents };
  }

  return {
    durationMin: calculateMinuteDelta(
      start.eventTime.getTime(),
      end.eventTime.getTime(),
    ),
    missingEvents,
  };
}
