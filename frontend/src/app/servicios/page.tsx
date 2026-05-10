import type { Metadata } from "next";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    icon: "🔬",
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
    icon: "🧪",
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
    icon: "🧬",
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
    icon: "📋",
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
    icon: "🖥️",
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

      {/* Header */}
      <section className="bg-gradient-to-br from-blue-900 to-blue-700 py-16 text-white md:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl">
            Servicio patológico veterinario
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-blue-100 md:text-xl">
            La anatomía patológica veterinaria estudia los motivos, el
            desarrollo y las consecuencias de distintas enfermedades mediante el
            análisis de tejidos, órganos y muestras celulares.
          </p>
        </div>
      </section>

      {/* Servicios */}
      <section className="bg-white py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            {serviceCategories.map((service) => (
              <Card
                key={service.id}
                id={service.id}
                className="h-full border-gray-100 transition-shadow hover:shadow-md"
              >
                <CardHeader>
                  <div className="mb-2 text-4xl" aria-hidden="true">
                    {service.icon}
                  </div>
                  <CardTitle className="text-xl">{service.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
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

      {/* CTA */}
      <section className="bg-blue-50 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Seguimos trabajando en mejorar
          </h2>
          <p className="text-gray-600 leading-relaxed mb-8">
            Estamos enfocados en agilizar la recepción y entrega de informes, y
            en fortalecer los medios de comunicación con clínicas y
            profesionales para reducir tiempos de espera de resultados.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={ROUTES.contacto}>Solicitar información</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href={ROUTES.clinicas}>Ver solución para clínicas</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Diagnóstico integral */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
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
      </section>

      {/* Para tener en cuenta */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
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
      </section>

      <section className="bg-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
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
      </section>
    </PublicLayout>
  );
}
