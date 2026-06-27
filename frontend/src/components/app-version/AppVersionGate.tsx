"use client";

import { useCallback, useEffect, useState } from "react";

import {
  CLIENT_APP_VERSION,
  getAppVersionSnapshot,
  isClientVersionOutdated,
  type AppVersionSnapshot,
} from "@/lib/app-version";

const VERSION_CHECK_INTERVAL_MS = 60_000;

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

async function updateServiceWorkers() {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map(async (registration) => {
      await registration.update();
      registration.waiting?.postMessage({ type: "VETNEB_SKIP_WAITING" });
    }),
  );
}

export function AppVersionGate() {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [isUpdateRequired, setIsUpdateRequired] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);

  const evaluateSnapshot = useCallback((snapshot: AppVersionSnapshot) => {
    setLatestVersion(snapshot.appVersion);
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

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkVersion();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkVersion]);

  async function handleUpdateNow() {
    setIsReloading(true);

    try {
      await updateServiceWorkers();
      await clearPortalCaches();
    } finally {
      window.location.reload();
    }
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
        <dl className="mt-4 grid gap-2 rounded-lg border border-vetneb-line/70 bg-vetneb-surface/70 p-3 text-xs text-muted-foreground">
          <div className="flex justify-between gap-3">
            <dt>Versión actual</dt>
            <dd className="font-mono text-vetneb-ink">{CLIENT_APP_VERSION}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Versión vigente</dt>
            <dd className="font-mono text-vetneb-ink">{latestVersion ?? "—"}</dd>
          </div>
        </dl>
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
      </div>
    </div>
  );
}
