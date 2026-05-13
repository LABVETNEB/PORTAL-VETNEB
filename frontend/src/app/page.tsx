import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ClipboardCheck, FlaskConical, Microscope, Network } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { VisualIcon } from "@/components/public/VisualAccents";
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
        className="relative isolate overflow-hidden text-white"
        aria-labelledby="hero-heading"
      >
        <div className="absolute inset-0">
          <Image
            src="/images/hero-microscope-vetneb.jpg"
            alt="Microscopio en laboratorio patológico veterinario"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>
        <div className="absolute inset-0 bg-[hsl(var(--vetneb-navy)/0.68)]" aria-hidden="true" />
        <div className="relative container mx-auto flex min-h-[calc(100vh-4.5rem)] items-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-4xl text-center">
            <h1
              id="hero-heading"
              className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl"
            >
              <span className="block uppercase">SERVICIO PATOLÓGICO</span>
              <span className="block uppercase">VETNEB</span>
            </h1>
            <p className="mt-4 text-lg font-medium text-slate-100 md:text-xl">
              Dr. BARBÉ, NICOLÁS E.
            </p>
            <p className="mx-auto mt-4 max-w-3xl text-sm text-slate-100 md:text-base">
              Diagnóstico anatomopatológico veterinario con precisión clínica,
              trazabilidad de estudios e informes disponibles para seguimiento
              profesional.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <Button
                asChild
                size="lg"
                className="w-full whitespace-normal bg-card px-8 text-vetneb-ink hover:bg-vetneb-surface-raised sm:w-auto"
              >
                <Link href={ROUTES.login}>
                  ACCESO A INFORMES Y TRAZABILIDAD DE ESTUDIOS
                </Link>
              </Button>
            </div>
            <p className="mt-8 text-sm font-medium text-slate-100">
              CONSULTÁ LOS RESULTADOS DE SUS INFORMES LAS 24 HS.
            </p>
            <p className="mt-3 text-sm text-slate-200">
              Horario de atención Lunes a viernes de 8 a 17hs
            </p>
            <p className="mt-2 text-sm text-slate-100">
              <a
                href="https://wa.me/5493534138946"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline decoration-white/70 underline-offset-4 transition hover:text-white"
              >
                Whatsapp: 3534138946
              </a>
            </p>
          </div>
        </div>
      </section>

      <div className="public-soft-canvas">
        {/* Servicios principales */}
        <section
          className="py-16 md:py-20"
          aria-labelledby="services-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2
                id="services-heading"
                className="text-3xl md:text-4xl font-bold text-gray-950 mb-4"
              >
                Servicios del laboratorio patológico veterinario
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Cobertura diagnóstica con estudio anatomopatológico, citología,
                tinciones especiales e integración clínico-patológica para
                sostener decisiones con mayor confianza.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {services.map((service) => (
                <Card
                  key={service.title}
                  className="h-full border-vetneb-line/80 transition-shadow hover:shadow-md"
                >
                  <CardHeader>
                    <VisualIcon icon={service.icon} tone={service.tone} className="mb-2" />
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
          className="py-16 md:py-20"
          aria-labelledby="benefits-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2
                id="benefits-heading"
                className="text-3xl md:text-4xl font-bold text-gray-950 mb-4"
              >
                Trabajo interdisciplinario y criterio diagnóstico
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Colaboramos de forma permanente con equipos clínicos para evaluar
                lesiones, integrar contexto médico y reforzar la confianza
                diagnóstica antes de definir conductas de tratamiento.
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
          className="py-16 md:py-20"
          aria-labelledby="cta-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2
              id="cta-heading"
              className="text-3xl md:text-4xl font-bold mb-4 text-gray-950"
            >
              Seguimos trabajando en mejorar
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-lg text-gray-600">
              Agilizamos la recepción y entrega de informes, mantenemos
              trazabilidad durante todo el proceso y coordinamos con clínicas y
              profesionales para sostener decisiones terapéuticas con mayor
              claridad.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
              <Button
                asChild
                size="lg"
                className="w-full bg-gradient-to-r from-blue-700 to-teal-600 text-white shadow-[0_14px_35px_rgba(37,99,235,0.22)] hover:from-blue-800 hover:to-teal-700 sm:w-auto"
              >
                <Link href={ROUTES.login}>Ingresar al portal de informes</Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="w-full border border-blue-200 bg-white/80 font-semibold text-blue-900 shadow-sm backdrop-blur hover:bg-white hover:text-primary sm:w-auto"
              >
                <Link href={ROUTES.contacto}>Coordinar muestras y consultas</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
