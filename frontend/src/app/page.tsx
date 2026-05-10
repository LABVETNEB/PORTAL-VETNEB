import type { Metadata } from "next";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createPageMetadata, getOrganizationJsonLd, SITE_URL } from "@/lib/seo";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = createPageMetadata(
  "Portal VETNEB — Laboratorio Patológico Veterinario",
  "La anatomía patológica veterinaria estudia los motivos, el desarrollo y las consecuencias de distintas enfermedades mediante el análisis de tejidos, órganos y muestras celulares. VETNEB integra histopatología, citología, citopatología, hematología, diagnóstico hematológico y hemoparásitos.",
  "/",
);

const services = [
  {
    icon: "📋",
    title: "Estudio Anatomopatológico",
    description:
      "Estudio anatomopatológico de todo tipo de tejidos para caracterizar lesiones y aportar precisión diagnóstica en medicina veterinaria.",
  },
  {
    icon: "🔬",
    title: "Estudio Citológico",
    description:
      "Estudio citológico de muestras, líquidos y punciones para evaluar alteraciones celulares con criterio clínico-patológico.",
  },
  {
    icon: "🏥",
    title: "Tinciones Especiales",
    description:
      "Estudios aplicados con tinciones especiales para ampliar hallazgos histológicos y reforzar diagnósticos diferenciales.",
  },
  {
    icon: "🚐",
    title: "Diagnóstico Integral",
    description:
      "Integración de datos clínicos con evaluación histológica y citológica para orientar decisiones diagnósticas y terapéuticas.",
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
  const jsonLd = getOrganizationJsonLd();

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section
        className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white"
        aria-labelledby="hero-heading"
      >
        <div className="container mx-auto px-4 py-16 sm:px-6 md:py-20 lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-700/50 px-4 py-1.5 text-sm font-medium text-blue-100">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              Servicio patológico veterinario
            </div>
            <h1
              id="hero-heading"
              className="mb-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl"
            >
              Diagnóstico anatomopatológico
              <span className="text-blue-300"> veterinario integral</span>
            </h1>
            <p className="mb-8 max-w-2xl text-lg leading-relaxed text-blue-100 md:text-xl">
              La anatomía patológica veterinaria estudia los motivos, el
              desarrollo y las consecuencias de distintas enfermedades a partir
              del análisis de tejidos, órganos y muestras celulares. Consultá
              los resultados de tus informes las 24 hs desde el portal.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Button
                asChild
                size="lg"
                className="w-full bg-white text-blue-900 hover:bg-blue-50 sm:w-auto"
              >
                <Link href={ROUTES.login}>Acceder al portal</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full border-white/40 text-white hover:bg-white/10 sm:w-auto"
              >
                <Link href={ROUTES.contacto}>Solicitar acceso</Link>
              </Button>
            </div>
          </div>
        </div>
        <div
          className="absolute bottom-0 left-0 right-0 h-16 bg-white"
          style={{ clipPath: "ellipse(55% 100% at 50% 100%)" }}
          aria-hidden="true"
        />
      </section>

      {/* Servicios principales */}
      <section
        className="bg-white py-16 md:py-20"
        aria-labelledby="services-heading"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2
              id="services-heading"
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
            >
              Servicios del laboratorio patológico veterinario
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Cobertura diagnóstica orientada a estudio anatomopatológico,
              citología, tinciones especiales e integración clínico-patológica.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <Card
                key={service.title}
                className="h-full border-gray-100 transition-shadow hover:shadow-md"
              >
                <CardHeader>
                  <div className="mb-2 text-3xl" aria-hidden="true">
                    {service.icon}
                  </div>
                  <CardTitle className="text-lg">{service.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {service.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild variant="outline">
              <Link href={ROUTES.servicios}>Ver todos los servicios</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section
        className="bg-gray-50 py-16 md:py-20"
        aria-labelledby="benefits-heading"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2
              id="benefits-heading"
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
            >
              Trabajo interdisciplinario y criterio diagnóstico
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Colaboramos de forma permanente con equipos clínicos para evaluar
              lesiones, integrar contexto médico y definir conductas de
              tratamiento.
            </p>
          </div>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            {benefits.map((benefit) => (
              <Card key={benefit.title} className="h-full border-gray-200">
                <CardHeader>
                  <CardTitle className="text-xl">{benefit.title}</CardTitle>
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
                        <span className="text-sm text-gray-600">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section
        className="bg-primary py-16 text-white md:py-20"
        aria-labelledby="cta-heading"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2
            id="cta-heading"
            className="text-3xl md:text-4xl font-bold mb-4"
          >
            Seguimos trabajando en mejorar
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-blue-100">
            Agilizamos la recepción y entrega de informes, fortalecemos la
            comunicación con clínicas y profesionales, y sostenemos un servicio
            guiado por compromiso, responsabilidad y trabajo constante.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
            <Button
              asChild
              size="lg"
              className="w-full bg-white text-primary hover:bg-blue-50 sm:w-auto"
            >
              <Link href={ROUTES.login}>Iniciar sesión</Link>
            </Button>
            <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full border-white/40 text-white hover:bg-white/10 sm:w-auto"
              >
                <Link href={ROUTES.contacto}>Contactar</Link>
              </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
