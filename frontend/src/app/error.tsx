"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

// D-01: a render or payload failure below the root layout. The copy is fixed:
// neither the error's message nor its digest reaches the DOM.
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex min-h-[62vh] items-center justify-center px-4 py-16">
      <section
        role="alert"
        aria-labelledby="route-error-title"
        data-route-error-boundary="app"
        className="w-full max-w-lg rounded-2xl border border-vetneb-line/75 bg-card/90 p-7 text-center shadow-sm sm:p-9"
      >
        <AlertTriangle className="mx-auto h-8 w-8 text-vetneb-teal" aria-hidden="true" />
        <h1 id="route-error-title" className="mt-4 text-2xl font-bold text-vetneb-ink">
          No pudimos cargar esta página
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Ocurrió un problema al cargar el contenido. Podés reintentar o volver al inicio.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" onClick={() => retry()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </Button>
          <PublicRouteControl
            href={ROUTES.home}
            variant="bare"
            className="public-cta-outline inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold"
          >
            Volver al inicio
          </PublicRouteControl>
        </div>
      </section>
    </main>
  );
}
