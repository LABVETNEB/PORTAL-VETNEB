export const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

export function shouldRefreshSessionLastAccess(
  lastAccess: Date | null | undefined,
  nowMs: number,
  intervalMs = SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS,
) {
  if (!(lastAccess instanceof Date)) {
    return true;
  }

  return nowMs - lastAccess.getTime() >= intervalMs;
}
