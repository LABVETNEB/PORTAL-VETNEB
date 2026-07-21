// Adaptador de cache de planes de ruta (M14). Implementa, por composición
// mínima sobre el cache canónico de M13 (`./logistics-route-plans-cache.ts`,
// intacto: mismas Maps, TTL de 5 minutos, expiración lazy y prefijos), el
// puerto `LogisticsRoutePlansCacheRepository` que define application. La
// conformidad con el puerto es estructural: esta capa no importa `application`
// (la dirección de dependencia no se invierte). Sólo expone las operaciones
// que la ruta consume realmente vía el caso de uso de M14.

import {
  clearRoutePlanMetricsCacheByPlan,
  clearRoutePlansCacheByClinic,
  getCachedRoutePlanMetricsSnapshot,
  getCachedRoutePlansSnapshot,
  setCachedRoutePlanMetricsSnapshot,
  setCachedRoutePlansSnapshot,
} from "./logistics-route-plans-cache.ts";

export type LogisticsRoutePlansCacheAdapter<TListSnapshot, TMetricsSnapshot> = {
  getRoutePlansListSnapshot: (key: string, now: number) => TListSnapshot | null;
  setRoutePlansListSnapshot: (
    key: string,
    snapshot: TListSnapshot,
    now: number,
  ) => void;
  clearRoutePlansListByClinic: (clinicId: number) => void;
  getRoutePlanMetricsSnapshot: (key: string, now: number) => TMetricsSnapshot | null;
  setRoutePlanMetricsSnapshot: (
    key: string,
    snapshot: TMetricsSnapshot,
    now: number,
  ) => void;
  clearRoutePlanMetricsByPlan: (clinicId: number, routePlanId: number) => void;
};

export function createLogisticsRoutePlansCacheAdapter<
  TListSnapshot,
  TMetricsSnapshot,
>(): LogisticsRoutePlansCacheAdapter<TListSnapshot, TMetricsSnapshot> {
  return {
    getRoutePlansListSnapshot: (key, now) =>
      getCachedRoutePlansSnapshot<TListSnapshot>(key, now),
    setRoutePlansListSnapshot: (key, snapshot, now) =>
      setCachedRoutePlansSnapshot(key, snapshot, now),
    clearRoutePlansListByClinic: (clinicId) =>
      clearRoutePlansCacheByClinic(clinicId),
    getRoutePlanMetricsSnapshot: (key, now) =>
      getCachedRoutePlanMetricsSnapshot<TMetricsSnapshot>(key, now),
    setRoutePlanMetricsSnapshot: (key, snapshot, now) =>
      setCachedRoutePlanMetricsSnapshot(key, snapshot, now),
    clearRoutePlanMetricsByPlan: (clinicId, routePlanId) =>
      clearRoutePlanMetricsCacheByPlan(clinicId, routePlanId),
  };
}
