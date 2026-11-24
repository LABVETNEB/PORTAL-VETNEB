/**
 * Guarda de admision en memoria: como maximo una ejecucion activa por instancia
 * de la guarda (un proceso del backend). No coordina replicas. La guarda se
 * mantiene hasta que el trabajo termina (resuelve, lanza o se rechaza): no
 * existe vencimiento por tiempo, porque un temporizador no cancela el trabajo
 * en curso y liberar antes permitiria dos ejecuciones simultaneas.
 */
export type SingleFlightResult<T> =
  | { admitted: true; value: T }
  | { admitted: false };

export type SingleFlightGuard = {
  runExclusive<T>(work: () => Promise<T>): Promise<SingleFlightResult<T>>;
};

export function createSingleFlightGuard(): SingleFlightGuard {
  let active = false;

  return {
    async runExclusive<T>(work: () => Promise<T>) {
      if (active) {
        return { admitted: false } as const;
      }

      active = true;

      try {
        return { admitted: true, value: await work() } as const;
      } finally {
        active = false;
      }
    },
  };
}
