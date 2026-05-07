export type RuntimeTimer = {
  readonly startedAtMs: number;
  elapsedMs: () => number;
};

export function getMonotonicNowMs(): number {
  if (
    typeof globalThis.performance?.now === "function" &&
    Number.isFinite(globalThis.performance.now())
  ) {
    return globalThis.performance.now();
  }

  return Date.now();
}

export function createRuntimeTimer(
  nowMs: () => number = getMonotonicNowMs,
): RuntimeTimer {
  const startedAtMs = nowMs();

  return {
    startedAtMs,
    elapsedMs: () => Math.max(0, nowMs() - startedAtMs),
  };
}
