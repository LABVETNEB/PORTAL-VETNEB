import type { Metadata } from "next";
import { WifiOff, ShieldCheck, RefreshCw, LockKeyhole } from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { OfflineActions } from "@/components/pwa/OfflineActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata(
  "Sin conexión — Portal VETNEB",
  "Página offline de Portal VETNEB. Permite mantener una experiencia segura cuando la conexión de red no está disponible.",
  "/offline",
);

const offlineGuidance = [
  {
    icon: RefreshCw,
    title: "Reintente cuando vuelva la red",
    description:
      "Las páginas públicas pueden recuperarse al restablecerse la conexión. La información clínica requiere comunicación en línea con el backend seguro.",
  },
  {
    icon: LockKeyhole,
    title: "Datos privados protegidos",
    description:
      "Informes, dashboards y sesiones autenticadas no se muestran desde caché offline para evitar exposición accidental de información sensible.",
  },
  {
    icon: ShieldCheck,
    title: "Operación segura",
    description:
      "El modo offline conserva únicamente recursos públicos necesarios para orientar al usuario y no reemplaza la trazabilidad clínica real.",
  },
];

export default function OfflinePage() {
  return (
    <PublicLayout>
      <section className="public-soft-canvas py-16 md:py-24" aria-labelledby="offline-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-vetneb-navy text-primary-foreground shadow-lg shadow-vetneb-navy/20">
              <WifiOff className="h-8 w-8" aria-hidden="true" />
            </div>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.24em] text-vetneb-teal">
              Modo sin conexión
            </p>
            <h1 id="offline-heading" className="mt-3 text-3xl font-bold tracking-tight text-vetneb-ink md:text-5xl">
              Portal VETNEB no puede conectarse en este momento
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Verifique su conexión a internet e intente nuevamente. Por seguridad, el acceso a informes, sesiones clínicas y administración requiere una conexión activa con el servicio backend.
            </p>
            <OfflineActions />
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {offlineGuidance.map((item) => {
              const Icon = item.icon;

              return (
                <Card key={item.title} className="border-vetneb-line/80 bg-card/90 shadow-sm">
                  <CardHeader>
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-vetneb-teal/12 text-vetneb-teal">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-lg text-vetneb-ink">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
