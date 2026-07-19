export type RoutePlanningObjective = "distance" | "time" | "sla";

export type RoutePlanningPoint = {
  lat: number;
  lng: number;
};

export type RoutePlanningTimeWindow = {
  windowStart: Date;
  windowEnd: Date;
  isHard?: boolean;
};

export type RoutePlanningVisit = {
  fieldVisitId: number;
  priority?: number | null;
  serviceDurationMin?: number | null;
  location?: RoutePlanningPoint | null;
  timeWindows?: readonly RoutePlanningTimeWindow[];
};

export type BuildHeuristicRoutePlanOptions = {
  routeStart: Date;
  startLocation?: RoutePlanningPoint | null;
  objective?: RoutePlanningObjective;
  travelSpeedKmh?: number;
  fallbackLegMinutes?: number;
};

export type PlannedRouteStop = {
  fieldVisitId: number;
  sequence: number;
  etaStart: Date;
  etaEnd: Date;
  plannedKmFromPrev: number;
  plannedMinFromPrev: number;
};

export type HeuristicRoutePlanResult = {
  planningMode: "heuristic";
  objective: RoutePlanningObjective;
  stops: PlannedRouteStop[];
  totalPlannedKm: number;
  totalPlannedMin: number;
  warnings: string[];
};

type NormalizedVisit = {
  fieldVisitId: number;
  priority: number;
  serviceDurationMin: number;
  location: RoutePlanningPoint | null;
  timeWindows: RoutePlanningTimeWindow[];
  inputIndex: number;
};

type CandidateScore = {
  visit: NormalizedVisit;
  legKm: number | null;
  travelMinutes: number;
  waitMinutes: number;
  plannedMinutesFromPrev: number;
  etaStart: Date;
  etaEnd: Date;
  hardWindowEndMs: number;
  hasHardWindowPressure: boolean;
};

const EARTH_RADIUS_KM = 6371;
const DEFAULT_TRAVEL_SPEED_KMH = 35;
const DEFAULT_FALLBACK_LEG_MINUTES = 15;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizePositiveInteger(value: number | null | undefined): number {
  if (!Number.isInteger(value) || value == null || value < 0) {
    return 0;
  }

  return value;
}

function normalizePositiveNumber(
  value: number | null | undefined,
  defaultValue: number,
): number {
  if (!isFiniteNumber(value) || value <= 0) {
    return defaultValue;
  }

  return value;
}

function normalizePoint(point: RoutePlanningPoint | null | undefined): RoutePlanningPoint | null {
  if (!point) {
    return null;
  }

  if (!isFiniteNumber(point.lat) || !isFiniteNumber(point.lng)) {
    return null;
  }

  if (point.lat < -90 || point.lat > 90 || point.lng < -180 || point.lng > 180) {
    return null;
  }

  return {
    lat: point.lat,
    lng: point.lng,
  };
}

function normalizeDate(value: Date): Date | null {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    return null;
  }

  return new Date(value.getTime());
}

function normalizeTimeWindows(
  timeWindows: readonly RoutePlanningTimeWindow[] | undefined,
): RoutePlanningTimeWindow[] {
  if (!timeWindows) {
    return [];
  }

  const normalizedTimeWindows: RoutePlanningTimeWindow[] = [];

  for (const timeWindow of timeWindows) {
    const windowStart = normalizeDate(timeWindow.windowStart);
    const windowEnd = normalizeDate(timeWindow.windowEnd);

    if (!windowStart || !windowEnd || windowStart.getTime() >= windowEnd.getTime()) {
      continue;
    }

    normalizedTimeWindows.push({
      windowStart,
      windowEnd,
      isHard: timeWindow.isHard ?? true,
    });
  }

  return normalizedTimeWindows.sort((left, right) => {
    const startDiff = left.windowStart.getTime() - right.windowStart.getTime();

    if (startDiff !== 0) {
      return startDiff;
    }

    return left.windowEnd.getTime() - right.windowEnd.getTime();
  });
}

