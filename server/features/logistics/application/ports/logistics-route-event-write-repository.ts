// Puerto mínimo de escritura de eventos de ruta del contexto Logistics (M10),
// derivado del seam `LogisticsRouteEventsNativeRoutesOptions`
// (server/routes/logistics-route-events.fastify.ts). Modela únicamente el append
// explícito consumido por `POST /`. Los genéricos evitan filtrar tipos concretos
// de DB o del schema hacia application.

export type LogisticsRouteEventWriteRepository<TRouteEvent, TCreateInput> = {
  createRouteEvent: (
    input: TCreateInput,
  ) => Promise<TRouteEvent | null | undefined>;
};
