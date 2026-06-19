import {
  isAdminAccessErrorStatus,
  type AdminAccessErrorStatus,
} from "@/lib/api-error";

export type { AdminAccessErrorStatus } from "@/lib/api-error";

type AdminAccessErrorListener = () => void;

let browserAccessErrorStatus: AdminAccessErrorStatus | null = null;
const browserAccessErrorListeners = new Set<AdminAccessErrorListener>();

export function publishAdminAccessErrorStatus(status: number): boolean {
  if (
    typeof window === "undefined" ||
    !isAdminAccessErrorStatus(status)
  ) {
    return false;
  }

  if (browserAccessErrorStatus === status) {
    return true;
  }

  browserAccessErrorStatus = status;
  browserAccessErrorListeners.forEach((listener) => listener());
  return true;
}

export function clearAdminAccessError(): void {
  if (typeof window === "undefined" || browserAccessErrorStatus === null) {
    return;
  }

  browserAccessErrorStatus = null;
  browserAccessErrorListeners.forEach((listener) => listener());
}

export function subscribeAdminAccessError(
  listener: AdminAccessErrorListener,
): () => void {
  browserAccessErrorListeners.add(listener);
  return () => browserAccessErrorListeners.delete(listener);
}

export function getAdminAccessErrorSnapshot(): AdminAccessErrorStatus | null {
  return browserAccessErrorStatus;
}

export function getAdminAccessErrorServerSnapshot(): null {
  return null;
}
