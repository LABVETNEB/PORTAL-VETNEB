import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Microscope,
  Network,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { PerspectiveScrollSection } from "@/components/public/PerspectiveScrollSection";
import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";
import {
  PublicExternalControl,
  PublicRouteControl,
} from "@/components/public/PublicRouteControl";
import { VisualIcon } from "@/components/public/VisualAccents";
import { SpecimenJourneySection } from "@/components/public/SpecimenJourneySection";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createPageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = createPageMetadata(
  "Laboratorio Patológico Veterinario — Histopatología, Citología y Hematología",
  "La anatomía patológica veterinaria estudia los motivos, el desarrollo y las consecuencias de distintas enfermedades mediante el análisis de tejidos, órganos y muestras celulares. VETNEB integra histopatología, citología, citopatología, hematología, diagnóstico hematológico y hemoparásitos.",
  "/",
);

const services = [
  {
    icon: Microscope,
    tone: "blue" as const,
    title: "Estudio Anatomopatológico",
    description:
      "Estudio anatomopatológico de todo tipo de tejidos para caracterizar lesiones y aportar precisión diagnóstica en medicina veterinaria.",
  },
  {
    icon: FlaskConical,
    tone: "emerald" as const,
    title: "Estudio Citológico",
    description:
      "Estudio citológico de muestras, líquidos y punciones para evaluar alteraciones celulares con criterio clínico-patológico.",
  },
  {
    icon: ClipboardCheck,
    tone: "amber" as const,
    title: "Tinciones Especiales",
    description:
      "Estudios aplicados con tinciones especiales para ampliar hallazgos histológicos y reforzar diagnósticos diferenciales.",
  },
  {
    icon: Network,
    tone: "slate" as const,
    title: "Diagnóstico Integral",
    description:
      "Integración de datos clínicos con evaluación histológica y citológica para orientar decisiones diagnósticas y terapéuticas.",
  },
];

const clinicalTrustItems = [
  {
    icon: Microscope,
    tone: "blue" as const,
    title: "Anatomía patológica veterinaria",
    description: "Diagnóstico histopatológico y citológico como servicio central.",
  },
  {
    icon: ShieldCheck,
    tone: "slate" as const,
    title: "Informes con acceso seguro",
    description:
      "Entrega directa a clínicas y acceso privado por token para tutores.",
  },
  {
    icon: Network,
    tone: "blue" as const,
    title: "Red profesional verificada",
    description: "Clínicas y profesionales confirmados por el laboratorio.",
  },
  {
    icon: PackageCheck,
    tone: "slate" as const,
    title: "Flujo operativo claro",
    description:
      "Envío de muestra, análisis anatomopatológico e informe descargable.",
  },
];

const benefits = [
  {
    title: "Diagnóstico integral",
    items: [
      "Integramos hallazgos de tejidos y células con la información clínica de cada caso",
      "Articulamos el análisis con equipos de diagnóstico por imágenes y áreas quirúrgicas",
      "Priorizamos un diagnóstico específico para cada paciente veterinario",
      "Acompañamos la toma de decisiones terapéuticas con criterios anatomopatológicos",
    ],
  },
  {
    title: "Para tener en cuenta",
    items: [
      "Los tiempos pueden variar según la complejidad diagnóstica de cada muestra",
      "El análisis no es automatizado: requiere evaluación microscópica especializada",
      "En algunos casos se requieren tinciones especiales o interconsultas profesionales",
      "Seguimos trabajando en mejorar los tiempos de recepción, diagnóstico y entrega",
    ],
  },
];

const specimenJourneyStages = [
  {
    step: 1,
    icon: FlaskConical,
    title: "Toma y fijación",
    detail: "La muestra se incorpora inmediatamente en formol al 10%. Especímenes grandes requieren cortes para mejor permeabilidad.",
    protocol: "Fijación 48–72 h recomendada",
  },
  {
    step: 2,
    icon: PackageCheck,
    title: "Envío coordinado",
    detail: "La muestra fijada se envía en bolsa tipo ziploc, con los datos del caso y de la clínica. El envío debe coordinarse previamente vía Web o WhatsApp.",
    protocol: "Coordinar antes del despacho",
  },
  {
    step: 3,
    icon: ClipboardCheck,
    title: "Recepción y procesamiento",
    detail: "Identificación de la muestra, inclusión histológica y preparación de cortes para evaluación microscópica.",
  },
  {
    step: 4,
    icon: Microscope,
    title: "Evaluación diagnóstica",
    detail: "El médico veterinario patólogo examina el tejido o la muestra citológica e integra los datos clínicos del caso.",
  },
  {
    step: 5,
    icon: FileText,
    title: "Informe digital y acceso",
    detail: "El informe diagnóstico queda disponible en el portal para la clínica. El tutor del animal puede acceder con código privado.",
    protocol: "Hasta 15 días hábiles desde recepción",
  },
];

