import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  FlaskConical,
  Microscope,
  MonitorCheck,
  Network,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VisualIcon } from "@/components/public/VisualAccents";
import { createPageMetadata, getServicesJsonLd } from "@/lib/seo";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = createPageMetadata(
  "Servicio Patológico Veterinario: Histopatología, Citología y Hematología",
  "La anatomía patológica veterinaria integra estudio anatomopatológico, citológico y tinciones especiales para un diagnóstico integral con criterio clínico-patológico.",
  "/servicios",
);

const serviceCategories = [
  {
    id: "anatomopatologia",
    title: "Estudio anatomopatológico de tejidos",
    icon: Microscope,
    tone: "blue" as const,
    href: "/histopatologia-veterinaria",
    linkLabel: "Ver histopatología veterinaria",
    description:
      "Evaluación de tejidos y órganos para estudiar motivos, desarrollo y consecuencias de enfermedades en pacientes veterinarios.",
    features: [
      "Recepción y procesamiento de muestras de tejidos",
      "Evaluación microscópica de lesiones histológicas",
      "Correlación anatomopatológica del caso clínico",
      "Informe diagnóstico con hallazgos relevantes",
      "Apoyo para decisiones terapéuticas",
      "Seguimiento del caso con el equipo tratante",
    ],
  },
  {
    id: "citologia",
    title: "Estudio citológico de muestras",
    icon: FlaskConical,
    tone: "emerald" as const,
    href: "/citologia-veterinaria",
    linkLabel: "Ver citología veterinaria",
    description:
      "Análisis citológico de líquidos y punciones para valorar alteraciones celulares con un enfoque clínico-patológico.",
    features: [
      "Estudio citológico de líquidos y punciones",
      "Valoración celular orientada a diagnóstico",
      "Identificación de patrones inflamatorios y proliferativos",
      "Apoyo diagnóstico en lesiones de tejidos blandos",
      "Integración con antecedentes clínicos del paciente",
      "Informe citológico con conclusión profesional",
    ],
  },
  {
    id: "tinciones",
    title: "Tinciones especiales aplicadas",
    icon: Sparkles,
    tone: "amber" as const,
    href: "/laboratorio-patologico-veterinario",
    linkLabel: "Ver laboratorio patológico veterinario",
    description:
      "Aplicación de tinciones especiales para ampliar hallazgos histológicos y reforzar diagnósticos diferenciales.",
    features: [
      "Selección de técnicas según complejidad del caso",
      "Caracterización adicional de lesiones tisulares",
      "Soporte para diagnósticos diferenciales",
      "Complemento de histopatología y citopatología",
      "Mayor precisión frente a hallazgos complejos",
      "Registro diagnóstico trazable",
    ],
  },
  {
    id: "integral",
    title: "Diagnóstico integral interdisciplinario",
    icon: Network,
    tone: "slate" as const,
    href: "/laboratorio-patologico-veterinario",
    linkLabel: "Ver laboratorio patológico veterinario",
    description:
      "Integración del análisis histológico y citológico con información clínica para construir un diagnóstico específico por paciente.",
    features: [
      "Integración de análisis histológico y citológico",
      "Trabajo conjunto con diagnóstico por imágenes",
      "Articulación con cirugía y clínica veterinaria",
      "Interconsulta profesional cuando el caso lo requiere",
      "Definición diagnóstica específica por paciente",
      "Orientación para tratamiento personalizado",
    ],
  },
  {
    id: "informes",
    title: "Informes y seguimiento",
    icon: MonitorCheck,
    tone: "blue" as const,
    href: "/informes-veterinarios",
    linkLabel: "Ver informes veterinarios",
    description:
      "Entrega y seguimiento de informes con comunicación continua para clínicas y profesionales durante todo el proceso diagnóstico.",
    features: [
      "Consulta de resultados de informes las 24 hs",
      "Seguimiento del estado del estudio en portal",
      "Comunicación directa para coordinación de muestras",
      "Priorización según complejidad diagnóstica",
      "Tiempos variables según necesidad del caso",
      "Entrega final con criterio profesional y responsable",
    ],
  },
];

