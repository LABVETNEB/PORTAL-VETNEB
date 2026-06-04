import type { Metadata } from "next";
import Image from "next/image";
import {
  ClipboardCheck,
  FileText,
  FlaskConical,
  Microscope,
  Network,
  PackageCheck,
} from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";
import {
  PublicExternalControl,
  PublicRouteControl,
} from "@/components/public/PublicRouteControl";
import { VisualIcon } from "@/components/public/VisualAccents";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createPageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = createPageMetadata(
  "Portal VETNEB — Laboratorio Patológico Veterinario",
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
    title: "Diagnóstico histopatológico y citológico",
    description:
      "Evaluación microscópica de tejidos y muestras celulares con criterio anatomopatológico veterinario.",
  },
  {
    icon: FileText,
    tone: "slate" as const,
    title: "Informes digitales con acceso seguro",
    description:
      "Entrega institucional de informes para clínicas y acceso privado por caso cuando corresponde.",
  },
  {
    icon: Network,
    tone: "blue" as const,
    title: "Red de clínicas y profesionales vinculados",
    description:
      "Relación operativa con equipos veterinarios que trabajan con VETNEB para sus diagnósticos.",
  },
  {
    icon: ClipboardCheck,
    tone: "slate" as const,
    title: "Precios públicos y comunicación directa",
    description:
      "Información clara para coordinar muestras, consultas y estudios sin ambigüedad operativa.",
  },
];

