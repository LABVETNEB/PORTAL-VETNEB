"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  CLIENT_APP_VERSION,
  clearAppVersionLocalState,
  getAppVersionSnapshot,
  isClientVersionOutdated,
  toSafeDisplayVersion,
  type AppVersionSnapshot,
} from "@/lib/app-version";
import {
  getClientVersionUnsupportedServerSnapshot,
  getClientVersionUnsupportedSnapshot,
  subscribeClientVersionUnsupported,
} from "@/lib/client-version-error";

const VERSION_CHECK_INTERVAL_MS = 60_000;

const UPDATE_HELP_TEXT =
  "Si el aviso vuelve a aparecer, cerrá la app, eliminá el acceso directo instalado y abrí https://vetneb.com.ar nuevamente.";

async function clearPortalCaches() {
  if (typeof window === "undefined" || !("caches" in window)) {
    return;
  }

  const cacheKeys = await caches.keys();
  await Promise.all(
    cacheKeys
      .filter((key) => key.startsWith("portal-vetneb-"))
      .map((key) => caches.delete(key)),
  );
}

async function unregisterServiceWorkers() {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map((registration) => registration.unregister()),
  );
}

// Recarga simple no alcanza: si el SW viejo sigue activo puede re-servir el
// mismo shell. Por eso reemplazamos la URL (sin dejar la pantalla bloqueada
// en el historial) y agregamos un cache-buster para forzar red real.
function navigateToFreshAppShell() {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("vetnebUpdate", Date.now().toString());
  window.location.replace(url.toString());
}

function VersionsSummary({
  installedLabel,
  currentLabel,
}: {
  installedLabel: string;
  currentLabel: string;
}) {
  return (
    <dl className="mt-4 grid gap-2 rounded-lg border border-vetneb-line/70 bg-vetneb-surface/70 p-3 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <dt>Versión instalada</dt>
        <dd className="break-words text-right font-medium text-vetneb-ink">
          {installedLabel}
        </dd>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <dt>Versión vigente</dt>
        <dd className="break-words text-right font-medium text-vetneb-ink">
          {currentLabel}
        </dd>
      </div>
    </dl>
  );
}

function UpdateHelpNote() {
  return (
    <p className="mt-3 break-words text-xs leading-5 text-muted-foreground">
      {UPDATE_HELP_TEXT}
    </p>
  );
}

export function AppVersionGate() {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [isUpdateRequired, setIsUpdateRequired] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const clientVersionUnsupported = useSyncExternalStore(
    subscribeClientVersionUnsupported,
    getClientVersionUnsupportedSnapshot,
    getClientVersionUnsupportedServerSnapshot,
  );

  const evaluateSnapshot = useCallback((snapshot: AppVersionSnapshot) => {
    setLatestVersion(snapshot.displayVersion ?? snapshot.appVersion);
    setCheckFailed(false);
    setIsUpdateRequired(isClientVersionOutdated(snapshot));
  }, []);

  const checkVersion = useCallback(async () => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    try {
      evaluateSnapshot(await getAppVersionSnapshot());
    } catch {
      setCheckFailed(true);
    }
  }, [evaluateSnapshot]);

  useEffect(() => {
    void checkVersion();

    if (process.env.NODE_ENV !== "production") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void checkVersion();
    }, VERSION_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [checkVersion]);

  async function handleUpdateNow() {
    setIsReloading(true);

    try {
      await unregisterServiceWorkers();
      await clearPortalCaches();
      clearAppVersionLocalState();
    } finally {
      navigateToFreshAppShell();
    }
  }

  const installedVersionLabel = toSafeDisplayVersion(CLIENT_APP_VERSION);
  const currentVersionLabel = toSafeDisplayVersion(latestVersion);

  if (clientVersionUnsupported) {
    return (
      <div
        className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-vetneb-navy/82 px-4 py-6 backdrop-blur-sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="client-version-unsupported-title"
        aria-describedby="client-version-unsupported-description"
        data-app-version-gate="true"
        data-client-version-unsupported="true"
      >
        <div className="w-full max-w-lg rounded-2xl border border-vetneb-line/80 bg-card p-6 shadow-2xl">
          <p className="mb-2 inline-flex rounded-full bg-vetneb-teal/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-vetneb-teal">
            Nueva versión disponible
          </p>
          <h2
            id="client-version-unsupported-title"
            className="text-2xl font-semibold text-vetneb-ink"
          >
            Actualización requerida
          </h2>
          <p
            id="client-version-unsupported-description"
            className="mt-3 text-sm leading-6 text-muted-foreground"
          >
            Estás usando una versión anterior de VETNEB. Para proteger tu
            sesión y evitar errores, actualizá o reinstalá la app.
          </p>
          <VersionsSummary
            installedLabel={installedVersionLabel}
            currentLabel={currentVersionLabel}
          />
          <button
            type="button"
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-vetneb-teal px-4 py-3 text-sm font-semibold text-vetneb-navy transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
            onClick={() => void handleUpdateNow()}
            disabled={isReloading}
          >
            {isReloading ? "Actualizando..." : "Actualizar ahora"}
          </button>
          <UpdateHelpNote />
        </div>
      </div>
    );
  }

  if (!isUpdateRequired) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-vetneb-navy/82 px-4 py-6 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-version-gate-title"
      aria-describedby="app-version-gate-description"
      data-app-version-gate="true"
    >
      <div className="w-full max-w-lg rounded-2xl border border-vetneb-line/80 bg-card p-6 shadow-2xl">
        <p className="mb-2 inline-flex rounded-full bg-vetneb-teal/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-vetneb-teal">
          Nueva versión disponible
        </p>
        <h2
          id="app-version-gate-title"
          className="text-2xl font-semibold text-vetneb-ink"
        >
          Actualizá Portal VETNEB para continuar
        </h2>
        <p
          id="app-version-gate-description"
          className="mt-3 text-sm leading-6 text-muted-foreground"
        >
          Esta pantalla está usando una versión anterior de la aplicación. Para
          evitar errores de comunicación, permisos, notificaciones o acciones
          incompletas, el uso queda bloqueado hasta cargar la versión vigente.
        </p>
        <VersionsSummary
          installedLabel={installedVersionLabel}
          currentLabel={currentVersionLabel}
        />
        {checkFailed ? (
          <p className="mt-3 rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            No se pudo verificar nuevamente la versión. Revisá conexión y
            volvé a intentar la actualización.
          </p>
        ) : null}
        <button
          type="button"
          className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-vetneb-teal px-4 py-3 text-sm font-semibold text-vetneb-navy transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
          onClick={() => void handleUpdateNow()}
          disabled={isReloading}
        >
          {isReloading ? "Actualizando..." : "Actualizar ahora"}
        </button>
        <UpdateHelpNote />
      </div>
    </div>
  );
}
