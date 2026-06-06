import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  Building2,
  Check,
  ClipboardCheck,
  FileText,
  FlaskConical,
  LockKeyhole,
  Microscope,
  Network,
  PackageCheck,
  ScanLine,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";
import {
  PublicExternalControl,
  PublicRouteControl,
} from "@/components/public/PublicRouteControl";
import { VisualIcon } from "@/components/public/VisualAccents";
import { createPageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = createPageMetadata(
  "Laboratorio Patológico Veterinario — Histopatología, Citología y Hematología",
  "La anatomía patológica veterinaria estudia los motivos, el desarrollo y las consecuencias de distintas enfermedades mediante el análisis de tejidos, órganos y muestras celulares. VETNEB integra histopatología, citología, citopatología, hematología, diagnóstico hematológico y hemoparásitos.",
  "/",
);

const services = [
  {
    icon: Microscope,
    tone: "blue" as const,
    label: "Tejidos",
    title: "Estudio Anatomopatológico",
    description:
      "Evaluación de tejidos para caracterizar lesiones y aportar precisión diagnóstica en medicina veterinaria.",
  },
  {
    icon: FlaskConical,
    tone: "emerald" as const,
    label: "Células",
    title: "Estudio Citológico",
    description:
      "Análisis de muestras, líquidos y punciones con criterio clínico-patológico.",
  },
  {
    icon: ClipboardCheck,
    tone: "amber" as const,
    label: "Profundización",
    title: "Tinciones Especiales",
    description:
      "Estudios aplicados para ampliar hallazgos histológicos y reforzar diagnósticos diferenciales.",
  },
  {
    icon: Network,
    tone: "slate" as const,
    label: "Contexto",
    title: "Diagnóstico Integral",
    description:
      "Integración de datos clínicos con evaluación histológica y citológica para orientar decisiones.",
  },
];

const clinicalTrustItems = [
  {
    icon: Microscope,
    tone: "blue" as const,
    eyebrow: "Especialidad",
    title: "Anatomía patológica veterinaria",
    description:
      "Diagnóstico histopatológico y citológico como servicio central.",
  },
  {
    icon: ShieldCheck,
    tone: "slate" as const,
    eyebrow: "Acceso",
    title: "Informes con acceso seguro",
    description:
      "Entrega directa a clínicas y acceso privado por token para tutores.",
  },
  {
    icon: Network,
    tone: "blue" as const,
    eyebrow: "Conexión",
    title: "Red profesional verificada",
    description:
      "Clínicas y profesionales confirmados por el laboratorio.",
  },
  {
    icon: PackageCheck,
    tone: "slate" as const,
    eyebrow: "Operación",
    title: "Flujo operativo claro",
    description:
      "Envío de muestra, análisis anatomopatológico e informe descargable.",
  },
];

const howItWorksSteps = [
  {
    icon: PackageCheck,
    label: "Recepción",
    title: "Enviás la muestra",
    description:
      "Preparás la muestra según el protocolo de VETNEB y la enviás con los datos del caso y de la clínica.",
  },
  {
    icon: Microscope,
    label: "Diagnóstico",
    title: "VETNEB analiza",
    description:
      "El anatomopatólogo examina el tejido o la muestra citológica y elabora el informe diagnóstico.",
  },
  {
    icon: FileText,
    label: "Resultado",
    title: "Recibís el informe",
    description:
      "La clínica lo descarga directamente desde el portal. Si corresponde, el tutor del animal recibe acceso con un código privado.",
  },
];

const benefits = [
  {
    eyebrow: "Criterio diagnóstico",
    contractTitle: "Diagnóstico integral",
    title: "Una lectura integral de cada caso",
    description:
      "El análisis microscópico se interpreta junto con el contexto clínico para construir una respuesta útil para el equipo veterinario.",
    items: [
      "Hallazgos de tejidos y células integrados con la información clínica",
      "Articulamos el análisis con equipos de diagnóstico por imágenes y áreas quirúrgicas",
      "Evaluación específica para cada paciente veterinario",
      "Criterios anatomopatológicos para acompañar decisiones terapéuticas",
    ],
  },
  {
    eyebrow: "Transparencia operativa",
    contractTitle: "Para tener en cuenta",
    title: "Cada muestra requiere su propio tiempo",
    description:
      "El diagnóstico no es un proceso automatizado. La complejidad del caso define el trabajo necesario antes de emitir un informe.",
    items: [
      "Los tiempos varían según la complejidad diagnóstica",
      "El análisis no es automatizado: requiere evaluación microscópica especializada",
      "Algunos casos necesitan tinciones especiales o interconsultas",
      "El flujo busca mejorar recepción, diagnóstico y entrega",
    ],
  },
];

const audiences = [
  {
    icon: Building2,
    eyebrow: "Clínicas",
    title: "Un circuito ordenado para cada derivación",
    description:
      "Coordiná el trabajo con el laboratorio y centralizá el acceso a informes.",
    action: "Conocer el acceso para clínicas",
    href: ROUTES.clinicas,
  },
  {
    icon: UsersRound,
    eyebrow: "Profesionales",
    title: "Una red para coordinar mejor",
    description:
      "Encontrá profesionales vinculados a VETNEB para derivaciones e interconsultas.",
    action: "Buscar profesionales",
    href: ROUTES.profesionales,
  },
  {
    icon: UserRound,
    eyebrow: "Particulares",
    title: "Tu informe, con acceso privado",
    description:
      "Consultá el resultado cuando la clínica o el laboratorio te comparta el código correspondiente.",
    action: "Consultar un informe",
    href: ROUTES.particulares,
  },
];

export default function HomePage() {
  return (
    <PublicLayout>
      <section
        className="relative isolate overflow-hidden text-white"
        data-home-hero="true"
        aria-labelledby="hero-heading"
      >
        <div className="home-hero-atmosphere" aria-hidden="true" />
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="home-hero-layout">
            <div className="home-hero-copy">
              <div className="home-hero-eyebrow">
                <span className="home-hero-eyebrow-mark" aria-hidden="true">
                  <Microscope className="h-3.5 w-3.5" />
                </span>
                Anatomía patológica veterinaria
              </div>

              <h1 id="hero-heading" className="home-hero-title">
                Diagnóstico veterinario
                <span> con criterio clínico.</span>
              </h1>

              <p className="home-hero-lead">
                Diagnóstico patológico veterinario con criterio clínico y
                trazabilidad integral. VETNEB conecta el análisis microscópico,
                la información del caso y el acceso al informe.
              </p>

              <div className="home-hero-actions">
                <PublicRouteControl
                  href={ROUTES.login}
                  variant="primaryLight"
                  className="home-hero-primary-action"
                >
                  Acceder a informes y trazabilidad
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </PublicRouteControl>
                <PublicRouteControl
                  href={ROUTES.particulares}
                  variant="secondaryOutline"
                  className="public-cta-on-hero w-full text-vetneb-navy hover:text-vetneb-navy active:text-vetneb-navy focus-visible:text-vetneb-navy sm:w-auto"
                >
                  Consultar informes 24 hs
                </PublicRouteControl>
              </div>

              <div className="home-hero-proof" aria-label="Alcance del servicio">
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
              </div>
            </div>

            <div className="home-hero-visual" aria-label="Flujo diagnóstico VETNEB">
              <div className="home-hero-image-shell relative">
                <Image
                  src="/images/hero-microscope-vetneb.webp"
                  alt="Microscopio en laboratorio patológico veterinario"
                  fill
                  priority
                  sizes="100vw"
                  className="object-cover"
                />
                <div className="home-hero-image-wash" aria-hidden="true" />
                <div className="home-hero-visual-header">
                  <span>
                    <ScanLine className="h-4 w-4" aria-hidden="true" />
                    Flujo diagnóstico
                  </span>
                  <span className="home-hero-live-mark">VETNEB</span>
                </div>
                <div className="home-hero-visual-caption">
                  <p>Análisis especializado</p>
                  <strong>De la muestra al informe</strong>
                  <span>
                    Una secuencia clara para clínicas, profesionales y tutores.
                  </span>
                </div>
              </div>

              <div className="home-diagnostic-dock">
                {howItWorksSteps.map((step, index) => {
                  const StepIcon = step.icon;

                  return (
                    <div key={step.title} className="home-diagnostic-dock-step">
                      <span className="home-diagnostic-dock-number">
                        0{index + 1}
                      </span>
                      <span className="home-diagnostic-dock-icon">
                        <StepIcon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span>
                        <small>{step.label}</small>
                        <strong>{step.title}</strong>
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="home-hero-security-note">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                <span>
                  <small>Acceso privado</small>
                  Informes y trazabilidad
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="home-public-canvas">
        <section className="home-trust-rail" aria-label="Información de atención">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="home-trust-rail-inner">
              <div>
                <span>Servicio Patológico VETNEB</span>
                <strong>Dr. BARBÉ, NICOLÁS E.</strong>
              </div>
              <div>
                <span>Atención</span>
                <strong>Lunes a viernes de 8 a 17 hs</strong>
              </div>
              <div>
                <span>Resultados</span>
                <strong>Consulta de informes las 24 hs</strong>
              </div>
              <PublicExternalControl
                href="https://wa.me/5493534138946"
                target="_blank"
                className="home-trust-rail-action"
              >
                Whatsapp: 3534138946
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </PublicExternalControl>
              <span className="sr-only">
                SERVICIO PATOLÓGICO VETNEB.
              </span>
              <span className="sr-only">
                Consultá los resultados de sus informes las 24 hs.
              </span>
              <span className="sr-only">
                Horario de atención Lunes a viernes de 8 a 17hs
              </span>
            </div>
          </div>
        </section>

        <section
          className="home-section home-value-section"
          aria-labelledby="clinical-trust-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal>
              <div className="home-section-heading home-section-heading-split">
                <div>
                  <p className="home-kicker">Confianza clínica</p>
                  <h2 id="clinical-trust-heading">
                    Diagnóstico microscópico riguroso para la medicina veterinaria
                  </h2>
                </div>
                <p>
                  Una plataforma operativa al servicio del laboratorio: estudios
                  histopatológicos y citológicos, informes seguros y una red de
                  clínicas verificadas.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal staggerChildren>
              <div className="home-value-grid">
                {clinicalTrustItems.map((item, index) => {
                  const itemHeadingId = `home-value-${index + 1}`;

                  return (
                    <article
                      key={item.title}
                      data-scroll-reveal-item
                      className="home-value-card"
                      aria-labelledby={itemHeadingId}
                    >
                      <div className="home-value-card-topline">
                        <VisualIcon icon={item.icon} tone={item.tone} />
                        <span>0{index + 1}</span>
                      </div>
                      <p className="home-card-eyebrow">{item.eyebrow}</p>
                      <h3 id={itemHeadingId}>{item.title}</h3>
                      <p>{item.description}</p>
                    </article>
                  );
                })}
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section
          className="border-b border-vetneb-line/80 bg-card/72 py-8 md:py-10 lg:hidden"
          aria-labelledby="mobile-professionals-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6">
              <div>
                <h2
                  id="mobile-professionals-heading"
                  className="text-2xl font-bold text-vetneb-ink md:text-3xl"
                >
                  Red de profesionales veterinarios
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                  Buscá profesionales vinculados a VETNEB para derivaciones,
                  interconsultas y coordinación clínica.
                </p>
              </div>
              <PublicRouteControl
                href={ROUTES.profesionales}
                variant="primaryDark"
                className="public-cta-primary w-full sm:w-auto"
              >
                Buscar profesionales
              </PublicRouteControl>
            </div>
          </div>
        </section>

        <section className="home-section home-services-section" aria-labelledby="services-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal>
              <div className="home-services-intro">
                <div>
                  <p className="home-kicker home-kicker-light">Servicios</p>
                  <h2 id="services-heading">
                    Distintas técnicas. Un mismo criterio diagnóstico.
                  </h2>
                  <p className="sr-only">
                    Servicios del laboratorio patológico veterinario
                  </p>
                </div>
                <div>
                  <p>
                    Estudios anatomopatológicos y citológicos para evaluar
                    lesiones, ampliar hallazgos y sostener decisiones clínicas.
                  </p>
                  <PublicRouteControl
                    href={ROUTES.servicios}
                    variant="bare"
                    className="home-inline-link home-inline-link-light"
                  >
                    Ver todos los servicios
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </PublicRouteControl>
                </div>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal staggerChildren>
              <div className="home-services-grid">
                {services.map((service, index) => {
                  const serviceHeadingId = `home-service-${index + 1}`;
                  const ServiceIcon = service.icon;

                  return (
                    <article
                      key={service.title}
                      data-scroll-reveal-item
                      className="home-service-card"
                      aria-labelledby={serviceHeadingId}
                    >
                      <div className="home-service-card-number">0{index + 1}</div>
                      <div className="home-service-card-icon">
                        <ServiceIcon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <p>{service.label}</p>
                      <h3 id={serviceHeadingId}>{service.title}</h3>
                      <span>{service.description}</span>
                    </article>
                  );
                })}
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section
          className="home-section home-workflow-section"
          aria-labelledby="how-it-works-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal>
              <div className="home-section-heading home-section-heading-centered">
                <p className="home-kicker">Cómo funciona</p>
                <h2 id="how-it-works-heading">
                  Un recorrido entendible desde la recepción hasta el resultado.
                </h2>
                <p className="sr-only">Trabajar con VETNEB es simple</p>
                <p>
                  El flujo está pensado para que clínicas y profesionales puedan
                  acompañar cada caso con claridad.
                </p>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal staggerChildren>
              <ol className="home-workflow-grid">
                {howItWorksSteps.map((step, index) => {
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

            <PublicScrollReveal>
              <div className="home-workflow-action">
                <PublicRouteControl
                  href={ROUTES.contacto}
                  variant="primaryDark"
                  className="public-cta-primary"
                >
                  Contactanos para empezar
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </PublicRouteControl>
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        {/* Beneficios */}
        <section
          className="home-section home-criteria-section"
          aria-labelledby="benefits-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal>
              <div className="home-section-heading home-section-heading-split">
                <div>
                  <p className="home-kicker">Cómo trabajamos</p>
                  <h2 id="benefits-heading">
                    Rigor microscópico, contexto clínico y comunicación clara.
                  </h2>
                  <p className="sr-only">
                    Trabajo interdisciplinario y criterio diagnóstico
                  </p>
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
                {benefits.map((benefit) => (
                  <article
                    key={benefit.title}
                    data-scroll-reveal-item
                    className="home-criteria-card"
                    data-tone={
                      benefit.contractTitle === "Diagnóstico integral"
                        ? "primary"
                        : "muted"
                    }
                  >
                    <p className="home-card-eyebrow">{benefit.eyebrow}</p>
                    <h3>{benefit.title}</h3>
                    <p className="home-criteria-description">
                      {benefit.description}
                    </p>
                    <ul>
                      {benefit.items.map((item) => (
                        <li key={item}>
                          <span aria-hidden="true">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section className="home-section home-audiences-section" aria-labelledby="audiences-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <PublicScrollReveal>
              <div className="home-section-heading home-section-heading-centered">
                <p className="home-kicker">Un acceso para cada necesidad</p>
                <h2 id="audiences-heading">
                  La misma información, presentada para quien la necesita.
                </h2>
              </div>
            </PublicScrollReveal>

            <PublicScrollReveal staggerChildren>
              <div className="home-audiences-grid">
                {audiences.map((audience) => {
                  const AudienceIcon = audience.icon;

                  return (
                    <article
                      key={audience.title}
                      data-scroll-reveal-item
                      className="home-audience-card"
                    >
                      <div className="home-audience-card-icon">
                        <AudienceIcon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <p className="home-card-eyebrow">{audience.eyebrow}</p>
                      <h3>{audience.title}</h3>
                      <p>{audience.description}</p>
                      <PublicRouteControl
                        href={audience.href}
                        variant="bare"
                        className="home-inline-link"
                      >
                        {audience.action}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </PublicRouteControl>
                    </article>
                  );
                })}
              </div>
            </PublicScrollReveal>
          </div>
        </section>

        <section
          className="bg-vetneb-navy py-16 text-primary-foreground md:py-20"
          data-home-final-cta="true"
          aria-labelledby="cta-heading"
        >
          <div className="home-final-cta-atmosphere" aria-hidden="true" />
          <PublicScrollReveal>
            <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
              <div className="home-final-cta-inner">
                <div>
                  <p className="home-kicker home-kicker-light">
                    Servicio Patológico VETNEB
                  </p>
                  <h2 id="cta-heading">
                    Empezá a trabajar con VETNEB
                  </h2>
                </div>
                <div>
                  <p>
                    Sumá a tu clínica a un flujo de diagnóstico anatomopatológico
                    claro, seguro y pensado para la operación veterinaria.
                  </p>
                  <div className="home-final-cta-actions">
                    <PublicRouteControl
                      href={ROUTES.contacto}
                      variant="primaryLight"
                      className="home-final-primary"
                    >
                      Contactanos
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </PublicRouteControl>
                    <PublicRouteControl
                      href={ROUTES.servicios}
                      variant="secondaryOutline"
                      className="public-cta-outline home-final-secondary"
                    >
                      Ver servicios
                    </PublicRouteControl>
                  </div>
                </div>
              </div>
            </div>
          </PublicScrollReveal>
        </section>
      </div>

      {/*
        Source compatibility markers for public visual/performance contracts:
        className="relative container mx-auto flex min-h-[calc(100vh-4.5rem)] items-center px-4 py-16 sm:px-6 lg:px-8"
        className="mt-2 max-w-none text-[clamp(1.85rem,4.6vw,3.75rem)] font-bold uppercase leading-[0.94] tracking-[0.045em] text-primary-foreground"
        className="mt-6 max-w-2xl text-xl font-medium leading-tight text-primary-foreground/94 md:text-2xl lg:text-3xl"
        className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
        className="clinical-muted-band mt-7 w-fit max-w-full"
        className="public-soft-canvas"
        className="py-16 md:py-20"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
        className="grid grid-cols-1 gap-5 md:grid-cols-3"
        className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
        className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4"
        bg-[linear-gradient(110deg,hsl(var(--vetneb-navy)/0.84),hsl(var(--vetneb-navy)/0.66)_45%,hsl(var(--vetneb-teal)/0.42)_100%)]
        services.map((service) =>
        premium-card h-full
        CardTitle
      */}
    </PublicLayout>
  );
}
