"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { useDashboardNavigationBoundary } from "@/components/dashboard/DashboardNavigationProvider";
import { Button } from "@/components/ui/button";

// D-01: a failed module render or payload inside the dashboard shell. It
// replaces the page, which owns the main landmark, so it brings its own. The
// copy is fixed: neither the error's message nor its digest reaches the DOM.
export default function DashboardError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const navigation = useDashboardNavigationBoundary();

  // The navigation owner is FAILED for exactly as long as this boundary is
  // mounted. Next also drops the boundary without `retry()` when the pathname
  // changes, so the cleanup is what tells the owner it left.
  useEffect(() => {
    if (navigation === null) return undefined;
    navigation.failed();
    return () => navigation.left();
  }, [navigation]);

  return (
    <main id="main-content" className="flex min-h-0 flex-1 items-center justify-center p-4">
      <section
        role="alert"
        aria-labelledby="dashboard-route-error-title"
        data-route-error-boundary="dashboard"
        className="flex w-full max-w-md flex-col items-center rounded-lg border border-vetneb-line bg-card px-6 py-8 text-center"
      >
        <AlertTriangle className="h-6 w-6 text-vetneb-teal" aria-hidden="true" />
        <h2 id="dashboard-route-error-title" className="mt-3 text-base font-semibold text-vetneb-ink">
          No pudimos cargar este módulo
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ocurrió un problema al cargar el contenido. Reintentá para volver a cargarlo.
        </p>
        <Button
          type="button"
          className="mt-5"
          onClick={() => {
            navigation?.left();
            retry();
          }}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reintentar
        </Button>
      </section>
    </main>
  );
}