const howItWorksSteps = [
  {
    icon: PackageCheck,
    title: "Enviás la muestra",
    description:
      "Preparás la muestra según el protocolo de VETNEB y la enviás con los datos del caso y de la clínica.",
  },
  {
    icon: Microscope,
    title: "VETNEB analiza",
    description:
      "El anatomopatólogo examina el tejido o la muestra citológica y elabora el informe diagnóstico.",
  },
  {
    icon: FileText,
    title: "Recibís el informe",
    description:
      "La clínica lo descarga directamente desde el portal. Si corresponde, el tutor del animal recibe acceso con un código privado.",
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

export default function HomePage() {
  return (
    <PublicLayout>
      {/* Hero */}
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
          className="absolute inset-0 bg-[linear-gradient(110deg,hsl(var(--vetneb-navy)/0.84),hsl(var(--vetneb-navy)/0.66)_45%,hsl(var(--vetneb-teal)/0.42)_100%)]"
          aria-hidden="true"
        />
        <div className="relative container mx-auto flex min-h-[calc(100vh-4.5rem)] items-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid w-full items-center gap-10">
            <div className="max-w-5xl">
              <h1
                id="hero-heading"
                className="mt-2 max-w-none text-[clamp(1.85rem,4.6vw,3.75rem)] font-bold uppercase leading-[0.94] tracking-[0.045em] text-primary-foreground"
              >
                SERVICIO PATOLÓGICO VETNEB
              </h1>
              <p className="mt-6 max-w-2xl text-xl font-medium leading-tight text-primary-foreground/94 md:text-2xl lg:text-3xl">
                Diagnóstico patológico veterinario con criterio clínico y
                trazabilidad integral
              </p>
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-primary-foreground/92 md:text-base">
                Anatomía patológica, citología y tinciones especiales con
                seguimiento continuo para clínicas y profesionales en una
                superficie institucional y confiable.
              </p>
              <p className="mt-4 text-sm font-medium text-primary-foreground/86 md:text-base">
                Dr. BARBÉ, NICOLÁS E.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <PublicRouteControl
                  href={ROUTES.login}
                  variant="primaryDark"
                  className="public-cta-primary w-full sm:w-auto"
                >
                  Acceder a informes y trazabilidad
                </PublicRouteControl>
                <PublicRouteControl
                  href={ROUTES.particulares}
                  variant="secondaryOutline"
                  className="public-cta-on-hero w-full text-vetneb-navy hover:text-vetneb-navy active:text-vetneb-navy focus-visible:text-vetneb-navy sm:w-auto"
                >
                  Consultar informes 24 hs
                </PublicRouteControl>
              </div>

              <div className="clinical-muted-band mt-7 w-fit max-w-full rounded-lg px-4 py-3 text-vetneb-navy">
                <p className="text-sm font-semibold">
                  Consultá los resultados de sus informes las 24 hs.
                </p>
                <p className="mt-1 text-xs text-vetneb-navy/90">
                  Horario de atención Lunes a viernes de 8 a 17hs
                </p>
                <p className="mt-1 text-xs">
                  <PublicExternalControl
                    href="https://wa.me/5493534138946"
                    target="_blank"
                    className="font-semibold underline decoration-vetneb-navy/55 underline-offset-4 transition hover:text-vetneb-teal"
                  >
                    Whatsapp: 3534138946
                  </PublicExternalControl>
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      <div className="public-soft-canvas">
        <section
          className="border-b border-vetneb-line/80 bg-white py-12 md:py-16"
          aria-labelledby="clinical-trust-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal>
              <div className="mx-auto mb-8 max-w-3xl text-center md:mb-10">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-vetneb-teal">
                  Laboratorio primero
                </p>
                <h2
                  id="clinical-trust-heading"
                  className="mt-3 text-3xl font-bold text-vetneb-ink md:text-4xl"
                >
                  Confianza clínica
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
                  Diagnóstico microscópico riguroso para la medicina veterinaria,
                  con portal operativo e información pública como soporte del
                  trabajo clínico.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal staggerChildren>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {clinicalTrustItems.map((item) => {
                  const itemHeadingId = `home-clinical-trust-${item.title.toLowerCase().replace(/\s+/g, "-")}`;

                  return (
                    <article
                      key={item.title}
                      data-scroll-reveal-item
                      aria-labelledby={itemHeadingId}
                      className="h-full rounded-lg border border-vetneb-line/80 bg-card p-5 shadow-sm"
                    >
                      <VisualIcon icon={item.icon} tone={item.tone} className="mb-4" />
                      <h3
                        id={itemHeadingId}
                        className="text-lg font-semibold leading-snug text-vetneb-ink"
                      >
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </article>
                  );
                })}
              </div>
            </PublicScrollReveal>
          </div>
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
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {services.map((service) => {
                  const serviceHeadingId = `home-service-${service.title.toLowerCase().replace(/\s+/g, "-")}`;

                  return (
                    <article
                      key={service.title}
                      data-scroll-reveal-item
                      aria-labelledby={serviceHeadingId}
                    >
                      <Card className="premium-card h-full">
                        <CardHeader>
                          <VisualIcon icon={service.icon} tone={service.tone} className="mb-2" />
                          <CardTitle id={serviceHeadingId} className="text-lg">
                            {service.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <CardDescription className="text-sm leading-relaxed">
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
        </section>

        <section
          className="border-y border-vetneb-line/70 bg-card/72 py-14 md:py-20"
          aria-labelledby="how-it-works-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal>
              <div className="mx-auto mb-10 max-w-2xl text-center">
                <h2
                  id="how-it-works-heading"
                  className="text-3xl font-bold text-vetneb-ink md:text-4xl"
                >
                  Cómo funciona
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
                  Trabajar con VETNEB es simple: la muestra llega al laboratorio,
                  se analiza con criterio anatomopatológico y el informe queda
                  disponible en el portal.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal staggerChildren>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
                {howItWorksSteps.map((step, index) => {
                  const StepIcon = step.icon;
                  const stepHeadingId = `home-how-it-works-step-${index + 1}`;

                  return (
                    <article
                      key={step.title}
                      data-scroll-reveal-item
                      data-home-how-it-works-step
                      aria-labelledby={stepHeadingId}
                      className="h-full rounded-lg border border-vetneb-line/80 bg-card p-5 shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vetneb-navy text-sm font-bold text-primary-foreground"
                          aria-hidden="true"
                        >
                          {index + 1}
                        </span>
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-vetneb-line/80 bg-secondary/60 text-vetneb-teal"
                          aria-hidden="true"
                        >
                          <StepIcon className="h-5 w-5" />
                        </span>
                      </div>
                      <h3
                        id={stepHeadingId}
                        className="mt-5 text-xl font-semibold text-vetneb-ink"
                      >
                        {step.title}
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </article>
                  );
                })}
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal>
              <div className="mt-8 text-center">
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
        </section>

        {/* Beneficios */}
        <section
          className="py-16 md:py-20"
          aria-labelledby="benefits-heading"
        >
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
              <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                {benefits.map((benefit) => {
                  const benefitHeadingId = `home-benefit-${benefit.title.toLowerCase().replace(/\s+/g, "-")}`;

                  return (
                    <article
                      key={benefit.title}
                      data-scroll-reveal-item
                      aria-labelledby={benefitHeadingId}
                    >
                      <Card className="premium-card h-full">
                        <CardHeader>
                          <CardTitle id={benefitHeadingId} className="text-xl">
                            {benefit.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-3">
                            {benefit.items.map((item) => (
                              <li key={item} className="flex items-start gap-3">
                                <span
                                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold"
                                  aria-hidden="true"
                                >
                                  ✓
                                </span>
                                <span className="text-sm text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </article>
                  );
                })}
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        {/* CTA final */}
        <section
          className="bg-vetneb-navy py-16 text-primary-foreground md:py-20"
          aria-labelledby="cta-heading"
        >
          <PublicScrollReveal>
            <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
              <h2
                id="cta-heading"
                className="mx-auto max-w-3xl text-3xl font-bold leading-tight md:text-4xl"
              >
                Empezá a trabajar con VETNEB
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-primary-foreground/78 md:text-lg">
                Conocé los servicios diagnósticos o contactanos para coordinar el
                envío de muestras.
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
        </section>
      </div>
    </PublicLayout>
  );
}
