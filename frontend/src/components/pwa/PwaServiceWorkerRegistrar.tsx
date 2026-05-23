"use client";

import { useEffect } from "react";

const SERVICE_WORKER_PATH = "/sw.js";

function canRegisterServiceWorker(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    window.location.protocol === "https:"
  );
}

export function PwaServiceWorkerRegistrar() {
  useEffect(() => {
    if (!canRegisterServiceWorker()) {
      return;
    }

    let isMounted = true;

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          SERVICE_WORKER_PATH,
          { scope: "/" },
        );

        if (!isMounted) {
          return;
        }

        await registration.update();
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          const detail = error instanceof Error ? error.message : String(error);
          console.warn(`[PWA] No se pudo registrar el service worker: ${detail}`);
        }
      }
    };

    void registerServiceWorker();

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}
