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
  Stethoscope,
} from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AmbientOrbs, Eyebrow, VisualIcon } from "@/components/public/VisualAccents";
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
        className="bg-gradient-to-br from-blue-900 to-blue-700 py-16 text-white md:py-20"
        data-public-hero-depth="true"
      >
        <AmbientOrbs variant="dark" />
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <Eyebrow>
            <Stethoscope className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            Servicios diagnósticos
          </Eyebrow>
          <h1 className="mb-4 max-w-4xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Servicio patológico veterinario
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-blue-100 md:text-xl">
            La anatomía patológica veterinaria estudia los motivos, el
            desarrollo y las consecuencias de distintas enfermedades mediante el
            análisis de tejidos, órganos y muestras celulares.
          </p>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20" data-public-soft-canvas="true">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-10 max-w-4xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-primary">
              Laboratorio VETNEB
            </p>
            <h2 className="text-2xl font-bold text-gray-950 md:text-3xl">
              Estudios con criterio clínico-patológico
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Unificamos histopatología, citología, técnicas complementarias y
              seguimiento para sostener decisiones clínicas con mayor claridad.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8" data-services-polished="true">
            {serviceCategories.map((service) => (
              <Card
                key={service.id}
                id={service.id}
                className="h-full border-gray-100 transition-shadow hover:shadow-md"
              >
                <CardHeader>
                  <VisualIcon icon={service.icon} tone={service.tone} className="mb-2" />
                  <CardTitle className="text-xl text-gray-950">
                    {service.title}
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed text-gray-600">
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
                        <span className="text-sm text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-blue-50 py-16" data-public-soft-canvas="true">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-center">
          <div className="rounded-3xl border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Seguimos trabajando en mejorar
            </h2>
            <p className="text-gray-600 leading-relaxed mb-8">
              Estamos enfocados en agilizar la recepción y entrega de informes, y
              en fortalecer los medios de comunicación con clínicas y
              profesionales para reducir tiempos de espera de resultados.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="w-full bg-gradient-to-r from-blue-700 to-teal-600 shadow-[0_14px_35px_rgba(37,99,235,0.22)] hover:from-blue-800 hover:to-teal-700 sm:w-auto"
              >
                <Link href={ROUTES.contacto}>
                  Solicitar información
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full bg-white/80 sm:w-auto">
                <Link href={ROUTES.clinicas}>Ver solución para clínicas</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="premium-card-muted p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Diagnóstico integral para medicina veterinaria
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              El diagnóstico anatomopatológico veterinario requiere integrar no
              sólo el análisis de tejido y citología, sino también el
              conocimiento clínico global de cada paciente. Esta articulación
              permite enriquecer la lectura diagnóstica junto con otras áreas de
              práctica veterinaria.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Nuestro objetivo es colaborar de forma permanente con equipos
              quirúrgicos y clínicos, estudiando tejidos extirpados y muestras de
              punción para construir diagnósticos específicos y apoyar planes de
              tratamiento personalizados.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-16" data-public-soft-canvas="true">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="premium-card-muted p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Para tener en cuenta
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              El estudio anatomopatológico requiere integrar datos clínicos con la
              evaluación histológica y citológica realizada por el médico
              veterinario patólogo en microscopía.
            </p>
            <p className="text-gray-600 leading-relaxed">
              No se trata de un diagnóstico automatizado, por lo que los tiempos
              son variables según complejidad. En ciertos casos se requiere
              interconsulta profesional para alcanzar mayor precisión diagnóstica.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="rounded-3xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-blue-50 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-start gap-3">
              <VisualIcon icon={ClipboardCheck} tone="emerald" className="h-11 w-11 shrink-0 rounded-xl" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Valores que guían el servicio
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  Basamos nuestro trabajo en compromiso, seriedad, respeto,
                  responsabilidad, confianza, diálogo, trabajo en equipo, empatía y
                  capacitación constante para sostener un servicio patológico
                  veterinario confiable.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}