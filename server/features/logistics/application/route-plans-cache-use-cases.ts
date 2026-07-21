import type { LogisticsRoutePlansCacheRepository } from "./ports/logistics-route-plans-cache-repository.ts";
import type { LogisticsRoutePlansReadRepository } from "./ports/logistics-route-plans-read-repository.ts";

// Casos de uso de cache de planes de ruta (M14). Orquestan el read-through de
// los dos GET cacheados (listado y métricas) y las invalidaciones posteriores
// a las mutaciones reales de la ruta, delegando en el puerto de lectura y en el
// puerto de cache. La serialización del snapshot llega desde la ruta como
// callback puro y síncrono (`serializeSnapshot`), sin acceso a HTTP, DB, cache
// ni auth: el caso de uso lo ejecuta únicamente en MISS, después de resolver el
// repositorio y antes de escribir el cache. En error (repositorio o serializer)
// no se escribe cache ni se retorna `cacheStatus`; el error se propaga sin
// envolver. Las claves reproducen carácter por carácter las de la ruta previa a
// M14 (mismo orden, mismos separadores, misma normalización de valores).

export type RoutePlansListCacheKeyInput = {
  clinicId: number;
  status?: string;
  planningMode?: string;
  objective?: string;
  limit: number;
  offset: number;
};

export type RoutePlanMetricsCacheKeyInput = {
  clinicId: number;
  routePlanId: number;
  distanceTolerancePercent?: unknown;
  timeToleranceMin?: unknown;
  toleranceMin?: unknown;
};

export type RoutePlansCacheReadResult<TSnapshot> = {
  cacheStatus: "HIT" | "MISS";
  snapshot: TSnapshot;
};

export type RoutePlanMetricsCacheReadResult<TSnapshot> =
  | RoutePlansCacheReadResult<TSnapshot>
  | {
      cacheStatus?: undefined;
      reason: "route_plan_not_found";
    };

export type RoutePlansCacheUseCases<
  TRoutePlan,
  TRouteStop,
  TListParams,
  TListSnapshot,
  TMetricsSnapshot,
> = {
  getRoutePlansListSnapshot: (
    params: TListParams & RoutePlansListCacheKeyInput,
    serializeSnapshot: (routePlans: TRoutePlan[]) => TListSnapshot,
  ) => Promise<RoutePlansCacheReadResult<TListSnapshot>>;
  getRoutePlanMetricsSnapshot: (
    input: RoutePlanMetricsCacheKeyInput,
    serializeSnapshot: (result: {
      routePlan: TRoutePlan;
      routeStops: TRouteStop[];
    }) => TMetricsSnapshot,
  ) => Promise<RoutePlanMetricsCacheReadResult<TMetricsSnapshot>>;
  invalidateAfterRoutePlanCreated: (clinicId: number) => void;
  invalidateAfterRoutePlanMutation: (
    clinicId: number,
    routePlanId: number,
  ) => void;
  invalidateAfterRouteStopMutation: (
    clinicId: number,
    routePlanId: number,
  ) => void;
};

function serializeCacheValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function buildRoutePlansListCacheKey(input: RoutePlansListCacheKeyInput): string {
  return [
    `clinic:${input.clinicId}`,
    `status:${input.status ?? ""}`,
    `planningMode:${input.planningMode ?? ""}`,
    `objective:${input.objective ?? ""}`,
    `limit:${input.limit}`,
    `offset:${input.offset}`,
  ].join("|");
}

function buildRoutePlanMetricsCacheKey(
  input: RoutePlanMetricsCacheKeyInput,
): string {
  return [
    `clinic:${input.clinicId}`,
    `plan:${input.routePlanId}`,
    `distanceTolerancePercent:${serializeCacheValue(input.distanceTolerancePercent)}`,
    `timeToleranceMin:${serializeCacheValue(input.timeToleranceMin)}`,
    `toleranceMin:${serializeCacheValue(input.toleranceMin)}`,
  ].join("|");
}

export function createRoutePlansCacheUseCases<
  TRoutePlan,
  TRouteStop,
  TListParams,
  TListSnapshot,
  TMetricsSnapshot,
>(deps: {
  repository: LogisticsRoutePlansReadRepository<TRoutePlan, TRouteStop, TListParams>;
  cache: LogisticsRoutePlansCacheRepository<TListSnapshot, TMetricsSnapshot>;
  now: () => number;
}): RoutePlansCacheUseCases<
  TRoutePlan,
  TRouteStop,
  TListParams,
  TListSnapshot,
  TMetricsSnapshot
> {
  return {
    getRoutePlansListSnapshot: async (params, serializeSnapshot) => {
      const nowMs = deps.now();
      const cacheKey = buildRoutePlansListCacheKey(params);
      const cachedSnapshot = deps.cache.getRoutePlansListSnapshot(
        cacheKey,
        nowMs,
      );

      if (cachedSnapshot) {
        return { cacheStatus: "HIT", snapshot: cachedSnapshot };
      }

      const routePlans = await deps.repository.listClinicRoutePlans(params);
      const snapshot = serializeSnapshot(routePlans);

      deps.cache.setRoutePlansListSnapshot(cacheKey, snapshot, nowMs);

      return { cacheStatus: "MISS", snapshot };
    },
    getRoutePlanMetricsSnapshot: async (input, serializeSnapshot) => {
      const nowMs = deps.now();
      const cacheKey = buildRoutePlanMetricsCacheKey(input);
      const cachedSnapshot = deps.cache.getRoutePlanMetricsSnapshot(
        cacheKey,
        nowMs,
      );

      if (cachedSnapshot) {
        return { cacheStatus: "HIT", snapshot: cachedSnapshot };
      }

      const [routePlan, routeStops] = await Promise.all([
        deps.repository.getClinicScopedRoutePlan(
          input.routePlanId,
          input.clinicId,
        ),
        deps.repository.listRouteStopsForClinicRoutePlan(
          input.routePlanId,
          input.clinicId,
        ),
      ]);

      if (!routePlan) {
        return { reason: "route_plan_not_found" };
      }

      const snapshot = serializeSnapshot({ routePlan, routeStops });

      deps.cache.setRoutePlanMetricsSnapshot(cacheKey, snapshot, nowMs);

      return { cacheStatus: "MISS", snapshot };
    },
    invalidateAfterRoutePlanCreated: (clinicId) => {
      deps.cache.clearRoutePlansListByClinic(clinicId);
    },
    invalidateAfterRoutePlanMutation: (clinicId, routePlanId) => {
      deps.cache.clearRoutePlansListByClinic(clinicId);
      deps.cache.clearRoutePlanMetricsByPlan(clinicId, routePlanId);
    },
    invalidateAfterRouteStopMutation: (clinicId, routePlanId) => {
      deps.cache.clearRoutePlanMetricsByPlan(clinicId, routePlanId);
    },
  };
}
