export const CLIENT_APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "development";

export type AppVersionSnapshot = {
  success: true;
  appVersion: string;
  clientMinVersion: string;
  forceUpdate: boolean;
};

export async function getAppVersionSnapshot(): Promise<AppVersionSnapshot> {
  const response = await fetch(`/api/app-version?t=${Date.now()}`, {
    cache: "no-store",
    credentials: "include",
    headers: {
      accept: "application/json",
      "x-vetneb-client-version": CLIENT_APP_VERSION,
    },
  });

  if (!response.ok) {
    throw new Error("No se pudo verificar la versión de la aplicación.");
  }

  return response.json() as Promise<AppVersionSnapshot>;
}

export function isClientVersionOutdated(snapshot: AppVersionSnapshot): boolean {
  if (!snapshot.forceUpdate) {
    return false;
  }

  if (!snapshot.appVersion || CLIENT_APP_VERSION === "development") {
    return false;
  }

  return CLIENT_APP_VERSION !== snapshot.appVersion;
}
