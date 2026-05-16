import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  FileText,
  Globe2,
  Search,
  ShieldCheck,
  Truck,
  UsersRound,
} from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AmbientOrbs, VisualIcon } from "@/components/public/VisualAccents";
import { createPageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = createPageMetadata(
  "Portal para Clínicas Veterinarias",
  "Acceso al portal de gestión para clínicas veterinarias. Informes, seguimiento de estudios, logística y auditoría desde un único lugar.",
  "/clinicas",
);

const features = [
  {
    icon: FileText,
    tone: "blue" as const,
    title: "Recepción de informes",
    description:
      "Reciba los resultados de estudios directamente en su portal. Notificaciones automáticas cuando un informe esté listo.",
  },
  {
    icon: Search,
    tone: "emerald" as const,
    title: "Búsqueda avanzada",
    description:
      "Encuentre informes por paciente, tipo de estudio, fecha o estado. Filtros potentes para gestionar grandes volúmenes.",
  },
  {
    icon: Truck,
    tone: "amber" as const,
    title: "Seguimiento de logística",
    description:
      "Vea el estado de las visitas de campo y entregas programadas para su clínica. Transparencia total en el proceso.",
  },
  {
    icon: ShieldCheck,
    tone: "blue" as const,
    title: "Acceso seguro y auditado",
    description:
      "Cada acceso a informes queda registrado. Control total sobre quién accede a qué información y cuándo.",
  },
  {
    icon: UsersRound,
    tone: "slate" as const,
    title: "Gestión de usuarios",
    description:
      "Administre los usuarios de su clínica con roles diferenciados: propietario y personal de clínica.",
  },
  {
    icon: Globe2,
    tone: "emerald" as const,
    title: "Perfil público",
    description:
      "Mantenga actualizado el perfil público de su clínica en el directorio de Portal VETNEB.",
  },
];

const steps = [
  {
    number: "01",
    title: "Solicite acceso",
    description:
      "Complete el formulario de contacto para registrar su clínica en Portal VETNEB.",
  },
  {
    number: "02",
    title: "Configure su cuenta",
    description:
      "Reciba sus credenciales y configure los usuarios de su equipo con los roles apropiados.",
  },
  {
    number: "03",
    title: "Acceda a sus informes",
    description:
      "Desde el dashboard privado, acceda a todos los informes y estudios de su clínica.",
  },
  {
    number: "04",
    title: "Gestione su operación",
    description:
      "Utilice las herramientas de seguimiento, logística y auditoría para optimizar su práctica.",
  },
];

export default function ClinicasPage() {
  return (
    <PublicLayout>
      <section className="public-secondary-hero-surface py-16 text-white md:py-20">
        <AmbientOrbs variant="dark" />
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="mb-5 max-w-4xl text-4xl font-bold md:text-5xl">
            Portal para clínicas veterinarias
          </h1>
          <p className="max-w-2xl text-xl leading-relaxed text-primary-foreground/92">
            Gestión centralizada de informes, estudios y logística para su
            clínica veterinaria. Acceso seguro, trazable y disponible las 24 hs.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full border-vetneb-line/90 bg-card/95 px-7 font-semibold text-vetneb-navy shadow-sm hover:border-vetneb-teal/45 hover:bg-vetneb-surface-raised hover:text-vetneb-navy sm:w-auto"
            >
              <Link href={ROUTES.login}>
                Acceder al portal
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="border border-white/60 bg-white/10 font-semibold text-white shadow-sm hover:bg-white/16"
            >
              <Link href={ROUTES.contacto}>Solicitar acceso</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="public-soft-canvas">
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-vetneb-ink md:text-3xl">
              Todo lo que necesita su clínica
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Un sistema visualmente claro, trazable y preparado para trabajo
              diario de alto volumen.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="premium-card">
                <CardHeader>
                  <VisualIcon icon={feature.icon} tone={feature.tone} className="mb-2" />
                  <CardTitle className="text-lg text-vetneb-ink">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-vetneb-ink md:text-3xl">
              Cómo comenzar
            </h2>
          </div>

          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number} className="premium-card-muted p-5">
                <div className="mb-4 inline-flex items-center rounded-full border border-vetneb-teal/35 bg-vetneb-teal/10 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-vetneb-navy">
                  {step.number}
                </div>
                <h3 className="mb-2 font-semibold text-vetneb-ink">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          <div className="clinical-muted-band mx-auto mt-10 max-w-3xl rounded-lg p-6 clinical-surface-shadow">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <VisualIcon icon={ClipboardCheck} tone="emerald" className="h-11 w-11 shrink-0 rounded-xl" />
                <div>
                  <h3 className="font-semibold text-vetneb-ink">
                    Acceso clínico seguro
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Credenciales separadas del acceso particular por token.
                  </p>
                </div>
              </div>
              <Button asChild className="border border-vetneb-line/90 bg-card/90 text-vetneb-navy shadow-sm hover:border-vetneb-teal/45 hover:bg-accent/60">
                <Link href={ROUTES.login}>Ingresar</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      </div>
    </PublicLayout>
  );
}