function normalizeVisits(visits: readonly RoutePlanningVisit[]): NormalizedVisit[] {
  return visits
    .map((visit, inputIndex) => {
      if (!Number.isInteger(visit.fieldVisitId) || visit.fieldVisitId <= 0) {
        return null;
      }

      return {
        fieldVisitId: visit.fieldVisitId,
        priority: normalizePositiveInteger(visit.priority),
        serviceDurationMin: normalizePositiveInteger(visit.serviceDurationMin),
        location: normalizePoint(visit.location),
        timeWindows: normalizeTimeWindows(visit.timeWindows),
        inputIndex,
      };
    })
    .filter((visit): visit is NormalizedVisit => visit !== null);
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function calculateHaversineKm(
  from: RoutePlanningPoint,
  to: RoutePlanningPoint,
): number {
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

function roundPlannedKm(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function diffMinutes(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 60000));
}

function getBestHardWindowForArrival(
  visit: NormalizedVisit,
  arrival: Date,
): RoutePlanningTimeWindow | null {
  const hardWindows = visit.timeWindows.filter(
    (timeWindow) => timeWindow.isHard !== false,
  );

  if (hardWindows.length === 0) {
    return null;
  }

  const arrivalMs = arrival.getTime();

  const viableWindow = hardWindows.find(
    (timeWindow) => timeWindow.windowEnd.getTime() >= arrivalMs,
  );

  return viableWindow ?? hardWindows[hardWindows.length - 1] ?? null;
}

function buildCandidateScore(input: {
  visit: NormalizedVisit;
  cursor: Date;
  currentLocation: RoutePlanningPoint | null;
  travelSpeedKmh: number;
  fallbackLegMinutes: number;
}): CandidateScore {
  const legKm =
    input.currentLocation && input.visit.location
      ? calculateHaversineKm(input.currentLocation, input.visit.location)
      : null;

  const travelMinutes =
    legKm === null
      ? input.fallbackLegMinutes
      : Math.max(1, Math.ceil((legKm / input.travelSpeedKmh) * 60));

  const arrival = addMinutes(input.cursor, travelMinutes);
  const hardWindow = getBestHardWindowForArrival(input.visit, arrival);

  const etaStart =
    hardWindow && arrival.getTime() < hardWindow.windowStart.getTime()
      ? new Date(hardWindow.windowStart.getTime())
      : arrival;

  const waitMinutes = diffMinutes(arrival, etaStart);
  const etaEnd = addMinutes(etaStart, input.visit.serviceDurationMin);

  return {
    visit: input.visit,
    legKm,
    travelMinutes,
    waitMinutes,
    plannedMinutesFromPrev: travelMinutes + waitMinutes,
    etaStart,
    etaEnd,
    hardWindowEndMs: hardWindow?.windowEnd.getTime() ?? Number.POSITIVE_INFINITY,
    hasHardWindowPressure: Boolean(hardWindow),
  };
}

function compareNumbers(left: number, right: number): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function compareCandidateTieBreakers(
  left: CandidateScore,
  right: CandidateScore,
): number {
  const priorityDiff = compareNumbers(right.visit.priority, left.visit.priority);

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const idDiff = compareNumbers(left.visit.fieldVisitId, right.visit.fieldVisitId);

  if (idDiff !== 0) {
    return idDiff;
  }

  return compareNumbers(left.visit.inputIndex, right.visit.inputIndex);
}

function compareDistanceObjectiveCandidates(
  left: CandidateScore,
  right: CandidateScore,
): number {
  const leftHasKnownLeg = left.legKm !== null;
  const rightHasKnownLeg = right.legKm !== null;

  if (leftHasKnownLeg !== rightHasKnownLeg) {
    return leftHasKnownLeg ? -1 : 1;
  }

  const distanceDiff = compareNumbers(
    left.legKm ?? Number.POSITIVE_INFINITY,
    right.legKm ?? Number.POSITIVE_INFINITY,
  );

  if (distanceDiff !== 0) {
    return distanceDiff;
  }

  const minutesDiff = compareNumbers(
    left.plannedMinutesFromPrev,
    right.plannedMinutesFromPrev,
  );

  if (minutesDiff !== 0) {
    return minutesDiff;
  }

  return compareCandidateTieBreakers(left, right);
}

function compareTimeObjectiveCandidates(
  left: CandidateScore,
  right: CandidateScore,
): number {
  const minutesDiff = compareNumbers(
    left.plannedMinutesFromPrev,
    right.plannedMinutesFromPrev,
  );

  if (minutesDiff !== 0) {
    return minutesDiff;
  }

  const distanceDiff = compareNumbers(
    left.legKm ?? Number.POSITIVE_INFINITY,
    right.legKm ?? Number.POSITIVE_INFINITY,
  );

  if (distanceDiff !== 0) {
    return distanceDiff;
  }

  return compareCandidateTieBreakers(left, right);
}

function compareSlaObjectiveCandidates(
  left: CandidateScore,
  right: CandidateScore,
): number {
  if (left.hasHardWindowPressure !== right.hasHardWindowPressure) {
    return left.hasHardWindowPressure ? -1 : 1;
  }

  const hardWindowDiff = compareNumbers(left.hardWindowEndMs, right.hardWindowEndMs);

  if (hardWindowDiff !== 0) {
    return hardWindowDiff;
  }

  const priorityDiff = compareNumbers(right.visit.priority, left.visit.priority);

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const minutesDiff = compareNumbers(
    left.plannedMinutesFromPrev,
    right.plannedMinutesFromPrev,
  );

  if (minutesDiff !== 0) {
    return minutesDiff;
  }

  return compareCandidateTieBreakers(left, right);
}

function compareCandidatesByObjective(
  objective: RoutePlanningObjective,
  left: CandidateScore,
  right: CandidateScore,
): number {
  if (objective === "sla") {
    return compareSlaObjectiveCandidates(left, right);
  }

  if (objective === "time") {
    return compareTimeObjectiveCandidates(left, right);
  }

  return compareDistanceObjectiveCandidates(left, right);
}

function buildWarnings(visits: readonly NormalizedVisit[]): string[] {
  const warnings: string[] = [];

  const missingLocationIds = visits
    .filter((visit) => visit.location === null)
    .map((visit) => visit.fieldVisitId);

  if (missingLocationIds.length > 0) {
    warnings.push(
      `Visits without valid coordinates were planned with fallback leg minutes: ${missingLocationIds.join(", ")}`,
    );
  }

  return warnings;
}

export function buildHeuristicRoutePlan(
  visits: readonly RoutePlanningVisit[],
  options: BuildHeuristicRoutePlanOptions,
): HeuristicRoutePlanResult {
  const routeStart = normalizeDate(options.routeStart);

  if (!routeStart) {
    throw new Error("routeStart must be a valid Date");
  }

  const objective = options.objective ?? "distance";
  const travelSpeedKmh = normalizePositiveNumber(
    options.travelSpeedKmh,
    DEFAULT_TRAVEL_SPEED_KMH,
  );
  const fallbackLegMinutes = Math.ceil(
    normalizePositiveNumber(
      options.fallbackLegMinutes,
      DEFAULT_FALLBACK_LEG_MINUTES,
    ),
  );

  const pending = normalizeVisits(visits);
  const warnings = buildWarnings(pending);
  const stops: PlannedRouteStop[] = [];

  let cursor = routeStart;
  let currentLocation = normalizePoint(options.startLocation);
  let totalPlannedKm = 0;
  let totalPlannedMin = 0;

  while (pending.length > 0) {
    const candidates = pending.map((visit) =>
      buildCandidateScore({
        visit,
        cursor,
        currentLocation,
        travelSpeedKmh,
        fallbackLegMinutes,
      }),
    );

    candidates.sort((left, right) =>
      compareCandidatesByObjective(objective, left, right),
    );

    const selected = candidates[0];

    if (!selected) {
      break;
    }

    const selectedIndex = pending.findIndex(
      (visit) => visit.fieldVisitId === selected.visit.fieldVisitId,
    );

    if (selectedIndex >= 0) {
      pending.splice(selectedIndex, 1);
    }

    const plannedKmFromPrev = selected.legKm === null
      ? 0
      : roundPlannedKm(selected.legKm);

    stops.push({
      fieldVisitId: selected.visit.fieldVisitId,
      sequence: stops.length + 1,
      etaStart: selected.etaStart,
      etaEnd: selected.etaEnd,
      plannedKmFromPrev,
      plannedMinFromPrev: selected.plannedMinutesFromPrev,
    });

    totalPlannedKm += plannedKmFromPrev;
    totalPlannedMin += selected.plannedMinutesFromPrev + selected.visit.serviceDurationMin;
    cursor = selected.etaEnd;

    if (selected.visit.location) {
      currentLocation = selected.visit.location;
    }
  }

  return {
    planningMode: "heuristic",
    objective,
    stops,
    totalPlannedKm: roundPlannedKm(totalPlannedKm),
    totalPlannedMin,
    warnings,
  };
}
