import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  Microscope,
} from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Página no encontrada",
  description:
    "No encontramos la página que estás buscando en Portal VETNEB.",
};

export default function NotFound() {
  return (
    <PublicLayout showFaq={false}>
      <section
        className="relative isolate flex min-h-[62vh] items-center overflow-hidden py-16 sm:py-20 lg:py-24"
        aria-labelledby="not-found-title"
      >
        <div
          className="absolute inset-0 bg-[linear-gradient(118deg,hsl(var(--vetneb-cyan)/0.10),transparent_34%),linear-gradient(302deg,hsl(var(--vetneb-teal)/0.10),transparent_38%)]"
          aria-hidden="true"
        />
        <div
          className="absolute -right-28 top-10 h-72 w-72 rounded-full border border-vetneb-teal/20 bg-vetneb-teal/5 sm:h-96 sm:w-96"
          aria-hidden="true"
        />
        <div
          className="absolute -left-32 bottom-0 h-64 w-64 rounded-full border border-vetneb-cyan/15 bg-vetneb-cyan/5"
          aria-hidden="true"
        />

        <div className="container relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:gap-16">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-vetneb-teal/30 bg-card/75 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-vetneb-teal shadow-sm">
                <Microscope className="h-4 w-4" aria-hidden="true" />
                Portal VETNEB
              </p>

              <h1
                id="not-found-title"
                className="mt-6 text-4xl font-bold leading-tight text-vetneb-ink sm:text-5xl lg:text-6xl"
              >
                Página no encontrada
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                No encontramos la página que estás buscando. Podés volver al
                inicio o consultar los servicios disponibles de VETNEB.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <PublicRouteControl
                  href={ROUTES.home}
                  variant="bare"
                  className="public-cta-primary inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-6 text-sm sm:w-auto"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Volver al inicio
                </PublicRouteControl>

                <PublicRouteControl
                  href={ROUTES.servicios}
                  variant="bare"
                  className="public-cta-outline inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-6 text-sm sm:w-auto"
                >
                  Ver servicios
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </PublicRouteControl>

                <PublicRouteControl
                  href={ROUTES.contacto}
                  variant="bare"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-vetneb-navy underline-offset-4 transition hover:text-vetneb-teal hover:underline sm:w-auto"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Contactar
                </PublicRouteControl>
              </div>
            </div>

            <aside
              className="relative overflow-hidden rounded-2xl border border-vetneb-line/75 bg-card/88 p-7 shadow-[0_24px_70px_rgba(15,45,62,0.13)] sm:p-9"
              aria-label="Información institucional VETNEB"
            >
              <div
                className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,hsl(var(--vetneb-teal)),hsl(var(--vetneb-cyan)))]"
                aria-hidden="true"
              />
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_14px_34px_hsl(var(--vetneb-navy)/0.22)]">
                <Microscope className="h-7 w-7" aria-hidden="true" />
              </div>
              <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-vetneb-teal">
                Servicio Patológico
              </p>
              <p className="mt-2 text-3xl font-black tracking-[0.08em] text-vetneb-ink">
                VETNEB
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Diagnóstico anatomopatológico veterinario, información de
                servicios y canales de contacto institucional.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
