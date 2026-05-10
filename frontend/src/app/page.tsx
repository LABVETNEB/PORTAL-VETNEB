import type { Metadata } from "next";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createPageMetadata, getOrganizationJsonLd, SITE_URL } from "@/lib/seo";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = createPageMetadata(
  "Portal VETNEB — Laboratorio Patológico Veterinario",
  "Laboratorio patológico veterinario para clínicas y profesionales: histopatología, citología, citopatología, hematología, diagnóstico hematológico, hemoparásitos e informes digitales.",
  "/",
);

const services = [
  {
    icon: "📋",
    title: "Informes Médicos",
    description:
      "Acceso digital seguro a resultados de estudios veterinarios. Descarga, seguimiento y gestión de informes en tiempo real.",
  },
  {
    icon: "🔬",
    title: "Estudios Veterinarios",
    description:
      "Hemogramas, bioquímicas, uroanálisis, estudios de imagen y más. Resultados precisos con trazabilidad completa.",
  },
  {
    icon: "🏥",
    title: "Gestión Digital",
    description:
      "Portal centralizado para clínicas. Administración de pacientes, historial de estudios y comunicación directa con el laboratorio.",
  },
  {
    icon: "🚐",
    title: "Logística Operativa",
    description:
      "Planificación de rutas, visitas de campo y seguimiento en tiempo real. Optimización de la cadena de entrega de resultados.",
  },
];

const benefits = [
  {
    title: "Para clínicas veterinarias",
    items: [
      "Acceso inmediato a resultados de estudios",
      "Historial completo de pacientes",
      "Notificaciones de estado en tiempo real",
      "Descarga segura de informes en PDF",
    ],
  },
  {
    title: "Para profesionales",
    items: [
      "Plataforma centralizada de gestión",
      "Seguimiento de casos clínicos",
      "Comunicación directa con el laboratorio",
      "Acceso desde cualquier dispositivo",
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
              Laboratorio patológico veterinario
            </div>
            <h1
              id="hero-heading"
              className="mb-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl"
            >
              Diagnóstico patológico de
              <span className="text-blue-300"> laboratorio veterinario</span>
            </h1>
            <p className="mb-8 max-w-2xl text-lg leading-relaxed text-blue-100 md:text-xl">
              Portal centralizado para clínicas y profesionales veterinarios.
              Acceda a informes, estudios y logística operativa desde un único
              lugar seguro y confiable.
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
              Una plataforma completa para la gestión de diagnóstico veterinario
              y operaciones de laboratorio.
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
              Diseñado para el sector veterinario
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Herramientas específicas para clínicas y profesionales que
              necesitan eficiencia y confiabilidad.
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
            ¿Listo para digitalizar su laboratorio?
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-blue-100">
            Únase a las clínicas y profesionales que ya gestionan sus estudios
            veterinarios de forma digital con Portal VETNEB.
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
