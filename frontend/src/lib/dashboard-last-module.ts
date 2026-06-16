export const CLINIC_LAST_MODULE_STORAGE_KEY =
  "vetneb:dashboard:last-module:clinic";
export const ADMIN_LAST_MODULE_STORAGE_KEY =
  "vetneb:dashboard:last-module:admin";

export function readDashboardLastModule(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeDashboardLastModule(key: string, moduleId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, moduleId);
  } catch {
    // localStorage unavailable (private mode / disabled) — ignore.
  }
}