export default function ServiciosPage() {
  const jsonLd = getServicesJsonLd();

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section
        className="public-secondary-hero-surface py-16 text-white md:py-20"
        aria-labelledby="services-page-title"
      >
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <h1
            id="services-page-title"
            className="mb-4 max-w-4xl text-4xl font-bold leading-tight md:text-5xl"
          >
            Servicio patológico veterinario
          </h1>
          <p className="max-w-2xl public-copy text-lg text-primary-foreground/92 md:text-xl">
            La anatomía patológica veterinaria integra evaluación microscópica,
            trazabilidad de muestras e informes clínicos para orientar
            decisiones diagnósticas con respaldo profesional.
          </p>
        </div>
      </section>
      <div className="public-soft-canvas">
        <section
          className="py-16 md:py-20"
          aria-labelledby="services-categories-heading"
        >
          <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="section">
              <div className="mx-auto mb-10 max-w-4xl">
                <h2
                  id="services-categories-heading"
                  className="text-2xl font-bold text-vetneb-ink md:text-3xl"
                >
                  Estudios diagnósticos con criterio clínico-patológico
                </h2>
                <p className="mt-3 public-copy-tight text-sm text-muted-foreground">
                  Unificamos histopatología, citología, técnicas complementarias e
                  informes trazables para acompañar decisiones clínicas en cada
                  etapa del caso.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal variant="cards" staggerChildren>
              <div
                className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8"
                data-services-polished="true"
              >
                {serviceCategories.map((service) => {
                  const serviceHeadingId = `service-card-${service.id}-title`;

                  return (
                    <article
                      key={service.id}
                      data-scroll-reveal-item
                      aria-labelledby={serviceHeadingId}
                      className={cn(
                        "[&_.premium-card]:transition-colors [&_.premium-card]:duration-200 hover:[&_.premium-card]:bg-sky-50 hover:[&_.premium-card]:border-sky-300 hover:[&_.premium-card]:shadow-xl",
                        serviceCategories.length % 2 === 1 &&
                        service.id === serviceCategories[serviceCategories.length - 1]?.id
                          ? "lg:col-span-2 lg:mx-auto lg:w-full lg:max-w-[calc((100%-2rem)/2)]"
                          : "",
                      )}
                    >
                      <Card
                        id={service.id}
                        className="premium-card h-full"
                      >
                        <CardHeader>
                          <VisualIcon
                            icon={service.icon}
                            tone={service.tone}
                            className="mb-2"
                          />
                          <CardTitle id={serviceHeadingId} className="text-xl text-vetneb-ink">
                            {service.title}
                          </CardTitle>
                          <CardDescription className="public-copy-tight text-sm text-muted-foreground">
                            {service.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2.5">
                            {service.features.map((feature) => (
                              <li key={feature} className="flex items-start gap-2">
                                <span
                                  className="mt-0.5 text-primary font-bold text-xs"
                                  aria-hidden="true"
                                >
                                  →
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {feature}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <Link
                            href={service.href}
                            className="mt-5 inline-flex w-fit items-center gap-2 rounded-md text-sm font-semibold text-primary underline underline-offset-4 transition hover:text-vetneb-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                          >
                            <span className="sr-only">{service.linkLabel}</span>
                            <span aria-hidden="true">Ver más</span>
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </CardContent>
                      </Card>
                    </article>
                  );
                })}
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section className="py-16" aria-labelledby="services-coordination-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-center">
            <PublicScrollReveal variant="minimal">
              <div className="premium-card p-8">
                <h2
                  id="services-coordination-heading"
                  className="text-2xl font-bold text-vetneb-ink mb-4"
                >
                  Coordinación diagnóstica para clínicas y profesionales
                </h2>
                <p className="public-copy text-muted-foreground mb-8">
                  Coordinamos recepción de muestras, priorización por complejidad y
                  entrega de informes trazables. Los tiempos se ajustan al criterio
                  diagnóstico y a las necesidades clínicas de cada caso.
                </p>
                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="public-cta-primary w-full sm:w-auto"
                  >
                    <Link href={ROUTES.contacto}>
                      Solicitar coordinación diagnóstica
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="public-cta-outline w-full sm:w-auto"
                  >
                    <Link href={ROUTES.clinicas}>
                      Conocer solución para clínicas
                    </Link>
                  </Button>
                </div>
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section className="py-16" aria-labelledby="services-integral-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <PublicScrollReveal variant="section">
              <div className="premium-card-muted p-6">
                <h2
                  id="services-integral-heading"
                  className="text-2xl font-bold text-vetneb-ink mb-4"
                >
                  Diagnóstico integral para medicina veterinaria
                </h2>
                <p className="public-copy text-muted-foreground mb-4">
                  El diagnóstico anatomopatológico veterinario requiere integrar no
                  sólo el análisis de tejido y citología, sino también el
                  conocimiento clínico global de cada paciente. Esta articulación
                  permite enriquecer la lectura diagnóstica junto con otras áreas
                  de práctica veterinaria.
                </p>
                <p className="public-copy text-muted-foreground">
                  Nuestro objetivo es colaborar de forma permanente con equipos
                  quirúrgicos y clínicos, estudiando tejidos extirpados y muestras
                  de punción para construir diagnósticos específicos y apoyar
                  planes de tratamiento personalizados.
                </p>
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section className="py-16" aria-labelledby="services-considerations-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
            <PublicScrollReveal variant="section">
              <div className="premium-card-muted p-6">
                <h2
                  id="services-considerations-heading"
                  className="text-2xl font-bold text-vetneb-ink mb-4"
                >
                  Para tener en cuenta
                </h2>
                <p className="public-copy text-muted-foreground mb-4">
                  El estudio anatomopatológico requiere integrar datos clínicos con
                  la evaluación histológica y citológica realizada por el médico
                  veterinario patólogo en microscopía.
                </p>
                <p className="public-copy text-muted-foreground">
                  No se trata de un diagnóstico automatizado, por lo que los
                  tiempos son variables según complejidad y técnicas
                  complementarias requeridas. En ciertos casos se requiere
                  interconsulta profesional para alcanzar mayor precisión
                  diagnóstica.
                </p>
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section className="py-16" aria-labelledby="services-values-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <PublicScrollReveal variant="minimal">
              <div className="clinical-muted-band rounded-lg p-6 clinical-surface-shadow">
                <div className="flex items-start gap-3">
                  <VisualIcon
                    icon={ClipboardCheck}
                    tone="emerald"
                    className="h-11 w-11 shrink-0 rounded-xl"
                  />
                  <div>
                    <h2
                      id="services-values-heading"
                      className="text-2xl font-bold text-vetneb-ink mb-4"
                    >
                      Valores que guían el servicio
                    </h2>
                    <p className="public-copy text-muted-foreground">
                      Basamos nuestro trabajo en compromiso, seriedad, respeto,
                      responsabilidad, confianza, diálogo, trabajo en equipo,
                      empatía y capacitación constante para sostener un servicio
                      patológico veterinario confiable.
                    </p>
                  </div>
                </div>
              </div>
            </PublicScrollReveal>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}

