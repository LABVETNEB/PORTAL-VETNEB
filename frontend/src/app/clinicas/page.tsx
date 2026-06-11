import type { Metadata } from "next";
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
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { VisualIcon } from "@/components/public/VisualAccents";
import { ReportPreviewCard } from "@/components/public/ReportPreviewCard";
import { createPageMetadata, getClinicasPageJsonLd } from "@/lib/seo";
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
  const jsonLd = getClinicasPageJsonLd();

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section
        className="public-secondary-hero-surface py-16 text-white md:py-20"
        aria-labelledby="clinicas-page-title"
      >
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <h1
            id="clinicas-page-title"
            className="mb-5 max-w-4xl text-4xl font-bold md:text-5xl"
          >
            Portal para clínicas veterinarias
          </h1>
          <p className="max-w-2xl text-xl leading-relaxed text-primary-foreground/92">
            Gestión centralizada de informes, estudios y logística para su
            clínica veterinaria. Acceso seguro, trazable y disponible las 24 hs.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <PublicRouteControl
              href={ROUTES.login}
              variant="primaryDark"
              className="public-cta-primary w-full sm:w-auto"
            >
              Acceder al portal
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </PublicRouteControl>
            <PublicRouteControl
              href={ROUTES.contacto}
              variant="secondaryOutline"
              className="public-cta-on-hero w-full sm:w-auto"
            >
              Solicitar acceso
            </PublicRouteControl>
          </div>
        </div>
      </section>

      <div className="public-soft-canvas">
        <section
          className="py-16 md:py-20"
          aria-labelledby="clinicas-features-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="section">
              <div className="mx-auto mb-10 max-w-3xl text-center">
                <h2
                  id="clinicas-features-heading"
                  className="text-2xl font-bold text-vetneb-ink md:text-3xl"
                >
                  Todo lo que necesita su clínica
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Un sistema visualmente claro, trazable y preparado para trabajo
                  diario de alto volumen.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal variant="cards" staggerChildren>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {features.map((feature) => {
                  const featureHeadingId = `clinicas-feature-${feature.title.toLowerCase().replace(/\s+/g, "-")}`;

                  return (
                    <article
                      key={feature.title}
                      data-scroll-reveal-item
                      aria-labelledby={featureHeadingId}
                    >
                      <Card className="premium-card">
                        <CardHeader>
                          <VisualIcon
                            icon={feature.icon}
                            tone={feature.tone}
                            className="mb-2"
                          />
                          <CardTitle id={featureHeadingId} className="text-lg text-vetneb-ink">
                            {feature.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                            {feature.description}
                          </CardDescription>
                        </CardContent>
                      </Card>
                    </article>
                  );
                })}
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        {/* Informe digital — preview B2B demostrativo */}
        <section
          className="border-t border-vetneb-line/70 bg-gradient-to-b from-vetneb-surface-muted/30 to-white py-14 md:py-20"
          aria-labelledby="clinicas-report-preview-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="section">
              <div className="mx-auto mb-10 max-w-3xl text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-vetneb-teal">
                  Informe digital
                </p>
                <h2
                  id="clinicas-report-preview-heading"
                  className="mt-3 text-2xl font-bold text-vetneb-ink md:text-3xl"
                >
                  El informe diagnóstico que recibe tu clínica
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Acceso directo al portal, trazabilidad del caso y posibilidad de
                  derivar el informe al tutor del paciente. Ejemplo visual sin datos reales.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal variant="minimal">
              <div className="mx-auto max-w-2xl">
                <ReportPreviewCard />
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section
          className="py-16 md:py-20"
          aria-labelledby="clinicas-onboarding-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="section">
              <div className="mx-auto mb-10 max-w-3xl text-center">
                <h2
                  id="clinicas-onboarding-heading"
                  className="text-2xl font-bold text-vetneb-ink md:text-3xl"
                >
                  Cómo comenzar
                </h2>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal variant="cards" staggerChildren>
              <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {steps.map((step) => (
                  <article
                    key={step.number}
                    data-scroll-reveal-item
                    aria-labelledby={`clinicas-step-${step.number}`}
                    className="premium-card-muted p-5"
                  >
                    <div className="mb-4 inline-flex items-center rounded-full border border-vetneb-teal/35 bg-vetneb-teal/10 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-vetneb-navy">
                      {step.number}
                    </div>
                    <h3
                      id={`clinicas-step-${step.number}`}
                      className="mb-2 font-semibold text-vetneb-ink"
                    >
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </article>
                ))}
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal variant="minimal">
              <section
                className="clinical-muted-band mx-auto mt-10 max-w-3xl rounded-lg p-6 clinical-surface-shadow"
                aria-labelledby="clinicas-secure-access-heading"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <VisualIcon
                      icon={ClipboardCheck}
                      tone="emerald"
                      className="h-11 w-11 shrink-0 rounded-xl"
                    />
                    <div>
                      <h3
                        id="clinicas-secure-access-heading"
                        className="font-semibold text-vetneb-ink"
                      >
                        Acceso clínico seguro
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Credenciales separadas del acceso particular por token.
                      </p>
                    </div>
                  </div>
                  <PublicRouteControl
                    href={ROUTES.login}
                    variant="primaryDark"
                    className="public-cta-primary"
                  >
                    Ingresar
                  </PublicRouteControl>
                </div>
              </section>
            </PublicScrollReveal>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}

