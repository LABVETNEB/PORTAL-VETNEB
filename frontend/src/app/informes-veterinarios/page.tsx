import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Clock3,
  FileSearch,
  History,
  Network,
  ShieldCheck,
} from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";
import { VisualIcon } from "@/components/public/VisualAccents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createPageMetadata,
  getDiagnosticServiceJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = createPageMetadata(
  "Informes Veterinarios | Resultados Veterinarios Online",
  "Consulta de informes veterinarios, resultados veterinarios online y trazabilidad de estudios veterinarios para seguimiento diagnóstico de casos patológicos veterinarios.",
  "/informes-veterinarios",
);

const consultationCards = [
  {
    title: "Consulta orientada al caso",
    icon: FileSearch,
    tone: "blue" as const,
    description:
      "Los informes veterinarios reúnen hallazgos, interpretación diagnóstica y contexto clínico para acompañar decisiones del equipo tratante.",
  },
  {
    title: "Seguimiento del estudio",
    icon: History,
    tone: "emerald" as const,
    description:
      "El seguimiento de informes veterinarios permite reconocer el estado del proceso diagnóstico y no se presenta como consulta pública abierta de resultados privados.",
  },
  {
    title: "Comunicación responsable",
    icon: ShieldCheck,
    tone: "slate" as const,
    description:
      "La consulta de resultados veterinarios online debe sostener canales habilitados para cada clínica o profesional, con resguardo de la información del caso.",
  },
];

const traceabilitySteps = [
  {
    title: "Identificación del estudio",
    description:
      "Cada caso necesita vincular muestra, antecedentes y solicitud diagnóstica para sostener trazabilidad de estudios veterinarios desde el ingreso.",
  },
  {
    title: "Evaluación diagnóstica",
    description:
      "La lectura patológica integra hallazgos microscópicos, datos clínicos y técnicas complementarias cuando la complejidad del caso lo requiere.",
  },
  {
    title: "Informe trazable",
    description:
      "Los informes patológicos veterinarios comunican observaciones, interpretación y consideraciones de seguimiento con criterio profesional.",
  },
  {
    title: "Acompañamiento posterior",
    description:
      "El resultado puede orientar interconsultas, estudios complementarios o coordinación con el equipo veterinario responsable del paciente.",
  },
];

