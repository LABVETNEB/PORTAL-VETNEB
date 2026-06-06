import type { Metadata } from "next";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Microscope,
  MonitorCheck,
  Network,
  PackageCheck,
  Sparkles,
} from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { VisualIcon } from "@/components/public/VisualAccents";
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
    href: "/histopatologia-veterinaria",
    linkLabel: "Ver histopatología veterinaria",
    description:
      "Evaluación de tejidos y órganos para estudiar motivos, desarrollo y consecuencias de enfermedades en pacientes veterinarios.",
    features: [
      "Recepción y procesamiento de muestras de tejidos",
      "Evaluación microscópica de lesiones histológicas",
      "Correlación anatomopatológica del caso clínico",
      "Informe diagnóstico con hallazgos relevantes",
    ],
    size: "wide" as const,
    number: "01",
  },
  {
    id: "citologia",
    title: "Estudio citológico de muestras",
    icon: FlaskConical,
    href: "/citologia-veterinaria",
    linkLabel: "Ver citología veterinaria",
    description:
      "Análisis citológico de líquidos y punciones para valorar alteraciones celulares con un enfoque clínico-patológico.",
    features: [
      "Estudio de líquidos y punciones",
      "Valoración celular orientada a diagnóstico",
      "Identificación de patrones inflamatorios",
      "Informe citológico con conclusión profesional",
    ],
    size: "narrow" as const,
    number: "02",
  },
  {
    id: "tinciones",
    title: "Tinciones especiales aplicadas",
    icon: Sparkles,
    href: "/laboratorio-patologico-veterinario",
    linkLabel: "Ver laboratorio patológico veterinario",
    description:
      "Aplicación de tinciones especiales para ampliar hallazgos histológicos y reforzar diagnósticos diferenciales.",
    features: [
      "Selección de técnicas según complejidad",
      "Caracterización adicional de lesiones",
      "Soporte para diagnósticos diferenciales",
      "Registro diagnóstico trazable",
    ],
    size: "narrow" as const,
    number: "03",
  },
  {
    id: "integral",
    title: "Diagnóstico integral interdisciplinario",
    icon: Network,
    href: "/laboratorio-patologico-veterinario",
    linkLabel: "Ver laboratorio patológico veterinario",
    description:
      "Integración del análisis histológico y citológico con información clínica para construir un diagnóstico específico por paciente.",
    features: [
      "Integración histológica y citológica",
      "Trabajo conjunto con diagnóstico por imágenes",
      "Articulación con cirugía y clínica veterinaria",
      "Definición diagnóstica específica por paciente",
    ],
    size: "wide" as const,
    number: "04",
  },
  {
    id: "informes",
    title: "Informes y seguimiento",
    icon: MonitorCheck,
    href: "/informes-veterinarios",
    linkLabel: "Ver informes veterinarios",
    description:
      "Entrega y seguimiento de informes con comunicación continua para clínicas y profesionales durante todo el proceso diagnóstico.",
    features: [
      "Consulta de resultados las 24 hs",
      "Seguimiento del estado del estudio",
      "Comunicación directa para coordinación",
      "Entrega con criterio profesional",
    ],
    size: "full" as const,
    number: "05",
  },
];

