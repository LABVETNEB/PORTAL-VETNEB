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
import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";
import {
  PublicExternalControl,
  PublicRouteControl,
} from "@/components/public/PublicRouteControl";
import { VisualIcon } from "@/components/public/VisualAccents";
import { SpecimenJourneySection } from "@/components/public/SpecimenJourneySection";
import { ReportPreviewCard } from "@/components/public/ReportPreviewCard";
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
    detail: "La muestra fijada se envía en bolsa tipo ziploc. El envío debe coordinarse previamente vía Web o WhatsApp.",
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
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">

            {/* Columna izquierda — copy, firma y CTAs */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary-foreground/72">
                Anatomía Patológica Veterinaria
              </p>

              <h1
                id="hero-heading"
                className="max-w-2xl text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.06] tracking-[-0.01em] text-primary-foreground"
              >
                Diagnóstico anatomopatológico veterinario con trazabilidad de muestra a informe
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-primary-foreground/88 sm:text-lg">
                Histopatología, citología y tinciones especiales con criterio clínico-patológico
                y seguimiento completo para clínicas y profesionales.
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
            </div>

            {/* Columna derecha — mock de informe + mini timeline (solo lg+) */}
            <div className="hidden lg:flex lg:flex-col lg:gap-4" aria-hidden="true">

              {/* Mock de informe — 100% ficticio, rotulado MUESTRA / DEMOSTRATIVO */}
              <div className="overflow-hidden rounded-xl border border-white/18 bg-white/[0.07] backdrop-blur-sm">
                <div className="flex items-center gap-2 border-b border-white/14 bg-amber-400/20 px-4 py-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200">⚠</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/90">
                    Muestra · Demostrativo — No es un informe real
                  </span>
                </div>
                <div className="space-y-3 px-4 py-3">
                  <div className="border-b border-white/12 pb-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary-foreground/90">
                      Informe Anatomopatológico
                    </p>
                    <p className="mt-0.5 text-[10px] text-primary-foreground/56">
                      N° VT-0000-000 · Canino · Biopsia incisional
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.10em] text-primary-foreground/50">
                      Diagnóstico
                    </p>
                    <p className="mt-0.5 text-xs font-semibold leading-snug text-primary-foreground/90">
                      Mastocitoma de grado II (Patnaik)
                    </p>
                    <p className="text-[10px] text-primary-foreground/60">
                      Margen libre — ≥ 3 mm
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.10em] text-primary-foreground/50">
                      Hallazgos microscópicos
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-primary-foreground/66">
                      Proliferación de mastocitos con granulación moderada. Sin figuras mitóticas.
                      Estroma fibrovascular leve.
                    </p>
                  </div>
                  <div className="border-t border-white/12 pt-2">
                    <p className="text-[10px] font-semibold text-primary-foreground/80">
                      Dr. N. E. Barbé · MV Patólogo
                    </p>
                    <p className="text-[9px] text-primary-foreground/44">
                      VETNEB Laboratorio Patológico Veterinario
                    </p>
                  </div>
                </div>
              </div>

              {/* Mini timeline de etapas */}
              <div className="rounded-xl border border-white/14 bg-white/[0.05] px-4 py-3">
                <p className="mb-2.5 text-[9px] font-semibold uppercase tracking-[0.20em] text-primary-foreground/50">
                  Flujo de diagnóstico
                </p>
                <ol className="space-y-2.5">
                  {([
                    { step: "Recepción", desc: "Muestra recibida e identificada" },
                    { step: "Procesamiento", desc: "Fijación, inclusión y corte histológico" },
                    { step: "Evaluación", desc: "Microscopía e interpretación patológica" },
                    { step: "Informe emitido", desc: "Diagnóstico disponible en el portal" },
                  ] as const).map((item, i) => (
                    <li key={item.step} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/18 text-[9px] font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-primary-foreground/88">{item.step}</p>
                        <p className="text-[10px] leading-tight text-primary-foreground/58">{item.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Banda utilitaria compacta — fuera del hero */}
      <div className="border-b border-vetneb-line/70 bg-vetneb-surface-muted/60 py-2.5 sm:py-3">
        <div className="container mx-auto flex flex-col gap-1.5 px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-vetneb-navy">
            Resultados disponibles las 24 hs · Atención de lunes a viernes de 8 a 17 h
          </p>
          <PublicExternalControl
            href="https://wa.me/5493534138946"
            target="_blank"
            className="text-sm font-semibold text-vetneb-navy underline decoration-vetneb-navy/55 underline-offset-4 transition hover:text-vetneb-teal"
          >
            WhatsApp: 3534138946
          </PublicExternalControl>
        </div>
      </div>

      <div className="public-soft-canvas">
        <section
          className="border-b border-vetneb-line/80 bg-gradient-to-b from-white via-white to-vetneb-surface/40 py-12 md:py-16"
          aria-labelledby="clinical-trust-heading"
        >
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
                      <Card className="premium-card h-full">
                        <CardHeader>
                          <VisualIcon icon={service.icon} tone={service.tone} className="mb-2" />
                          {isFeatured && (
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-vetneb-teal">
                              Servicio principal
                            </p>
                          )}
                          <CardTitle id={serviceHeadingId} className={cn("text-lg", isFeatured && "lg:text-xl")}>
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
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-vetneb-teal">
                  Cómo funciona
                </p>
                <h2
                  id="how-it-works-heading"
                  className="mt-3 text-3xl font-bold text-vetneb-ink md:text-4xl"
                >
                  Trabajar con VETNEB es simple
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
                  Desde el envío de la muestra hasta la entrega del informe, el
                  flujo está pensado para clínicas y profesionales veterinarios.
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
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vetneb-navy text-sm font-bold text-primary-foreground shadow-[0_6px_16px_hsl(var(--vetneb-navy)/0.22)] ring-2 ring-primary/20"
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

        {/* Specimen Journey */}
        <section
          className="py-14 md:py-20"
          aria-labelledby="specimen-journey-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal>
              <div className="mx-auto mb-10 max-w-3xl text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-vetneb-teal">
                  Trazabilidad
                </p>
                <h2
                  id="specimen-journey-heading"
                  className="mt-3 text-3xl font-bold text-vetneb-ink md:text-4xl"
                >
                  Recorrido de la muestra
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
                  Desde la toma hasta el informe digital, cada etapa del proceso
                  sigue el protocolo del laboratorio para asegurar la trazabilidad
                  del diagnóstico.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal>
              <div className="rounded-xl border border-vetneb-line/70 bg-card/72 p-6 shadow-sm md:p-8">
                <SpecimenJourneySection
                  stages={specimenJourneyStages}
                />
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        {/* Informe diagnóstico — preview demostrativo */}
        <section
          className="border-y border-vetneb-line/70 bg-gradient-to-b from-vetneb-surface-muted/30 to-white py-14 md:py-20"
          aria-labelledby="report-preview-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal>
              <div className="mx-auto mb-10 max-w-3xl text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-vetneb-teal">
                  El entregable
                </p>
                <h2
                  id="report-preview-heading"
                  className="mt-3 text-3xl font-bold text-vetneb-ink md:text-4xl"
                >
                  Así se entrega la evidencia diagnóstica
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
                  Del material recibido al diagnóstico, con trazabilidad y acceso digital.
                  Conocé cómo se estructura un informe demostrativo.
                </p>
                <p className="mt-2 text-sm text-muted-foreground/70">
                  Ejemplo visual sin datos reales — los datos del paciente, clínica y tutor
                  son ficticios.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal>
              <div className="mx-auto max-w-2xl">
                <ReportPreviewCard />
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
          className="relative isolate overflow-hidden bg-vetneb-navy py-16 text-primary-foreground md:py-20"
          aria-labelledby="cta-heading"
        >
          <div className="diagnostic-field" data-tone="dark" aria-hidden="true" />
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
        </section>
      </div>
    </PublicLayout>
  );
}