export default function InformesVeterinariosPage() {
  const jsonLd = getDiagnosticServiceJsonLd({
    path: "/informes-veterinarios",
    name: "Informes veterinarios",
    serviceType: "Consulta y seguimiento de informes veterinarios",
    description:
      "Consulta de informes veterinarios, resultados veterinarios online y trazabilidad de estudios veterinarios para acompañar el seguimiento diagnóstico de casos patológicos veterinarios.",
    knowsAbout: [
      "informes veterinarios",
      "resultados veterinarios online",
      "informes patológicos veterinarios",
      "consulta de informes veterinarios",
      "trazabilidad de estudios veterinarios",
      "seguimiento diagnóstico veterinario",
      "diagnóstico veterinario",
    ],
  });

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section
        className="public-secondary-hero-surface py-16 text-white md:py-20"
        aria-labelledby="diagnostic-reports-page-title"
      >
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-primary-foreground/88">
            Consulta de informes veterinarios
          </p>
          <h1
            id="diagnostic-reports-page-title"
            className="mb-4 max-w-4xl text-4xl font-bold leading-tight md:text-5xl"
          >
            Informes veterinarios
          </h1>
          <p className="max-w-3xl public-copy text-lg text-primary-foreground/92 md:text-xl">
            Resultados veterinarios online y seguimiento de informes patológicos
            veterinarios con trazabilidad diagnóstica, comunicación responsable y
            resguardo de la información clínica de cada caso.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="public-cta-primary w-full sm:w-auto">
              <Link href="/contacto">
                Consultar por informes
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="public-cta-on-hero w-full sm:w-auto">
              <Link href="/servicios">VER MAS SERVICIOS</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="public-soft-canvas">
        <section className="py-16 md:py-20" aria-labelledby="reports-consultation-heading">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="section">
              <div className="mx-auto mb-10 max-w-4xl">
                <h2
                  id="reports-consultation-heading"
                  className="text-2xl font-bold text-vetneb-ink md:text-3xl"
                >
                  Consulta y seguimiento de informes veterinarios
                </h2>
                <p className="mt-3 public-copy-tight text-sm text-muted-foreground">
                  La consulta de informes veterinarios permite acompañar el
                  recorrido diagnóstico desde el estudio solicitado hasta la
                  comunicación del resultado, sin convertir la información privada
                  del paciente en contenido público.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal variant="cards" staggerChildren>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {consultationCards.map((card) => (
                  <article key={card.title} data-scroll-reveal-item>
                    <Card className="premium-card h-full">
                      <CardHeader>
                        <VisualIcon
                          icon={card.icon}
                          tone={card.tone}
                          className="mb-2"
                        />
                        <CardTitle className="text-lg text-vetneb-ink">
                          {card.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {card.description}
                        </p>
                      </CardContent>
                    </Card>
                  </article>
                ))}
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section className="py-16" aria-labelledby="reports-traceability-heading">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="section">
              <div className="mx-auto mb-10 max-w-4xl">
                <h2
                  id="reports-traceability-heading"
                  className="text-2xl font-bold text-vetneb-ink md:text-3xl"
                >
                  Trazabilidad de estudios veterinarios
                </h2>
                <p className="mt-3 public-copy-tight text-sm text-muted-foreground">
                  La trazabilidad de estudios veterinarios ordena el circuito del
                  caso, conserva la relación entre muestra, antecedentes y lectura
                  diagnóstica, y facilita consultas posteriores del equipo
                  profesional.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal variant="cards" staggerChildren>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                {traceabilitySteps.map((step) => (
                  <article key={step.title} data-scroll-reveal-item>
                    <Card className="premium-card h-full">
                      <CardHeader>
                        <VisualIcon
                          icon={ClipboardCheck}
                          tone="emerald"
                          className="mb-2"
                        />
                        <CardTitle className="text-lg text-vetneb-ink">
                          {step.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {step.description}
                        </p>
                      </CardContent>
                    </Card>
                  </article>
                ))}
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section className="py-16" aria-labelledby="reports-timing-heading">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="minimal">
              <div className="premium-card p-8">
                <div className="mb-4 flex items-center gap-3">
                  <VisualIcon icon={Clock3} tone="amber" />
                  <h2
                    id="reports-timing-heading"
                    className="text-2xl font-bold text-vetneb-ink"
                  >
                    Tiempos definidos por el caso y la complejidad diagnóstica
                  </h2>
                </div>
                <p className="public-copy text-muted-foreground">
                  Los tiempos de elaboración y comunicación de resultados
                  veterinarios online dependen del tipo de muestra, los
                  antecedentes disponibles, la complejidad diagnóstica y la
                  necesidad de técnicas complementarias o interconsulta
                  profesional. Por eso no se presentan plazos exactos garantizados
                  para todos los casos.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="public-cta-primary w-full sm:w-auto">
                    <Link href="/contacto">Consultar por un caso</Link>
                  </Button>
                  <Button asChild variant="outline" className="public-cta-outline w-full sm:w-auto">
                    <Link href="/servicios">VER MAS SERVICIOS</Link>
                  </Button>
                </div>
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section className="py-16" aria-labelledby="reports-related-heading">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="minimal">
              <div className="clinical-muted-band rounded-lg p-6 clinical-surface-shadow">
                <div className="flex items-start gap-3">
                  <VisualIcon icon={Network} tone="slate" className="h-11 w-11 shrink-0 rounded-xl" />
                  <div>
                    <h2
                      id="reports-related-heading"
                      className="mb-3 text-xl font-bold text-vetneb-ink"
                    >
                      Informes dentro del servicio diagnóstico
                    </h2>
                    <p className="public-copy-tight text-sm text-muted-foreground">
                      La consulta de informes veterinarios se integra con el
                      servicio patológico veterinario, la histopatología,
                      citología y técnicas complementarias según la pregunta
                      diagnóstica del caso.
                    </p>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <Link
                        href="/servicios"
                        className="text-sm font-semibold text-primary underline underline-offset-4 hover:text-vetneb-teal"
                      >
                        Ver servicios diagnósticos
                      </Link>
                      <Link
                        href="/laboratorio-patologico-veterinario"
                        className="text-sm font-semibold text-primary underline underline-offset-4 hover:text-vetneb-teal"
                      >
                        Ver laboratorio patológico veterinario
                      </Link>
                    </div>
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
