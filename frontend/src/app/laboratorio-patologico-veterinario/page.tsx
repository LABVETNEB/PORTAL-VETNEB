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
  "Laboratorio Patológico Veterinario | Anatomía Patológica Veterinaria",
  "Laboratorio patológico veterinario para diagnóstico integral con anatomía patológica veterinaria, histopatología, citología, tinciones especiales y criterio clínico-patológico.",
  "/laboratorio-patologico-veterinario",
);

const diagnosticAreas = [
  "Histopatología veterinaria para tejidos, órganos y biopsias",
  "Citología veterinaria y citopatología de muestras celulares",
  "Tinciones especiales para ampliar hallazgos microscópicos",
  "Hematología veterinaria y apoyo en diagnóstico hematológico",
  "Evaluación de hemoparásitos y procesos compatibles",
  "Integración de antecedentes clínicos con lectura microscópica",
];

const processSteps = [
  {
    title: "Recepción orientada al caso",
    description:
      "La muestra se interpreta junto con antecedentes, localización, evolución clínica y sospecha diagnóstica informada por el profesional.",
  },
  {
    title: "Evaluación patológica",
    description:
      "El laboratorio integra técnicas histológicas, citológicas o complementarias según el tipo de muestra y la complejidad diagnóstica.",
  },
  {
    title: "Correlación clínico-patológica",
    description:
      "Los hallazgos microscópicos se relacionan con el contexto del paciente para construir una conclusión útil para el equipo tratante.",
  },
  {
    title: "Informe trazable",
    description:
      "El resultado comunica observaciones, interpretación diagnóstica y consideraciones relevantes para seguimiento o estudios complementarios.",
  },
];

export default function LaboratorioPatologicoVeterinarioPage() {
  const jsonLd = getDiagnosticServiceJsonLd({
    path: "/laboratorio-patologico-veterinario",
    name: "Laboratorio patológico veterinario",
    serviceType: "Laboratorio de anatomía patológica veterinaria",
    description:
      "Laboratorio patológico veterinario para diagnóstico integral con anatomía patológica veterinaria, histopatología, citología, tinciones especiales y criterio clínico-patológico.",
    knowsAbout: [
      "laboratorio patológico veterinario",
      "anatomía patológica veterinaria",
      "histopatología veterinaria",
      "citología veterinaria",
      "citopatología veterinaria",
      "hematología veterinaria",
      "hemoparásitos veterinarios",
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
        aria-labelledby="pathology-lab-page-title"
      >
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <h1
            id="pathology-lab-page-title"
            className="mb-4 max-w-4xl text-4xl font-bold leading-tight md:text-5xl"
          >
            Laboratorio patológico veterinario
          </h1>
          <p className="max-w-3xl public-copy text-lg text-primary-foreground/92 md:text-xl">
            Diagnóstico integral para medicina veterinaria mediante evaluación
            histopatológica, citológica y técnicas complementarias con criterio
            clínico-patológico.
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
        <section className="py-16 md:py-20" aria-labelledby="pathology-lab-areas-heading">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="section">
              <div className="mx-auto mb-10 max-w-4xl">
                <h2
                  id="pathology-lab-areas-heading"
                  className="text-2xl font-bold text-vetneb-ink md:text-3xl"
                >
                  Áreas diagnósticas del laboratorio patológico veterinario
                </h2>
                <p className="mt-3 public-copy-tight text-sm text-muted-foreground">
                  El laboratorio patológico veterinario reúne estudios de tejidos,
                  muestras celulares y técnicas complementarias para aportar
                  información diagnóstica específica en cada caso clínico.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal variant="cards" staggerChildren>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {diagnosticAreas.map((area) => (
                  <article
                    key={area}
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
                        {area}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section className="py-16" aria-labelledby="pathology-lab-process-heading">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="section">
              <div className="mx-auto mb-10 max-w-4xl">
                <h2
                  id="pathology-lab-process-heading"
                  className="text-2xl font-bold text-vetneb-ink md:text-3xl"
                >
                  Proceso diagnóstico con trazabilidad
                </h2>
                <p className="mt-3 public-copy-tight text-sm text-muted-foreground">
                  El circuito prioriza muestras identificadas, interpretación
                  profesional y comunicación clara para clínicas y profesionales.
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

        <section className="py-16" aria-labelledby="pathology-lab-value-heading">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="minimal">
              <div className="premium-card p-8">
                <div className="mb-4 flex items-center gap-3">
                  <VisualIcon icon={Microscope} tone="blue" />
                  <h2
                    id="pathology-lab-value-heading"
                    className="text-2xl font-bold text-vetneb-ink"
                  >
                    Diagnóstico integrado para equipos veterinarios
                  </h2>
                </div>
                <p className="public-copy text-muted-foreground">
                  La anatomía patológica veterinaria aporta una mirada
                  microscópica especializada que complementa la clínica, la
                  cirugía, el diagnóstico por imágenes y el seguimiento del
                  paciente. El objetivo es construir información diagnóstica útil
                  para decisiones terapéuticas responsables.
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

        <section className="py-16" aria-labelledby="pathology-lab-related-heading">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="minimal">
              <div
                className="group rounded-lg"
                aria-labelledby="pathology-lab-related-heading"
              >
                <div className="clinical-muted-band rounded-lg p-6 clinical-surface-shadow transition-colors duration-200 group-hover:bg-sky-50 group-hover:border-sky-300 group-hover:shadow-xl">
                  <div className="flex items-start gap-3">
                    <VisualIcon icon={Network} tone="slate" className="h-11 w-11 shrink-0 rounded-xl" />
                    <div>
                      <h2
                        id="pathology-lab-related-heading"
                        className="mb-3 text-xl font-bold text-vetneb-ink"
                      >
                        Servicios relacionados
                      </h2>
                      <p className="public-copy-tight text-sm text-muted-foreground">
                        El laboratorio articula histopatología, citología,
                        citopatología, hematología y evaluación de hemoparásitos
                        según la muestra recibida y la pregunta diagnóstica del
                        caso.
                      </p>
                      <Link
                        href="/servicios"
                        className="mt-5 inline-flex w-fit items-center gap-2 rounded-md text-sm font-semibold text-primary underline underline-offset-4 transition hover:text-vetneb-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        Ver servicios relacionados
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
