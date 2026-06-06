import type { Metadata } from "next";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  FileText,
  Globe2,
  Search,
  ShieldCheck,
  Truck,
  UsersRound,
} from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";
import { VisualIcon } from "@/components/public/VisualAccents";
import { createPageMetadata, getClinicasPageJsonLd } from "@/lib/seo";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = createPageMetadata(
  "Portal para Clínicas Veterinarias",
  "Acceso al portal de gestión para clínicas veterinarias. Informes, seguimiento de estudios, logística y auditoría desde un único lugar.",
  "/clinicas",
);

const features = [
  {
    icon: FileText,
    tone: "blue" as const,
    title: "Recepción de informes",
    description:
      "Reciba los resultados de estudios directamente en su portal. Notificaciones automáticas cuando un informe esté listo.",
    size: "wide" as const,
    number: "01",
  },
  {
    icon: Search,
    tone: "emerald" as const,
    title: "Búsqueda avanzada",
    description:
      "Encuentre informes por paciente, tipo de estudio, fecha o estado. Filtros potentes para gestionar grandes volúmenes.",
    size: "narrow" as const,
    number: "02",
  },
  {
    icon: Truck,
    tone: "amber" as const,
    title: "Seguimiento de logística",
    description:
      "Vea el estado de las visitas de campo y entregas programadas para su clínica. Transparencia total en el proceso.",
    size: "narrow" as const,
    number: "03",
  },
  {
    icon: ShieldCheck,
    tone: "blue" as const,
    title: "Acceso seguro y auditado",
    description:
      "Cada acceso a informes queda registrado. Control total sobre quién accede a qué información y cuándo.",
    size: "wide" as const,
    number: "04",
  },
  {
    icon: UsersRound,
    tone: "slate" as const,
    title: "Gestión de usuarios",
    description:
      "Administre los usuarios de su clínica con roles diferenciados: propietario y personal de clínica.",
    size: "half" as const,
    number: "05",
  },
  {
    icon: Globe2,
    tone: "emerald" as const,
    title: "Perfil público",
    description:
      "Mantenga actualizado el perfil público de su clínica en el directorio de Portal VETNEB.",
    size: "half" as const,
    number: "06",
  },
];

const steps = [
  {
    number: "01",
    title: "Solicite acceso",
    description:
      "Complete el formulario de contacto para registrar su clínica en Portal VETNEB.",
  },
  {
    number: "02",
    title: "Configure su cuenta",
    description:
      "Reciba sus credenciales y configure los usuarios de su equipo con los roles apropiados.",
  },
  {
    number: "03",
    title: "Acceda a sus informes",
    description:
      "Desde el dashboard privado, acceda a todos los informes y estudios de su clínica.",
  },
  {
    number: "04",
    title: "Gestione su operación",
    description:
      "Utilice las herramientas de seguimiento, logística y auditoría para optimizar su práctica.",
  },
];

