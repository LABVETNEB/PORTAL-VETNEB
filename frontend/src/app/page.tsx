import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ClipboardCheck, FlaskConical, Microscope, Network } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";
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
            src="/images/hero-microscope-vetneb.webp"
            alt="Microscopio en laboratorio patológico veterinario"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>
        <div
          className="absolute inset-0 bg-[linear-gradient(110deg,hsl(var(--vetneb-navy)/0.84),hsl(var(--vetneb-navy)/0.66)_45%,hsl(var(--vetneb-teal)/0.42)_100%)]"
          aria-hidden="true"
        />
        <div className="relative container mx-auto flex min-h-[calc(100vh-4.5rem)] items-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid w-full items-center gap-10">
            <div className="max-w-5xl">
                            <h1
                id="hero-heading"
                className="mt-2 max-w-none text-[clamp(1.85rem,4.6vw,3.75rem)] font-bold uppercase leading-[0.94] tracking-[0.045em] text-primary-foreground"
              >
                SERVICIO PATOLÓGICO VETNEB
              </h1>
              <p className="mt-6 max-w-2xl text-xl font-medium leading-tight text-primary-foreground/94 md:text-2xl lg:text-3xl">
                Diagnóstico patológico veterinario con criterio clínico y
                trazabilidad integral
              </p>
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-primary-foreground/92 md:text-base">
                Anatomía patológica, citología y tinciones especiales con
                seguimiento continuo para clínicas y profesionales en una
                superficie institucional y confiable.
              </p>
              <p className="mt-4 text-sm font-medium text-primary-foreground/86 md:text-base">
                Dr. BARBÉ, NICOLÁS E.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  asChild
                  size="lg"
                  className="public-cta-primary w-full sm:w-auto"
                >
                  <Link href={ROUTES.login}>Acceder a informes y trazabilidad</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="public-cta-on-hero w-full sm:w-auto"
                >
                  <Link href={ROUTES.particulares}>Consultar informes 24 hs</Link>
                </Button>
              </div>

              <div className="clinical-muted-band mt-7 w-fit max-w-full rounded-lg px-4 py-3 text-vetneb-navy">
                <p className="text-sm font-semibold">
                  Consultá los resultados de sus informes las 24 hs.
                </p>
                <p className="mt-1 text-xs text-vetneb-navy/90">
                  Horario de atención Lunes a viernes de 8 a 17hs
                </p>
                <p className="mt-1 text-xs">
                  <a
                    href="https://wa.me/5493534138946"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline decoration-vetneb-navy/55 underline-offset-4 transition hover:text-vetneb-teal"
                  >
                    Whatsapp: 3534138946
                  </a>
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      <div className="public-soft-canvas">
        {/* Servicios principales */}
        <section
          className="py-16 md:py-20"
          aria-labelledby="services-heading"
        >
          <PublicScrollReveal>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2
                  id="services-heading"
                  className="text-3xl font-bold text-vetneb-ink md:text-4xl mb-4"
                >
                  Servicios del laboratorio patológico veterinario
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Cobertura diagnóstica con estudio anatomopatológico, citología,
                  tinciones especiales e integración clínico-patológica para
                  sostener decisiones con mayor confianza.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {services.map((service) => (
                  <Card
                    key={service.title}
                    className="premium-card h-full"
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
          </PublicScrollReveal>
        </section>

        {/* Beneficios */}
        <section
          className="py-16 md:py-20"
          aria-labelledby="benefits-heading"
        >
          <PublicScrollReveal>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2
                  id="benefits-heading"
                  className="text-3xl md:text-4xl font-bold text-vetneb-ink mb-4"
                >
                  Trabajo interdisciplinario y criterio diagnóstico
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Colaboramos de forma permanente con equipos clínicos para evaluar
                  lesiones, integrar contexto médico y reforzar la confianza
                  diagnóstica antes de definir conductas de tratamiento.
                </p>
              </div>
              <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                {benefits.map((benefit) => (
                  <Card key={benefit.title} className="premium-card h-full">
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
                            <span className="text-sm text-muted-foreground">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </PublicScrollReveal>
        </section>

        {/* CTA final */}
        <section
          className="py-16 md:py-20"
          aria-labelledby="cta-heading"
        >
          <PublicScrollReveal>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2
                id="cta-heading"
                className="text-3xl md:text-4xl font-bold mb-4 text-vetneb-ink"
              >
                Seguimos trabajando en mejorar
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
                Agilizamos la recepción y entrega de informes, mantenemos
                trazabilidad durante todo el proceso y coordinamos con clínicas y
                profesionales para sostener decisiones terapéuticas con mayor
                claridad.
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
                <Button
                  asChild
                  size="lg"
                  className="public-cta-primary w-full sm:w-auto"
                >
                  <Link href={ROUTES.login}>Ingresar al portal de informes</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="public-cta-outline w-full sm:w-auto"
                >
                  <Link href={ROUTES.contacto}>Coordinar muestras y consultas</Link>
                </Button>
              </div>
            </div>
          </PublicScrollReveal>
        </section>
      </div>
    </PublicLayout>
  );
}