export default function HomePage() {
  return (
    <PublicLayout>
      {/* Hero — evidence-first */}
      <section
        className="relative isolate overflow-hidden text-white"
        aria-labelledby="hero-heading"
      >
        <div className="absolute inset-0">
          <Image
            src="/images/hero-microscope-vetneb.webp"
            alt="Microscopio en laboratorio patológico veterinario"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>
        <div
          className="absolute inset-0 bg-[linear-gradient(110deg,hsl(var(--vetneb-navy)/0.90),hsl(var(--vetneb-navy)/0.74)_45%,hsl(var(--vetneb-teal)/0.50)_100%)]"
          aria-hidden="true"
        />
        <div className="relative container mx-auto px-4 py-12 sm:py-14 sm:px-6 md:py-16 lg:py-20 lg:px-8">
          <div>
            <div>
              <h1
                id="hero-heading"
                className="text-[clamp(4rem,10vw,8rem)] font-black uppercase tracking-[0.06em] leading-none text-primary-foreground"
              >
                VETNEB
              </h1>

              <p className="mt-4 max-w-2xl text-lg font-semibold leading-snug text-primary-foreground/85 sm:text-xl">
                Diagnóstico anatomopatológico veterinario con trazabilidad de informes
              </p>

              {/* Firma profesional */}
              <div className="mt-5 flex w-fit items-center gap-3 rounded-lg border border-white/22 bg-white/[0.08] px-4 py-2.5">
                <Microscope className="h-5 w-5 shrink-0 text-primary-foreground/72" aria-hidden="true" />
                <div>
                  <p className="text-sm font-bold leading-tight text-primary-foreground">
                    Dr. Nicolás E. Barbé
                  </p>
                  <p className="text-xs text-primary-foreground/72">
                    Médico veterinario patólogo · Responsable de diagnóstico
                  </p>
                </div>
              </div>

              {/* CTAs — action tiles */}
              <div className="public-hero-action-grid">
                <PublicRouteControl
                  href={ROUTES.login}
                  variant="bare"
                  className="public-hero-action-tile"
                >
                  <p className="public-hero-action-tile-label">Portal de informes</p>
                  <div className="public-hero-action-tile-title">
                    Acceder al portal
                    <ArrowRight className="public-hero-action-tile-arrow h-4 w-4" aria-hidden="true" />
                  </div>
                  <p className="public-hero-action-tile-copy">
                    Para clínicas y profesionales con acceso a VETNEB.
                  </p>
                </PublicRouteControl>

                <PublicRouteControl
                  href={ROUTES.particulares}
                  variant="bare"
                  className="public-hero-action-tile"
                >
                  <p className="public-hero-action-tile-label">Particulares</p>
                  <div className="public-hero-action-tile-title">
                    Seguir con código
                    <ArrowRight className="public-hero-action-tile-arrow h-4 w-4" aria-hidden="true" />
                  </div>
                  <p className="public-hero-action-tile-copy">
                    Consultá el estado de tu muestra las 24 h con tu código privado.
                  </p>
                </PublicRouteControl>
              </div>

              {/* Información operativa integrada al hero */}
              <div className="mt-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-5">
                <p className="text-sm text-primary-foreground/68">
                  Resultados disponibles las 24 hs · Atención de lunes a viernes de 8 a 17 h
                </p>
                <PublicExternalControl
                  href="https://wa.me/5493534138946"
                  target="_blank"
                  className="text-sm text-primary-foreground/68 underline underline-offset-4 transition hover:text-primary-foreground/90"
                >
                  WhatsApp: 3534138946
                </PublicExternalControl>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="public-soft-canvas">
        <section
          className="public-evidence-band-light py-12 md:py-16"
          aria-labelledby="clinical-trust-heading"
        >
          <PerspectiveScrollSection intensity="standard">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal>
              <div className="mx-auto mb-8 max-w-3xl text-center md:mb-10">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-vetneb-teal">
                  Confianza clínica
                </p>
                <h2
                  id="clinical-trust-heading"
                  className="mt-3 text-3xl font-bold text-vetneb-ink md:text-4xl"
                >
                  Diagnóstico microscópico riguroso para la medicina veterinaria
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
                  Una plataforma operativa al servicio del laboratorio: estudios
                  histopatológicos y citológicos, informes seguros y una red de
                  clínicas verificadas.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal staggerChildren>
              <div className="grid grid-cols-1 divide-y divide-vetneb-line/70 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
                {clinicalTrustItems.map((item) => {
                  const itemHeadingId = `home-clinical-trust-${item.title.toLowerCase().replace(/\s+/g, "-")}`;

                  return (
                    <article
                      key={item.title}
                      data-scroll-reveal-item
                      aria-labelledby={itemHeadingId}
                      className="flex items-start gap-4 py-5 first:pt-0 last:pb-0 lg:px-6 lg:py-1.5 lg:first:pl-0 lg:last:pr-0"
                    >
                      <VisualIcon
                        icon={item.icon}
                        tone={item.tone}
                        className="h-10 w-10 shrink-0"
                      />
                      <div>
                        <h3
                          id={itemHeadingId}
                          className="text-base font-semibold leading-snug text-vetneb-ink"
                        >
                          {item.title}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </PublicScrollReveal>
          </div>
          </PerspectiveScrollSection>
        </section>

        <section
          className="border-b border-vetneb-line/80 bg-card/72 py-8 md:py-10 lg:hidden"
          aria-labelledby="mobile-professionals-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6">
              <div>
                <h2
                  id="mobile-professionals-heading"
                  className="text-2xl font-bold text-vetneb-ink md:text-3xl"
                >
                  Red de profesionales veterinarios
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                  Buscá profesionales vinculados a VETNEB para derivaciones,
                  interconsultas y coordinación clínica.
                </p>
              </div>
              <PublicRouteControl
                href={ROUTES.profesionales}
                variant="primaryDark"
                className="public-cta-primary w-full sm:w-auto"
              >
                Buscar profesionales
              </PublicRouteControl>
            </div>
          </div>
        </section>

        {/* Servicios principales */}
        <section
          className="py-16 md:py-20"
          aria-labelledby="services-heading"
        >
          <PerspectiveScrollSection intensity="standard">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal>
              <div className="text-center mb-12">
                <h2
                  id="services-heading"
                  className="text-3xl font-bold text-vetneb-ink md:text-4xl mb-4"
                >
                  Servicios del laboratorio patológico veterinario
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Cobertura diagnóstica con estudio anatomopatológico, citología,
                  tinciones especiales e integración clínico-patológica para
                  sostener decisiones con mayor confianza.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal staggerChildren>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => {
                  const serviceHeadingId = `home-service-${service.title.toLowerCase().replace(/\s+/g, "-")}`;
                  const isFeatured = service.title === "Estudio Anatomopatológico";
                  const isWide = service.title === "Diagnóstico Integral";

                  return (
                    <article
                      key={service.title}
                      data-scroll-reveal-item
                      aria-labelledby={serviceHeadingId}
                      className={cn(
                        isFeatured && "lg:col-span-2",
                        isWide && "lg:col-span-2",
                      )}
                    >
                      <Card
                        className={cn(
                          "h-full",
                          isFeatured
                            ? "premium-card"
                            : "border-vetneb-line/75 bg-card/85 shadow-none",
                        )}
                      >
                        <CardHeader className={cn(isFeatured && "lg:p-8 lg:pb-4")}>
                          <VisualIcon
                            icon={service.icon}
                            tone={service.tone}
                            className={cn("mb-2", !isFeatured && "h-10 w-10")}
                          />
                          {isFeatured && (
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-vetneb-teal">
                              Servicio principal
                            </p>
                          )}
                          <CardTitle id={serviceHeadingId} className={cn("text-lg", isFeatured && "lg:text-2xl")}>
                            {service.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className={cn(isFeatured && "lg:px-8 lg:pb-8")}>
                          <CardDescription
                            className={cn(
                              "text-sm leading-relaxed",
                              isFeatured && "lg:max-w-2xl lg:text-base",
                            )}
                          >
                            {service.description}
                          </CardDescription>
                        </CardContent>
                      </Card>
                    </article>
                  );
                })}
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal>
              <div className="mt-10 text-center">
                <PublicRouteControl
                  href={ROUTES.servicios}
                  variant="secondaryOutline"
                  className="border-vetneb-line/80 bg-transparent text-vetneb-ink hover:bg-accent/60 hover:border-vetneb-teal/45"
                >
                  Ver todos los servicios
                </PublicRouteControl>
              </div>
            </PublicScrollReveal>
          </div>
          </PerspectiveScrollSection>
        </section>

        {/* Recorrido end-to-end — de la muestra al informe */}
        <section
          className="public-evidence-band-muted public-band-feature"
          aria-labelledby="specimen-journey-heading"
        >
          <PerspectiveScrollSection intensity="standard">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal>
              <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-vetneb-teal">
                  Cómo funciona
                </p>
                <h2
                  id="specimen-journey-heading"
                  className="mt-3 text-3xl font-bold text-vetneb-ink md:text-4xl"
                >
                  Recorrido de la muestra
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
                  Trabajar con VETNEB es simple: desde el envío de la muestra
                  hasta la entrega del informe, el flujo está pensado para
                  clínicas y profesionales veterinarios.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
                  Cada etapa del proceso sigue el protocolo del laboratorio para
                  asegurar la trazabilidad del diagnóstico.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal>
              <SpecimenJourneySection
                stages={specimenJourneyStages}
                variant="timeline"
              />
            </PublicScrollReveal>

            <PublicScrollReveal>
              <div className="mt-10 text-center md:mt-12">
                <PublicRouteControl
                  href={ROUTES.contacto}
                  variant="primaryDark"
                  className="public-cta-primary w-full sm:w-auto"
                >
                  Contactanos para empezar
                </PublicRouteControl>
              </div>
            </PublicScrollReveal>
          </div>
          </PerspectiveScrollSection>
        </section>

        {/* Beneficios */}
        <section
          className="public-evidence-band-light py-16 md:py-20"
          aria-labelledby="benefits-heading"
        >
          <PerspectiveScrollSection intensity="subtle">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal>
              <div className="text-center mb-12">
                <h2
                  id="benefits-heading"
                  className="text-3xl md:text-4xl font-bold text-vetneb-ink mb-4"
                >
                  Trabajo interdisciplinario y criterio diagnóstico
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Colaboramos de forma permanente con equipos clínicos para evaluar
                  lesiones, integrar contexto médico y reforzar la confianza
                  diagnóstica antes de definir conductas de tratamiento.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal staggerChildren>
              <div className="mx-auto grid max-w-5xl grid-cols-1 lg:grid-cols-2">
                {benefits.map((benefit, benefitIndex) => {
                  const benefitHeadingId = `home-benefit-${benefit.title.toLowerCase().replace(/\s+/g, "-")}`;
                  const isPrimaryBenefit = benefitIndex === 0;

                  return (
                    <article
                      key={benefit.title}
                      data-scroll-reveal-item
                      aria-labelledby={benefitHeadingId}
                      className={cn(
                        isPrimaryBenefit
                          ? "pb-10 lg:pb-0 lg:pr-12"
                          : "border-t border-vetneb-line/70 pt-10 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0",
                      )}
                    >
                      <h3
                        id={benefitHeadingId}
                        className={cn(
                          "font-bold text-vetneb-ink",
                          isPrimaryBenefit ? "text-2xl" : "text-xl",
                        )}
                      >
                        {benefit.title}
                      </h3>
                      <ul className="mt-6 space-y-3.5">
                        {benefit.items.map((item) => (
                          <li key={item} className="flex items-start gap-3">
                            {isPrimaryBenefit ? (
                              <span
                                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold"
                                aria-hidden="true"
                              >
                                ✓
                              </span>
                            ) : (
                              <span
                                className="mt-[0.65rem] h-px w-4 shrink-0 bg-vetneb-teal/70"
                                aria-hidden="true"
                              />
                            )}
                            <span className="text-sm leading-relaxed text-muted-foreground">
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  );
                })}
              </div>
            </PublicScrollReveal>
          </div>
          </PerspectiveScrollSection>
        </section>

        {/* CTA final */}
        <section
          className="relative isolate overflow-hidden bg-vetneb-navy py-16 text-primary-foreground md:py-20"
          aria-labelledby="cta-heading"
        >
          <div className="diagnostic-field" data-tone="dark" aria-hidden="true" />
          <PerspectiveScrollSection intensity="subtle">
          <PublicScrollReveal>
            <div className="container relative z-10 mx-auto px-4 text-center sm:px-6 lg:px-8">
              <h2
                id="cta-heading"
                className="mx-auto max-w-3xl text-3xl font-bold leading-tight md:text-4xl"
              >
                Empezá a trabajar con VETNEB
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-primary-foreground/78 md:text-lg">
                Sumá a tu clínica a un flujo de diagnóstico anatomopatológico
                claro, seguro y pensado para la operación veterinaria.
              </p>
              <div className="mt-8">
                <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
                  <PublicRouteControl
                    href={ROUTES.contacto}
                    variant="primaryLight"
                    className="public-cta-outline w-full sm:w-auto"
                  >
                    Contactanos
                  </PublicRouteControl>
                  <PublicRouteControl
                    href={ROUTES.servicios}
                    variant="secondaryOutline"
                    className="w-full border-white/55 bg-white/10 text-primary-foreground shadow-none hover:border-white/75 hover:bg-white/16 hover:text-primary-foreground active:text-primary-foreground focus-visible:text-primary-foreground sm:w-auto"
                  >
                    Ver servicios
                  </PublicRouteControl>
                </div>
              </div>
            </div>
          </PublicScrollReveal>
          </PerspectiveScrollSection>
        </section>
      </div>
    </PublicLayout>
  );
}
