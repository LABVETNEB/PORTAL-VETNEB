export const CLIENT_VERSION_HEADER = "x-vetneb-client-version";

// Sentinel técnico interno: nunca debe llegar a la UI. Para texto visible al
// usuario, pasar siempre por toSafeDisplayVersion().
export const CLIENT_APP_VERSION_FALLBACK = "missing-client-version";

export const CLIENT_APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION?.trim() || CLIENT_APP_VERSION_FALLBACK;

export type AppVersionSnapshot = {
  success: true;
  appVersion: string;
  clientMinVersion: string;
  forceUpdate: boolean;
  displayVersion?: string;
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
  if (!snapshot.forceUpdate || !snapshot.appVersion) {
    return false;
  }

  return CLIENT_APP_VERSION !== snapshot.appVersion;
}

// Texto fijo cuando no hay una versión comercial detectable. Se usa solo
// como valor (la etiqueta "Versión instalada"/"Versión vigente" ya aclara
// de qué se trata), nunca como identificador técnico.
export const VERSION_NOT_DETECTED_LABEL = "anterior / no detectada";

const PRODUCT_DISPLAY_VERSION_PREFIX = "Portal VETNEB v";
const SEMVER_LIKE_VERSION_PATTERN = /^v?\d+(\.\d+){1,3}$/i;

// Convierte cualquier identificador técnico (sentinel, SHA de commit,
// semver) en una etiqueta apta para usuario final. Nunca debe devolver un
// hash ni el sentinel "missing-client-version" crudo: ver bug donde la
// pantalla de actualización mostraba esos valores directamente.
export function toSafeDisplayVersion(
  rawVersion: string | null | undefined,
): string {
  const value = rawVersion?.trim();

  if (!value || value === CLIENT_APP_VERSION_FALLBACK) {
    return VERSION_NOT_DETECTED_LABEL;
  }

  if (value.startsWith(PRODUCT_DISPLAY_VERSION_PREFIX)) {
    return value;
  }

  if (SEMVER_LIKE_VERSION_PATTERN.test(value)) {
    return `${PRODUCT_DISPLAY_VERSION_PREFIX}${value.replace(/^v/i, "")}`;
  }

  return VERSION_NOT_DETECTED_LABEL;
}

const APP_VERSION_LOCAL_STORAGE_PREFIX = "vetneb:app-version:";

// Defensivo: hoy ninguna clave usa este prefijo, pero "Actualizar ahora"
// debe limpiarlas si una versión futura las agrega. Nunca toca otras claves
// (tema, último módulo del dashboard, etc.).
export function clearAppVersionLocalState(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const keysToRemove: string[] = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);

      if (key && key.startsWith(APP_VERSION_LOCAL_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // localStorage no disponible (modo privado / deshabilitado) — ignorar.
  }
}
