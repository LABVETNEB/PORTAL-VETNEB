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
import { PerspectiveScrollSection } from "@/components/public/PerspectiveScrollSection";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";
import { VisualIcon } from "@/components/public/VisualAccents";
import { createPageMetadata, getClinicasPageJsonLd } from "@/lib/seo";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = createPageMetadata(
  "Portal para Clínicas Veterinarias",
  "Acceso al portal de gestión para clínicas veterinarias. Informes, seguimiento de estudios, logística y auditoría desde un único lugar.",
  "/clinicas",
);

const featureModules = [
  {
    id: "informes",
    label: "Informes",
    features: [
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
    ],
  },
  {
    id: "operacion",
    label: "Operación",
    features: [
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
    ],
  },
  {
    id: "gestion",
    label: "Gestión",
    features: [
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
    ],
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
        {/* Capacidades del portal agrupadas en 3 módulos de producto */}
        <section
          className="py-16 md:py-20"
          aria-labelledby="clinicas-features-heading"
        >
          <PerspectiveScrollSection intensity="standard">
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
              <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2">
                {featureModules.map((module, moduleIndex) => {
                  const moduleHeadingId = `clinicas-module-${module.id}`;
                  const isLeadModule = moduleIndex === 0;

                  return (
                    <section
                      key={module.id}
                      data-scroll-reveal-item
                      data-clinic-module={module.id}
                      aria-labelledby={moduleHeadingId}
                      className={`premium-card p-6 md:p-7 ${
                        isLeadModule ? "lg:col-span-2" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <h3
                          id={moduleHeadingId}
                          className="text-xs font-semibold uppercase tracking-[0.14em] text-vetneb-teal"
                        >
                          {module.label}
                        </h3>
                        <span
                          className="h-px flex-1 bg-vetneb-line/70"
                          aria-hidden="true"
                        />
                      </div>
                      <div
                        className={
                          isLeadModule
                            ? "mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8"
                            : "mt-5 flex flex-col divide-y divide-vetneb-line/60"
                        }
                      >
                        {module.features.map((feature) => {
                          const featureHeadingId = `clinicas-feature-${feature.title.toLowerCase().replace(/\s+/g, "-")}`;

                          return (
                            <article
                              key={feature.title}
                              aria-labelledby={featureHeadingId}
                              className={
                                isLeadModule ? "" : "py-5 first:pt-0 last:pb-0"
                              }
                            >
                              <VisualIcon
                                icon={feature.icon}
                                tone={feature.tone}
                                className="mb-3"
                              />
                              <h4
                                id={featureHeadingId}
                                className={`font-semibold text-vetneb-ink ${
                                  isLeadModule ? "text-lg" : "text-base"
                                }`}
                              >
                                {feature.title}
                              </h4>
                              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                {feature.description}
                              </p>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </PublicScrollReveal>
          </div>
          </PerspectiveScrollSection>
        </section>

        {/* Cómo opera tu clínica con VETNEB */}
        <section
          className="public-evidence-band-muted public-band-feature"
          aria-labelledby="clinicas-operations-heading"
        >
          <PerspectiveScrollSection intensity="featured">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="section">
              <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
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

            <PublicScrollReveal variant="cards" staggerChildren>
              <ol
                aria-label="Pasos operativos de derivación con VETNEB"
                className="mx-auto grid max-w-6xl grid-cols-1 lg:grid-cols-5"
              >
                {operationSteps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isLastStep = index === operationSteps.length - 1;

                  return (
                    <li
                      key={step.step}
                      data-scroll-reveal-item
                      data-clinic-op-step={step.step}
                      className={`relative flex gap-4 lg:flex-col lg:gap-0 lg:pr-6 lg:last:pr-0 ${
                        isLastStep ? "" : "pb-9 lg:pb-0"
                      }`}
                    >
                      {!isLastStep && (
                        <span
                          className="absolute bottom-0 left-4 top-9 w-px bg-gradient-to-b from-vetneb-teal/38 to-vetneb-line/28 lg:hidden"
                          aria-hidden="true"
                        />
                      )}
                      <div className="flex shrink-0 items-center lg:w-full">
                        <span
                          className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vetneb-navy text-xs font-bold text-primary-foreground shadow-[0_4px_10px_hsl(var(--vetneb-navy)/0.26)] ring-2 ring-vetneb-teal/18"
                          aria-hidden="true"
                        >
                          {String(step.step).padStart(2, "0")}
                        </span>
                        {!isLastStep && (
                          <span
                            className="ml-4 hidden h-px flex-1 bg-gradient-to-r from-vetneb-teal/45 to-vetneb-line/45 lg:-mr-6 lg:block"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <div className="min-w-0 pt-0.5 lg:mt-6 lg:pt-0">
                        <div className="flex items-start gap-2.5">
                          <span
                            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-vetneb-line/65 bg-card/85 text-vetneb-teal"
                            aria-hidden="true"
                          >
                            <StepIcon
                              className="h-4 w-4"
                              strokeWidth={1.9}
                            />
                          </span>
                          <h3 className="text-sm font-semibold leading-snug text-vetneb-ink">
                            {step.title}
                          </h3>
                        </div>
                        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                          {step.detail}
                        </p>
                        {step.tag && (
                          <span className="mt-3 inline-block rounded border border-vetneb-teal/25 bg-vetneb-teal/[0.07] px-2 py-0.5 text-[0.68rem] font-semibold text-vetneb-navy">
                            {step.tag}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </PublicScrollReveal>
          </div>
          </PerspectiveScrollSection>
        </section>

        {/* Cómo comenzar */}
        <section
          className="py-16 md:py-20"
          aria-labelledby="clinicas-onboarding-heading"
        >
          <PerspectiveScrollSection intensity="subtle">
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
              <ol
                aria-label="Pasos para comenzar con Portal VETNEB"
                className="mx-auto grid max-w-5xl grid-cols-1 lg:grid-cols-4 lg:gap-x-6"
              >
                {onboardingSteps.map((step, index) => {
                  const isLastStep = index === onboardingSteps.length - 1;

                  return (
                    <li
                      key={step.number}
                      data-scroll-reveal-item
                      data-clinic-onboarding-step={step.number}
                      aria-labelledby={`clinicas-step-${step.number}`}
                      className={`relative flex gap-4 lg:flex-col lg:gap-0 ${
                        isLastStep ? "" : "pb-9 lg:pb-0"
                      }`}
                    >
                      {!isLastStep && (
                        <span
                          className="absolute bottom-0 left-4 top-9 w-px bg-gradient-to-b from-vetneb-teal/38 to-vetneb-line/28 lg:hidden"
                          aria-hidden="true"
                        />
                      )}
                      <div className="flex shrink-0 items-center lg:mb-4 lg:w-full">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-vetneb-teal/35 bg-vetneb-teal/10 text-xs font-semibold tracking-[0.08em] text-vetneb-navy"
                          aria-hidden="true"
                        >
                          {step.number}
                        </span>
                        {!isLastStep && (
                          <span
                            className="ml-4 hidden h-px flex-1 bg-vetneb-line/70 lg:-mr-6 lg:block"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <div className="min-w-0 pt-0.5 lg:pt-0">
                        <h3
                          id={`clinicas-step-${step.number}`}
                          className="font-semibold text-vetneb-ink"
                        >
                          {step.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
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
          </PerspectiveScrollSection>
        </section>
      </div>

      {/* CTA para clínicas */}
      <section
        className="bg-vetneb-navy py-12 text-primary-foreground md:py-16"
        aria-labelledby="clinicas-conversion-heading"
      >
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <PerspectiveScrollSection intensity="subtle">
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
          </PerspectiveScrollSection>
        </div>
      </section>
    </PublicLayout>
  );
}