export default function ClinicasPage() {
  const jsonLd = getClinicasPageJsonLd();

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero superpremium dos columnas */}
      <section
        className="public-secondary-hero-surface text-white"
        aria-labelledby="clinicas-page-title"
      >
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sec-hero-layout">
            <div className="sec-hero-copy">
              <div className="sec-hero-eyebrow">
                <span className="sec-hero-eyebrow-dot" aria-hidden="true" />
                Acceso institucional
              </div>

              <h1 id="clinicas-page-title" className="sec-hero-title">
                Portal para clínicas veterinarias
              </h1>

              <p className="sec-hero-lead">
                Gestión centralizada de informes, estudios y logística para su
                clínica veterinaria. Acceso seguro, trazable y disponible las 24 hs.
              </p>

              <div className="sec-hero-scope">
                <span>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Informes en tiempo real
                </span>
                <span>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Trazabilidad completa
                </span>
                <span>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Logística integrada
                </span>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <PublicRouteControl
                  href={ROUTES.login}
                  variant="primaryLight"
                  className="public-cta-on-hero w-full sm:w-auto"
                >
                  Acceder al portal
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </PublicRouteControl>
                <PublicRouteControl
                  href={ROUTES.contacto}
                  variant="secondaryOutline"
                  className="w-full sm:w-auto"
                >
                  Solicitar acceso
                </PublicRouteControl>
              </div>
            </div>

            {/* Panel flotante derecha: capacidades del portal */}
            <div className="sec-hero-panel" aria-label="Capacidades del portal VETNEB">
              <div className="sec-hero-panel-header">
                <span>Portal clínico</span>
                <span className="sec-hero-panel-badge">VETNEB</span>
              </div>
              <div>
                <div className="sec-hero-panel-row">
                  <span className="sec-hero-panel-icon">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <p className="sec-hero-panel-label">Informes</p>
                    <p className="sec-hero-panel-value">Recepción y descarga de resultados</p>
                  </span>
                </div>
                <div className="sec-hero-panel-row">
                  <span className="sec-hero-panel-icon">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <p className="sec-hero-panel-label">Trazabilidad</p>
                    <p className="sec-hero-panel-value">Acceso auditado y controlado</p>
                  </span>
                </div>
                <div className="sec-hero-panel-row">
                  <span className="sec-hero-panel-icon">
                    <Truck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <p className="sec-hero-panel-label">Logística</p>
                    <p className="sec-hero-panel-value">Seguimiento de visitas y entregas</p>
                  </span>
                </div>
                <div className="sec-hero-panel-row">
                  <span className="sec-hero-panel-icon">
                    <UsersRound className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <p className="sec-hero-panel-label">Usuarios</p>
                    <p className="sec-hero-panel-value">Roles diferenciados por clínica</p>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Canvas secciones editoriales */}
      <div className="sec-page-canvas">
        {/* Funcionalidades: bento light */}
        <section
          className="sec-page-section"
          aria-labelledby="clinicas-features-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal variant="section">
              <div className="home-section-heading home-section-heading-split">
                <div>
                  <p className="home-kicker">Funcionalidades</p>
                  <h2 id="clinicas-features-heading">
                    Todo lo que necesita su clínica.
                  </h2>
                </div>
                <p>
                  Un sistema claro, trazable y preparado para el trabajo
                  diario con informes y coordinación de muestras de alto
                  volumen.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal variant="cards" staggerChildren>
              <div className="sec-bento-grid-light">
                {features.map((feature) => {
                  const FeatureIcon = feature.icon;

                  return (
                    <article
                      key={feature.title}
                      data-scroll-reveal-item
                      data-size={feature.size}
                      className="sec-bento-card-light"
                      aria-labelledby={`clinicas-feature-${feature.number}`}
                    >
                      <VisualIcon
                        icon={FeatureIcon}
                        tone={feature.tone}
                        className="mb-4 h-11 w-11 rounded-xl"
                      />
                      <h3
                        id={`clinicas-feature-${feature.number}`}
                        className="sec-bento-title"
                      >
                        {feature.title}
                      </h3>
                      <p className="sec-bento-desc">{feature.description}</p>
                    </article>
                  );
                })}
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        {/* Onboarding: steps */}
        <section
          className="sec-page-section border-t border-vetneb-line/30"
          aria-labelledby="clinicas-onboarding-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal>
              <div className="home-section-heading home-section-heading-centered">
                <p className="home-kicker">Cómo comenzar</p>
                <h2 id="clinicas-onboarding-heading">
                  En cuatro pasos.
                </h2>
                <p>
                  El proceso de incorporación está diseñado para ser rápido y
                  claro desde la solicitud hasta el acceso operativo.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal staggerChildren>
              <ol
                className="sec-step-list mx-auto"
                style={{ maxWidth: "44rem" }}
                aria-label="Pasos para comenzar con el portal clínico"
              >
                {steps.map((step) => (
                  <li
                    key={step.number}
                    data-scroll-reveal-item
                    className="sec-step-item"
                    aria-labelledby={`clinicas-step-${step.number}`}
                  >
                    <div className="sec-step-marker" aria-hidden="true">
                      {step.number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="sec-step-label">Paso {step.number}</p>
                      <h3
                        id={`clinicas-step-${step.number}`}
                        className="sec-step-title"
                      >
                        {step.title}
                      </h3>
                      <p className="sec-step-desc">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </PublicScrollReveal>

            {/* Banner acceso seguro */}
            <PublicScrollReveal variant="minimal">
              <section
                className="clinical-muted-band mx-auto mt-12 max-w-3xl rounded-2xl p-6 clinical-surface-shadow"
                aria-labelledby="clinicas-secure-access-heading"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <VisualIcon
                      icon={ClipboardCheck}
                      tone="emerald"
                      className="h-11 w-11 shrink-0 rounded-xl"
                    />
                    <div>
                      <h3
                        id="clinicas-secure-access-heading"
                        className="font-semibold text-vetneb-ink"
                      >
                        Acceso clínico seguro
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Credenciales separadas del acceso particular por token.
                      </p>
                    </div>
                  </div>
                  <PublicRouteControl
                    href={ROUTES.login}
                    variant="primaryDark"
                    className="public-cta-primary shrink-0"
                  >
                    Ingresar
                  </PublicRouteControl>
                </div>
              </section>
            </PublicScrollReveal>
          </div>
        </section>
      </div>

      {/* CTA final */}
      <section
        className="sec-page-cta"
        aria-labelledby="clinicas-cta-heading"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <PublicScrollReveal>
            <div className="sec-page-cta-inner">
              <div>
                <p className="home-kicker home-kicker-light">Portal VETNEB</p>
                <h2 id="clinicas-cta-heading">
                  Su clínica conectada al laboratorio.
                </h2>
              </div>
              <div>
                <p>
                  Solicite su acceso y empiece a gestionar informes,
                  trazabilidad y logística desde un único portal seguro.
                </p>
                <div className="sec-page-cta-actions">
                  <PublicRouteControl
                    href={ROUTES.contacto}
                    variant="primaryLight"
                    className="home-final-primary"
                  >
                    Solicitar acceso
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </PublicRouteControl>
                  <PublicRouteControl
                    href={ROUTES.login}
                    variant="secondaryOutline"
                    className="home-final-secondary"
                  >
                    Acceder al portal
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
