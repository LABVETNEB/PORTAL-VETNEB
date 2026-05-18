import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  FlaskConical,
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
  "Citología Veterinaria | Servicio Citológico y Citopatológico Veterinario",
  "Servicio de citología veterinaria y citopatología veterinaria para estudio citológico de muestras, líquidos y punciones con criterio clínico-patológico.",
  "/citologia-veterinaria",
);

const sampleTypes = [
  "Punciones con aguja fina",
  "Líquidos y muestras citológicas",
  "Lesiones cutáneas o subcutáneas",
  "Material de aspiración o impronta",
  "Evaluación celular orientada a diagnóstico",
  "Correlación con antecedentes clínicos",
];

const processSteps = [
  {
    title: "Recepción de la muestra",
    description:
      "El material se interpreta junto con datos clínicos, localización, evolución y motivo de consulta para orientar la lectura citológica.",
  },
  {
    title: "Evaluación celular",
    description:
      "Se valoran poblaciones celulares, patrones inflamatorios, criterios de atipia y hallazgos compatibles con diagnósticos diferenciales.",
  },
  {
    title: "Integración clínico-patológica",
    description:
      "El informe relaciona los hallazgos citológicos con el contexto del paciente y la sospecha clínica indicada por el profesional.",
  },
  {
    title: "Conclusión profesional",
    description:
      "La interpretación citológica aporta orientación diagnóstica, recomendaciones de seguimiento o necesidad de estudios complementarios.",
  },
];

export default function CitologiaVeterinariaPage() {
  const jsonLd = getDiagnosticServiceJsonLd({
    path: "/citologia-veterinaria",
    name: "Citología veterinaria",
    serviceType: "Servicio citológico veterinario",
    description:
      "Servicio de citología veterinaria y citopatología veterinaria para estudio citológico de muestras, líquidos y punciones con criterio clínico-patológico.",
    knowsAbout: [
      "citología veterinaria",
      "servicio citológico veterinario",
      "citopatología veterinaria",
      "servicio citopatológico veterinario",
      "diagnóstico citológico veterinario",
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
        aria-labelledby="cytology-page-title"
      >
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-primary-foreground/88">
            Servicio citológico veterinario
          </p>
          <h1
            id="cytology-page-title"
            className="mb-4 max-w-4xl text-4xl font-bold leading-tight md:text-5xl"
          >
            Citología veterinaria
          </h1>
          <p className="max-w-3xl public-copy text-lg text-primary-foreground/92 md:text-xl">
            Estudio citológico y citopatológico de muestras, líquidos y
            punciones para evaluar alteraciones celulares, orientar diagnósticos
            diferenciales y acompañar decisiones clínicas veterinarias.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="public-cta-primary w-full sm:w-auto">
              <Link href="/contacto">
                Solicitar coordinación diagnóstica
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="public-cta-on-hero w-full sm:w-auto">
              <Link href="/servicios">Ver todos los servicios</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="public-soft-canvas">
        <section className="py-16 md:py-20" aria-labelledby="cytology-samples-heading">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="section">
              <div className="mx-auto mb-10 max-w-4xl">
                <h2
                  id="cytology-samples-heading"
                  className="text-2xl font-bold text-vetneb-ink md:text-3xl"
                >
                  Qué permite evaluar la citología veterinaria
                </h2>
                <p className="mt-3 public-copy-tight text-sm text-muted-foreground">
                  La citología veterinaria permite valorar muestras celulares de
                  forma orientativa y rápida, integrando hallazgos microscópicos
                  con antecedentes clínicos y evolución del caso.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal variant="cards" staggerChildren>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {sampleTypes.map((sampleType) => (
                  <article
                    key={sampleType}
                    data-scroll-reveal-item
                    className="premium-card-muted p-5"
                  >
                    <div className="flex items-start gap-3">
                      <VisualIcon
                        icon={SearchCheck}
                        tone="emerald"
                        className="h-10 w-10 shrink-0 rounded-xl"
                      />
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {sampleType}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section className="py-16" aria-labelledby="cytology-process-heading">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="section">
              <div className="mx-auto mb-10 max-w-4xl">
                <h2
                  id="cytology-process-heading"
                  className="text-2xl font-bold text-vetneb-ink md:text-3xl"
                >
                  Proceso del servicio citológico veterinario
                </h2>
                <p className="mt-3 public-copy-tight text-sm text-muted-foreground">
                  La lectura citológica se orienta a interpretar alteraciones
                  celulares dentro del contexto clínico del paciente.
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
                          tone="blue"
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

        <section className="py-16" aria-labelledby="cytology-value-heading">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="minimal">
              <div className="premium-card p-8">
                <div className="mb-4 flex items-center gap-3">
                  <VisualIcon icon={FlaskConical} tone="emerald" />
                  <h2
                    id="cytology-value-heading"
                    className="text-2xl font-bold text-vetneb-ink"
                  >
                    Citopatología veterinaria con orientación clínica
                  </h2>
                </div>
                <p className="public-copy text-muted-foreground">
                  El servicio citopatológico veterinario aporta información
                  celular relevante para orientar diagnósticos diferenciales,
                  definir seguimiento y decidir si corresponde complementar con
                  histopatología u otras técnicas diagnósticas.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="public-cta-primary w-full sm:w-auto">
                    <Link href="/contacto">Coordinar envío de muestras</Link>
                  </Button>
                  <Button asChild variant="outline" className="public-cta-outline w-full sm:w-auto">
                    <Link href="/histopatologia-veterinaria">
                      Ver histopatología veterinaria
                    </Link>
                  </Button>
                </div>
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section className="py-16" aria-labelledby="cytology-related-heading">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="minimal">
              <div className="clinical-muted-band rounded-lg p-6 clinical-surface-shadow">
                <div className="flex items-start gap-3">
                  <VisualIcon icon={Network} tone="slate" className="h-11 w-11 shrink-0 rounded-xl" />
                  <div>
                    <h2
                      id="cytology-related-heading"
                      className="mb-3 text-xl font-bold text-vetneb-ink"
                    >
                      Complemento diagnóstico interdisciplinario
                    </h2>
                    <p className="public-copy-tight text-sm text-muted-foreground">
                      La citología puede orientar decisiones iniciales y, según la
                      complejidad del caso, complementarse con histopatología,
                      tinciones especiales o interconsulta profesional.
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
