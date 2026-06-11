import type { Metadata } from "next";
import {
  ArrowRight,
  ClipboardCheck,
  FileText,
  Globe2,
  Microscope,
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
import { ClinicOperationsSection } from "@/components/public/ClinicOperationsSection";
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
      "Los informes diagnósticos de cada estudio están disponibles en el portal de la clínica, con notificación cuando están listos.",
  },
  {
    icon: Search,
    tone: "emerald" as const,
    title: "Búsqueda avanzada",
    description:
      "Encontrá informes por paciente, tipo de estudio, fecha o estado. Filtros orientados a la operación diaria de alto volumen.",
  },
  {
    icon: Truck,
    tone: "amber" as const,
    title: "Seguimiento de logística",
    description:
      "Consultá el estado de las muestras derivadas y las visitas coordinadas con tu clínica. Trazabilidad en cada etapa.",
  },
  {
    icon: ShieldCheck,
    tone: "blue" as const,
    title: "Acceso seguro y auditado",
    description:
      "Cada acceso a informes queda registrado. Control sobre quién accede a qué información y cuándo.",
  },
  {
    icon: UsersRound,
    tone: "slate" as const,
    title: "Gestión de usuarios",
    description:
      "Administrá los usuarios de tu clínica con roles diferenciados: propietario y personal de clínica.",
  },
  {
    icon: Globe2,
    tone: "emerald" as const,
    title: "Perfil público",
    description:
      "Mantené actualizado el perfil público de tu clínica en el directorio de Portal VETNEB.",
  },
];

const operationSteps = [
  {
    step: 1,
    icon: UsersRound,
    title: "Coordinás la derivación",
    detail:
      "Acordás con el equipo VETNEB el tipo de estudio y los datos básicos del caso antes del envío.",
    tag: "Coordinación previa",
  },
  {
    step: 2,
    icon: Truck,
    title: "Enviás la muestra con los datos del caso",
    detail:
      "El material se remite fijado según el protocolo del laboratorio, con los datos identificatorios del caso.",
    tag: "Envío coordinado",
  },
  {
    step: 3,
    icon: ClipboardCheck,
    title: "VETNEB registra la recepción",
    detail:
      "Al ingresar al laboratorio, la muestra queda registrada y asignada bajo un código de caso. El estado puede consultarse desde el portal.",
    tag: "Trazabilidad",
  },
  {
    step: 4,
    icon: Microscope,
    title: "Procesamos y evaluamos el material",
    detail:
      "El médico veterinario patólogo examina el tejido o la muestra citológica e integra los datos clínicos para emitir el diagnóstico.",
    tag: "Evaluación profesional",
  },
  {
    step: 5,
    icon: FileText,
    title: "Tu clínica recibe el informe digital",
    detail:
      "El informe diagnóstico queda disponible en el portal de la clínica. Acceso directo, trazable y disponible las 24 hs.",
    tag: "Informe en portal",
  },
];

const onboardingSteps = [
  {
    number: "01",
    title: "Solicitar acceso",
    description:
      "Completá el formulario de contacto para registrar tu clínica en Portal VETNEB.",
  },
  {
    number: "02",
    title: "Configurar la cuenta",
    description:
      "Recibí tus credenciales y configurá los usuarios de tu equipo con los roles apropiados.",
  },
  {
    number: "03",
    title: "Acceder a los informes",
    description:
      "Desde el dashboard privado, accedé a todos los informes y estudios de tu clínica.",
  },
  {
    number: "04",
    title: "Gestionar la operación",
    description:
      "Usá las herramientas de seguimiento, logística y auditoría para optimizar tu práctica.",
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
            Coordinación de derivaciones, trazabilidad de muestras e informes
            diagnósticos digitales. Un portal operativo para clínicas veterinarias
            que trabajan con VETNEB.
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
        {/* Capacidades del portal */}
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
                          <CardTitle
                            id={featureHeadingId}
                            className="text-lg text-vetneb-ink"
                          >
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

        {/* Cómo opera tu clínica con VETNEB */}
        <section
          className="border-t border-vetneb-line/70 py-16 md:py-20"
          aria-labelledby="clinicas-operations-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="section">
              <div className="mx-auto mb-10 max-w-3xl text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-vetneb-teal">
                  Flujo operativo
                </p>
                <h2
                  id="clinicas-operations-heading"
                  className="mt-3 text-2xl font-bold text-vetneb-ink md:text-3xl"
                >
                  Cómo opera tu clínica con VETNEB
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Un proceso claro desde la coordinación de la derivación hasta la
                  entrega del informe diagnóstico digital. Sin fricciones, con
                  trazabilidad en cada etapa.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal variant="minimal">
              <div className="mx-auto max-w-2xl rounded-xl border border-vetneb-line/70 bg-card/72 p-6 shadow-sm md:p-8">
                <ClinicOperationsSection steps={operationSteps} />
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        {/* Cómo comenzar */}
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
                {onboardingSteps.map((step) => (
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

      {/* CTA de conversión B2B */}
      <section
        className="bg-vetneb-navy py-12 text-primary-foreground md:py-16"
        aria-labelledby="clinicas-conversion-heading"
      >
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <PublicScrollReveal variant="section">
            <h2
              id="clinicas-conversion-heading"
              className="text-2xl font-bold md:text-3xl"
            >
              Sumá tu clínica a VETNEB
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-primary-foreground/80">
              Coordiná derivaciones, seguí el estado de los estudios y accedé a los
              informes desde tu portal. Consultanos para gestionar el alta de tu
              clínica.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PublicRouteControl
                href={ROUTES.contacto}
                variant="primaryLight"
                className="public-cta-outline w-full sm:w-auto"
              >
                Coordiná una derivación
              </PublicRouteControl>
              <PublicRouteControl
                href={ROUTES.contacto}
                variant="secondaryOutline"
                className="w-full border-white/55 bg-white/10 text-primary-foreground shadow-none hover:border-white/75 hover:bg-white/16 hover:text-primary-foreground active:text-primary-foreground focus-visible:text-primary-foreground sm:w-auto"
              >
                Consultar alta de clínica
              </PublicRouteControl>
            </div>
          </PublicScrollReveal>
        </div>
      </section>
    </PublicLayout>
  );
}
