type ClinicHubResetListener = () => void;

const hubResetListeners = new Set<ClinicHubResetListener>();

export function requestClinicHubReset(): void {
  if (typeof window === "undefined") {
    return;
  }
  hubResetListeners.forEach((listener) => listener());
}

export function subscribeClinicHubReset(
  listener: ClinicHubResetListener,
): () => void {
  hubResetListeners.add(listener);
  return () => hubResetListeners.delete(listener);
}

type ClinicModuleActivateListener = (moduleId: string) => void;

const moduleActivateListeners = new Set<ClinicModuleActivateListener>();

export function requestClinicModuleActivate(moduleId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  moduleActivateListeners.forEach((listener) => listener(moduleId));
}

export function subscribeClinicModuleActivate(
  listener: ClinicModuleActivateListener,
): () => void {
  moduleActivateListeners.add(listener);
  return () => moduleActivateListeners.delete(listener);
}