const workflowSteps = [
  {
    icon: PackageCheck,
    label: "Recepción",
    title: "Envío de la muestra",
    description:
      "La clínica prepara la muestra según el protocolo de VETNEB y la envía con los datos del caso.",
  },
  {
    icon: Microscope,
    label: "Diagnóstico",
    title: "Análisis anatomopatológico",
    description:
      "El anatomopatólogo examina el tejido o la muestra citológica y elabora el informe diagnóstico con criterio clínico.",
  },
  {
    icon: FileText,
    label: "Resultado",
    title: "Informe disponible",
    description:
      "La clínica descarga el informe desde el portal. El tutor puede acceder con código privado cuando corresponda.",
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

      {/* Hero superpremium dos columnas */}
      <section
        className="public-secondary-hero-surface text-white"
        aria-labelledby="services-page-title"
      >
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sec-hero-layout">
            <div className="sec-hero-copy">
              <div className="sec-hero-eyebrow">
                <span className="sec-hero-eyebrow-dot" aria-hidden="true" />
                Anatomía patológica veterinaria
              </div>

              <h1 id="services-page-title" className="sec-hero-title">
                Servicio diagnóstico patológico
              </h1>

              <p className="sec-hero-lead">
                Histopatología, citología, tinciones especiales y diagnóstico
                integral para orientar decisiones clínicas con respaldo
                profesional en medicina veterinaria.
              </p>

              <div className="sec-hero-scope">
                <span>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Histopatología
                </span>
                <span>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Citología
                </span>
                <span>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Tinciones especiales
                </span>
                <span>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Diagnóstico integral
                </span>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <PublicRouteControl
                  href={ROUTES.contacto}
                  variant="primaryLight"
                  className="public-cta-primary home-hero-primary-action"
                >
                  Coordinar con el laboratorio
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </PublicRouteControl>
                <PublicRouteControl
                  href={ROUTES.clinicas}
                  variant="secondaryOutline"
                  className="home-hero-secondary-action"
                >
                  Acceso para clínicas
                </PublicRouteControl>
              </div>
            </div>

            {/* Panel flotante derecha: catálogo */}
            <div className="sec-hero-panel" aria-label="Catálogo diagnóstico VETNEB">
              <div className="sec-hero-panel-header">
                <span>Catálogo diagnóstico</span>
                <span className="sec-hero-panel-badge">VETNEB</span>
              </div>
              <div>
                <div className="sec-hero-panel-row">
                  <span className="sec-hero-panel-icon">
                    <Microscope className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <p className="sec-hero-panel-label">Histopatología</p>
                    <p className="sec-hero-panel-value">Estudio anatomopatológico de tejidos</p>
                  </span>
                </div>
                <div className="sec-hero-panel-row">
                  <span className="sec-hero-panel-icon">
                    <FlaskConical className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <p className="sec-hero-panel-label">Citología</p>
                    <p className="sec-hero-panel-value">Análisis de líquidos y punciones</p>
                  </span>
                </div>
                <div className="sec-hero-panel-row">
                  <span className="sec-hero-panel-icon">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <p className="sec-hero-panel-label">Tinciones especiales</p>
                    <p className="sec-hero-panel-value">Técnicas complementarias aplicadas</p>
                  </span>
                </div>
                <div className="sec-hero-panel-row">
                  <span className="sec-hero-panel-icon">
                    <Network className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <p className="sec-hero-panel-label">Diagnóstico integral</p>
                    <p className="sec-hero-panel-value">Integración clínica y anatomopatológica</p>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Catálogo en grilla bento oscura */}
      <section
        data-services-polished="true"
        className="sec-catalogue-section"
        aria-labelledby="services-categories-heading"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <PublicScrollReveal variant="section">
            <div className="sec-section-heading mb-10">
              <p className="home-kicker home-kicker-light">Catálogo diagnóstico</p>
              <h2
                id="services-categories-heading"
                className="mt-3 text-white"
              >
                Distintas técnicas. Un mismo criterio.
              </h2>
            </div>
          </PublicScrollReveal>

          <PublicScrollReveal variant="cards" staggerChildren>
            <div className="sec-bento-grid">
              {serviceCategories.map((service) => {
                const ServiceIcon = service.icon;

                return (
                  <article
                    key={service.id}
                    data-scroll-reveal-item
                    data-size={service.size}
                    className="sec-bento-card"
                    aria-labelledby={`service-bento-${service.id}`}
                  >
                    <div
                      className={
                        service.size === "full"
                          ? "flex items-start gap-5"
                          : undefined
                      }
                    >
                      <div
                        className={
                          service.size === "full" ? "shrink-0" : undefined
                        }
                      >
                        {service.size !== "full" && (
                          <div className="sec-bento-card-number">{service.number}</div>
                        )}
                        <div className="sec-bento-card-icon">
                          <ServiceIcon className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <p className="sec-bento-eyebrow">{service.number}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3
                          id={`service-bento-${service.id}`}
                          className="sec-bento-title"
                        >
                          {service.title}
                        </h3>
                        <span className="sec-bento-desc">{service.description}</span>
                        <ul
                          className="sec-bento-list"
                          aria-label={`Aspectos de ${service.title}`}
                        >
                          {service.features.map((feature) => (
                            <li key={feature}>{feature}</li>
                          ))}
                        </ul>
                        <PublicRouteControl
                          href={service.href}
                          variant="bare"
                          className="sec-bento-link"
                        >
                          <span className="sr-only">{service.linkLabel}</span>
                          <span aria-hidden="true">Ver más</span>
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </PublicRouteControl>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </PublicScrollReveal>
        </div>
      </section>

      {/* Canvas secciones editoriales */}
      <div className="sec-page-canvas">
        {/* Flujo de trabajo */}
        <section
          className="sec-page-section border-b border-vetneb-line/40"
          aria-labelledby="services-workflow-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal>
              <div className="home-section-heading home-section-heading-centered">
                <p className="home-kicker">Cómo funciona</p>
                <h2 id="services-workflow-heading">
                  De la muestra al informe.
                </h2>
                <p>
                  Un recorrido entendible desde la recepción hasta el resultado
                  diagnóstico.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal staggerChildren>
              <ol
                className="home-workflow-grid mx-auto max-w-5xl"
              >
                {workflowSteps.map((step, index) => {
                  const StepIcon = step.icon;

                  return (
                    <li key={step.title} data-scroll-reveal-item>
                      <div className="home-workflow-marker">
                        <span>0{index + 1}</span>
                        <StepIcon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <p>{step.label}</p>
                      <h3>{step.title}</h3>
                      <span>{step.description}</span>
                    </li>
                  );
                })}
              </ol>
            </PublicScrollReveal>
          </div>
        </section>

        {/* Paneles editoriales: criterio + transparencia */}
        <section
          className="sec-page-section"
          aria-labelledby="services-criteria-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal>
              <div className="home-section-heading home-section-heading-split">
                <div>
                  <p className="home-kicker">Cómo trabajamos</p>
                  <h2 id="services-criteria-heading">
                    Rigor microscópico y contexto clínico.
                  </h2>
                </div>
                <p>
                  La calidad del diagnóstico también depende de explicar el
                  proceso con honestidad: cada muestra es distinta y puede
                  requerir instancias adicionales.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal staggerChildren>
              <div className="home-criteria-grid">
                <article
                  data-scroll-reveal-item
                  className="home-criteria-card"
                  data-tone="primary"
                  aria-labelledby="services-integral-h"
                >
                  <p className="home-card-eyebrow">Criterio diagnóstico</p>
                  <h3 id="services-integral-h">
                    Una lectura integral de cada caso
                  </h3>
                  <p className="home-criteria-description">
                    El análisis microscópico se interpreta junto con el contexto
                    clínico para construir una respuesta útil para el equipo
                    veterinario.
                  </p>
                  <ul>
                    {[
                      "Hallazgos de tejidos y células integrados con la información clínica",
                      "Articulamos el análisis con diagnóstico por imágenes y cirugía",
                      "Evaluación específica para cada paciente veterinario",
                      "Criterios anatomopatológicos para acompañar decisiones terapéuticas",
                    ].map((item) => (
                      <li key={item}>
                        <span aria-hidden="true">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>

                <article
                  data-scroll-reveal-item
                  className="home-criteria-card"
                  data-tone="muted"
                  aria-labelledby="services-transparency-h"
                >
                  <p className="home-card-eyebrow">Transparencia operativa</p>
                  <h3 id="services-transparency-h">
                    Cada muestra requiere su propio tiempo
                  </h3>
                  <p className="home-criteria-description">
                    El diagnóstico no es automatizado. La complejidad del caso
                    define el trabajo necesario antes de emitir un informe.
                  </p>
                  <ul>
                    {[
                      "Los tiempos varían según la complejidad diagnóstica",
                      "El análisis requiere evaluación microscópica especializada",
                      "Algunos casos necesitan tinciones especiales o interconsultas",
                      "El flujo busca mejorar recepción, diagnóstico y entrega",
                    ].map((item) => (
                      <li key={item}>
                        <span aria-hidden="true">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        {/* Valores del servicio */}
        <section
          className="sec-page-section pt-0"
          aria-labelledby="services-values-heading"
        >
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="minimal">
              <div className="clinical-muted-band rounded-2xl p-7 clinical-surface-shadow">
                <div className="flex items-start gap-4">
                  <VisualIcon
                    icon={ClipboardCheck}
                    tone="emerald"
                    className="h-12 w-12 shrink-0 rounded-xl"
                  />
                  <div>
                    <h2
                      id="services-values-heading"
                      className="text-2xl font-bold text-vetneb-ink"
                    >
                      Valores que guían el servicio
                    </h2>
                    <p className="mt-3 public-copy text-muted-foreground">
                      Basamos nuestro trabajo en compromiso, seriedad, respeto,
                      responsabilidad, confianza, diálogo, criterio clínico y
                      ética profesional. Queremos ser un laboratorio de anatomía
                      patológica veterinaria confiable, comprometido con la
                      calidad diagnóstica y con el bienestar animal en cada caso
                      que recibimos.
                    </p>
                  </div>
                </div>
              </div>
            </PublicScrollReveal>
          </div>
        </section>
      </div>

      {/* CTA final */}
      <section
        className="sec-page-cta"
        aria-labelledby="services-cta-heading"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <PublicScrollReveal>
            <div className="sec-page-cta-inner">
              <div>
                <p className="home-kicker home-kicker-light">
                  Servicio Patológico VETNEB
                </p>
                <h2 id="services-cta-heading">
                  Coordiná una derivación hoy.
                </h2>
              </div>
              <div>
                <p>
                  Coordiná el envío de muestras y accedé a informes
                  diagnósticos desde el portal. Sin intermediarios, con
                  trazabilidad completa.
                </p>
                <div className="sec-page-cta-actions">
                  <PublicRouteControl
                    href={ROUTES.contacto}
                    variant="primaryLight"
                    className="home-final-primary"
                  >
                    Contactanos
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </PublicRouteControl>
                  <PublicRouteControl
                    href={ROUTES.clinicas}
                    variant="secondaryOutline"
                    className="home-final-secondary"
                  >
                    Acceso para clínicas
                  </PublicRouteControl>
                </div>
              </div>
            </div>
          </PublicScrollReveal>
        </div>
      </section>
    </PublicLayout>
  );
}
