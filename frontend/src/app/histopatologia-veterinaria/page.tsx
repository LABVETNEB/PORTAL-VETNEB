import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Microscope,
  Network,
  SearchCheck,
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
  "Histopatología Veterinaria | Servicio Histopatológico Veterinario",
  "Servicio de histopatología veterinaria para estudio anatomopatológico de tejidos, biopsias y órganos con interpretación microscópica y criterio clínico-patológico.",
  "/histopatologia-veterinaria",
);

const processSteps = [
  {
    title: "Recepción de tejidos y antecedentes",
    description:
      "La muestra se interpreta junto con la información clínica, localización anatómica, evolución y sospecha diagnóstica informada por el profesional.",
  },
  {
    title: "Procesamiento histológico",
    description:
      "El tejido se procesa para evaluación microscópica, preservando trazabilidad de la muestra y consistencia diagnóstica durante el circuito.",
  },
  {
    title: "Lectura anatomopatológica",
    description:
      "El análisis permite caracterizar lesiones, patrones inflamatorios, proliferativos o degenerativos y aportar hallazgos relevantes para el caso.",
  },
  {
    title: "Informe diagnóstico",
    description:
      "El resultado integra observaciones microscópicas con criterio clínico-patológico para orientar decisiones terapéuticas o interconsultas.",
  },
];

const useCases = [
  "Biopsias de piel y tejidos blandos",
  "Evaluación de órganos y lesiones quirúrgicas",
  "Caracterización microscópica de procesos inflamatorios",
  "Apoyo diagnóstico en lesiones proliferativas",
  "Correlación con antecedentes clínicos e imagenológicos",
  "Definición de diagnósticos diferenciales",
];

export default function HistopatologiaVeterinariaPage() {
  const jsonLd = getDiagnosticServiceJsonLd({
    path: "/histopatologia-veterinaria",
    name: "Histopatología veterinaria",
    serviceType: "Servicio histopatológico veterinario",
    description:
      "Servicio de histopatología veterinaria para estudio anatomopatológico de tejidos, biopsias y órganos con interpretación microscópica y criterio clínico-patológico.",
    knowsAbout: [
      "histopatología veterinaria",
      "servicio histopatológico veterinario",
      "estudio anatomopatológico veterinario",
      "biopsias veterinarias",
      "patología veterinaria",
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
        aria-labelledby="histopathology-page-title"
      >
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <h1
            id="histopathology-page-title"
            className="mb-4 max-w-4xl text-4xl font-bold leading-tight md:text-5xl"
          >
            Histopatología veterinaria
          </h1>
          <p className="max-w-3xl public-copy text-lg text-primary-foreground/92 md:text-xl">
            Estudio anatomopatológico de tejidos, biopsias y órganos para
            caracterizar lesiones, integrar antecedentes clínicos y aportar
            precisión diagnóstica en medicina veterinaria.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="public-cta-primary w-full sm:w-auto">
              <Link href="/contacto">
                Solicitar coordinación diagnóstica
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="public-cta-on-hero w-full sm:w-auto">
              <Link href="/servicios">Ver más servicios</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="public-soft-canvas">
        <section className="py-16 md:py-20" aria-labelledby="histopathology-when-heading">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="section">
              <div className="mx-auto mb-10 max-w-4xl">
                <h2
                  id="histopathology-when-heading"
                  className="text-2xl font-bold text-vetneb-ink md:text-3xl"
                >
                  Cuándo solicitar histopatología veterinaria
                </h2>
                <p className="mt-3 public-copy-tight text-sm text-muted-foreground">
                  La histopatología veterinaria es indicada cuando se requiere
                  estudiar tejidos u órganos para comprender la naturaleza de una
                  lesión, confirmar diagnósticos diferenciales o acompañar una
                  decisión clínica con evidencia microscópica.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal variant="cards" staggerChildren>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {useCases.map((useCase) => (
                  <article
                    key={useCase}
                    data-scroll-reveal-item
                    className="premium-card-muted p-5"
                  >
                    <div className="flex items-start gap-3">
                      <VisualIcon
                        icon={SearchCheck}
                        tone="blue"
                        className="h-10 w-10 shrink-0 rounded-xl"
                      />
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {useCase}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section className="py-16" aria-labelledby="histopathology-process-heading">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="section">
              <div className="mx-auto mb-10 max-w-4xl">
                <h2
                  id="histopathology-process-heading"
                  className="text-2xl font-bold text-vetneb-ink md:text-3xl"
                >
                  Proceso del servicio histopatológico veterinario
                </h2>
                <p className="mt-3 public-copy-tight text-sm text-muted-foreground">
                  El circuito prioriza trazabilidad, interpretación profesional e
                  integración con el contexto clínico de cada paciente.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal variant="cards" staggerChildren>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                {processSteps.map((step) => (
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

        <section className="py-16" aria-labelledby="histopathology-value-heading">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="minimal">
              <div className="premium-card p-8">
                <div className="mb-4 flex items-center gap-3">
                  <VisualIcon icon={Microscope} tone="blue" />
                  <h2
                    id="histopathology-value-heading"
                    className="text-2xl font-bold text-vetneb-ink"
                  >
                    Diagnóstico anatomopatológico con criterio clínico
                  </h2>
                </div>
                <p className="public-copy text-muted-foreground">
                  El estudio histopatológico veterinario no es un proceso
                  automatizado. Requiere lectura microscópica, correlación con los
                  antecedentes y comunicación profesional para construir una
                  conclusión diagnóstica útil para el equipo tratante.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="public-cta-primary w-full sm:w-auto">
                    <Link href="/contacto">Coordinar envío de muestras</Link>
                  </Button>
                  <Button asChild variant="outline" className="public-cta-outline w-full sm:w-auto">
                    <Link href="/servicios">Ver más servicios</Link>
                  </Button>
                </div>
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section className="py-16" aria-labelledby="histopathology-related-heading">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="minimal">
              <div className="clinical-muted-band rounded-lg p-6 clinical-surface-shadow">
                <div className="flex items-start gap-3">
                  <VisualIcon icon={Network} tone="slate" className="h-11 w-11 shrink-0 rounded-xl" />
                  <div>
                    <h2
                      id="histopathology-related-heading"
                      className="mb-3 text-xl font-bold text-vetneb-ink"
                    >
                      Integración con otros estudios diagnósticos
                    </h2>
                    <p className="public-copy-tight text-sm text-muted-foreground">
                      La histopatología puede complementarse con citología,
                      tinciones especiales, antecedentes clínicos e interconsulta
                      profesional cuando la complejidad del caso lo requiere.
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
