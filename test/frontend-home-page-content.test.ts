import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const HOME_PAGE_PATH = "frontend/src/app/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function count(source: string, pattern: string): number {
  return source.split(pattern).length - 1;
}

function extractBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing start marker: ${start}`);

  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing end marker: ${end}`);

  return source.slice(startIndex, endIndex);
}

test("home page defines public metadata — organization JSON-LD is emitted by root layout", () => {
  const source = read(HOME_PAGE_PATH);

  // Metadata
  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { createPageMetadata } from "@/lib/seo";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Laboratorio Patológico Veterinario — Histopatología, Citología y Hematología"'));
  assert.ok(source.includes('"/"'));
  // Organization JSON-LD is injected by layout.tsx to avoid duplication on the home page
  assert.equal(source.includes("getOrganizationJsonLd"), false);
  assert.equal(source.includes("const jsonLd ="), false);
});

test("home page exposes accessible hero and primary CTAs", () => {
  const source = read(HOME_PAGE_PATH);

  // Estructura base del hero
  assert.ok(source.includes('aria-labelledby="hero-heading"'));
  assert.ok(source.includes('id="hero-heading"'));
  assert.ok(source.includes('src="/images/hero-microscope-vetneb.webp"'));
  assert.ok(source.includes('import Image from "next/image";'));
  assert.ok(source.includes("VETNEB"));

  // PR-10 — evidence-first hero
  assert.ok(source.includes("anatomopatológico"));
  assert.ok(source.includes("Dr. Nicolás E. Barbé"));
  assert.ok(source.includes("Médico veterinario patólogo"));
  assert.ok(source.includes("Responsable de diagnóstico"));
  assert.ok(source.includes("Acceder al portal"));
  assert.ok(source.includes("Seguir con código"));
  assert.ok(source.includes("public-hero-action-grid"));
  assert.ok(source.includes("public-hero-action-tile"));
  assert.ok(source.includes("Resultados disponibles las 24 hs"));
  assert.ok(source.includes("WhatsApp: 3534138946"));
  assert.ok(source.includes("<PublicExternalControl"));
  assert.ok(source.includes('href="https://wa.me/5493534138946"'));
  assert.ok(source.includes('target="_blank"'));
  assert.ok(source.includes('href={ROUTES.login}'));
  assert.ok(source.includes('href={ROUTES.particulares}'));

  // Contratos de accesibilidad y no-regresión
  assert.equal(/<a\b/.test(source), false);
  assert.equal(source.includes("inline-flex w-fit flex-col rounded-md border border-white/30"), false);
  assert.equal(source.includes("text-[0.62rem]"), false);
  assert.equal(source.includes("border-t border-white/35"), false);
  assert.equal(source.includes("premium-card p-6"), false);
});

test("home page exposes mobile professionals block before services", () => {
  const source = read(HOME_PAGE_PATH);
  const professionalsIndex = source.indexOf("Red de profesionales veterinarios");
  const servicesIndex = source.indexOf(
    "Servicios del laboratorio patológico veterinario",
  );

  assert.ok(professionalsIndex !== -1);
  assert.ok(servicesIndex !== -1);
  assert.ok(professionalsIndex < servicesIndex);
  assert.ok(source.includes('aria-labelledby="mobile-professionals-heading"'));
  assert.ok(source.includes('id="mobile-professionals-heading"'));
  assert.ok(
    source.includes(
      'className="border-b border-vetneb-line/80 bg-card/72 py-8 md:py-10 lg:hidden"',
    ),
  );
  assert.ok(source.includes("Buscá profesionales vinculados a VETNEB para derivaciones,"));
  assert.ok(source.includes("interconsultas y coordinación clínica."));
  assert.ok(source.includes('className="public-cta-primary w-full sm:w-auto"'));
  assert.ok(source.includes("<PublicRouteControl"));
  assert.ok(source.includes("href={ROUTES.profesionales}"));
  assert.equal(source.includes("<Link"), false);
});

test("home page exposes clinical trust institutional data before services", () => {
  const source = read(HOME_PAGE_PATH);
  const clinicalTrustIndex = source.indexOf('aria-labelledby="clinical-trust-heading"');
  const professionalsIndex = source.indexOf("Red de profesionales veterinarios");
  const servicesIndex = source.indexOf(
    "Servicios del laboratorio patológico veterinario",
  );
  const clinicalTrustData = extractBetween(
    source,
    "const clinicalTrustItems = [",
    "const benefits = [",
  );
  const forbiddenWords = [
    "marketplace",
    "ranking",
    "reviews",
    "estrellas",
    "telemedicina",
  ];
  const unverifiedNumericClaims = [
    /\+\s*\d+/,
    /\d+\s*años?\s+de\s+experiencia/i,
    /\d+\s+cl[ií]nicas/i,
    /\d+\s+profesionales/i,
    /\d+\s+casos/i,
    /\d+\s+informes/i,
  ];

  assert.ok(clinicalTrustIndex !== -1);
  assert.ok(professionalsIndex !== -1);
  assert.ok(servicesIndex !== -1);
  assert.ok(clinicalTrustIndex < professionalsIndex);
  assert.ok(clinicalTrustIndex < servicesIndex);
  assert.ok(source.includes('id="clinical-trust-heading"'));
  assert.ok(source.includes("Confianza clínica"));
  assert.ok(
    source.includes(
      "Diagnóstico microscópico riguroso para la medicina veterinaria",
    ),
  );
  assert.ok(
    source.includes(
      "Una plataforma operativa al servicio del laboratorio: estudios",
    ),
  );
  assert.ok(
    source.includes(
      "histopatológicos y citológicos, informes seguros y una red de",
    ),
  );
  assert.ok(source.includes("clínicas verificadas."));
  assert.ok(
    source.includes(
      "grid grid-cols-1 divide-y divide-vetneb-line/70 lg:grid-cols-4 lg:divide-x lg:divide-y-0",
    ),
  );

  assert.equal(count(clinicalTrustData, "title:"), 4);
  assert.equal(count(clinicalTrustData, "description:"), 4);
  assert.equal(
    count(clinicalTrustData, 'title: "Anatomía patológica veterinaria"'),
    1,
  );
  assert.equal(
    count(clinicalTrustData, 'title: "Informes con acceso seguro"'),
    1,
  );
  assert.equal(
    count(clinicalTrustData, 'title: "Red profesional verificada"'),
    1,
  );
  assert.equal(
    count(clinicalTrustData, 'title: "Flujo operativo claro"'),
    1,
  );
  assert.ok(
    clinicalTrustData.includes(
      "Diagnóstico histopatológico y citológico como servicio central.",
    ),
  );
  assert.ok(
    clinicalTrustData.includes(
      "Entrega directa a clínicas y acceso privado por token para tutores.",
    ),
  );
  assert.ok(
    clinicalTrustData.includes(
      "Clínicas y profesionales confirmados por el laboratorio.",
    ),
  );
  assert.ok(
    clinicalTrustData.includes(
      "Envío de muestra, análisis anatomopatológico e informe descargable.",
    ),
  );

  const clinicalTrustSurface = clinicalTrustData.toLowerCase();
  for (const forbiddenWord of forbiddenWords) {
    assert.equal(
      clinicalTrustSurface.includes(forbiddenWord),
      false,
      `clinical trust section must not contain ${forbiddenWord}`,
    );
  }

  for (const unverifiedNumericClaim of unverifiedNumericClaims) {
    assert.equal(
      unverifiedNumericClaim.test(clinicalTrustData),
      false,
      `clinical trust section must not contain unverified numeric claim ${unverifiedNumericClaim}`,
    );
  }
});

test("home page lists core laboratory services and services route CTA", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes('className="public-soft-canvas"'));
  assert.ok(source.includes('aria-labelledby="services-heading"'));
  assert.ok(source.includes('id="services-heading"'));
  assert.ok(source.includes('className="py-16 md:py-20"'));
  assert.ok(source.includes("Servicios del laboratorio patológico veterinario"));
  assert.ok(source.includes("Estudio Anatomopatológico"));
  assert.ok(source.includes("Estudio Citológico"));
  assert.ok(source.includes("Tinciones Especiales"));
  assert.ok(source.includes("Diagnóstico Integral"));
  assert.ok(source.includes('href={ROUTES.servicios}'));
  assert.ok(source.includes("Ver todos los servicios"));
});

test("home page renders one unified end-to-end journey section (PR-17)", () => {
  const source = read(HOME_PAGE_PATH);
  const servicesIndex = source.indexOf('aria-labelledby="services-heading"');
  const journeyIndex = source.indexOf(
    'aria-labelledby="specimen-journey-heading"',
  );
  const benefitsIndex = source.indexOf('aria-labelledby="benefits-heading"');
  const sectionSource = extractBetween(
    source,
    'aria-labelledby="specimen-journey-heading"',
    "{/* Beneficios */}",
  );
  const forbiddenWords = [
    "marketplace",
    "ranking",
    "reviews",
    "estrellas",
    "telemedicina",
  ];

  assert.ok(servicesIndex !== -1);
  assert.ok(journeyIndex !== -1);
  assert.ok(benefitsIndex !== -1);
  assert.ok(servicesIndex < journeyIndex);
  assert.ok(journeyIndex < benefitsIndex);

  // Narrativa end-to-end única — sin sección "Cómo funciona" separada
  assert.equal(count(source, 'aria-labelledby="specimen-journey-heading"'), 1);
  assert.equal(source.includes('aria-labelledby="how-it-works-heading"'), false);
  assert.equal(source.includes("const howItWorksSteps"), false);
  assert.equal(count(source, "Recorrido de la muestra"), 1);
  assert.equal(count(source, "Cómo funciona"), 1);

  // La fusión conserva contenido funcional, etapas y CTA existentes
  assert.ok(source.includes('id="specimen-journey-heading"'));
  assert.ok(
    source.includes(
      "Trabajar con VETNEB es simple: desde el envío de la muestra",
    ),
  );
  assert.ok(sectionSource.includes("asegurar la trazabilidad del diagnóstico."));
  assert.ok(sectionSource.includes("stages={specimenJourneyStages}"));
  assert.ok(sectionSource.includes('variant="timeline"'));
  assert.ok(sectionSource.includes("Contactanos para empezar"));
  assert.ok(sectionSource.includes("href={ROUTES.contacto}"));
  assert.ok(
    source.includes(
      'className="public-evidence-band-muted public-band-feature"\n          aria-labelledby="specimen-journey-heading"',
    ),
  );

  const journeySurface = sectionSource.toLowerCase();
  for (const forbiddenWord of forbiddenWords) {
    assert.equal(
      journeySurface.includes(forbiddenWord),
      false,
      `unified journey section must not contain ${forbiddenWord}`,
    );
  }
});

test("home page hero composes structural system diagram without fictional data (PR-17)", () => {
  const source = read(HOME_PAGE_PATH);
  const heroSection = extractBetween(
    source,
    'aria-labelledby="hero-heading"',
    "Banda utilitaria",
  );
  const nodesData = extractBetween(
    source,
    "const heroSystemNodes = [",
    "export default function HomePage()",
  );

  // h1 usa la tipografía display de PR-16
  assert.ok(
    source.includes(
      'className="public-display max-w-2xl break-words font-bold text-primary-foreground"',
    ),
  );

  // Composición en dos zonas en desktop, una columna en mobile
  assert.ok(
    heroSection.includes(
      "grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]",
    ),
  );

  // Diagrama estructural del proceso — nodos conceptuales conectados
  assert.ok(heroSection.includes("data-hero-system-diagram"));
  assert.ok(
    heroSection.includes(
      'aria-label="Diagrama del proceso diagnóstico: de la muestra al acceso digital"',
    ),
  );
  assert.ok(heroSection.includes("De la muestra al informe"));
  assert.ok(heroSection.includes("heroSystemNodes.map((node, index)"));

  assert.equal(count(nodesData, "label:"), 5);
  assert.ok(nodesData.includes('label: "Muestra"'));
  assert.ok(nodesData.includes('label: "Laboratorio"'));
  assert.ok(nodesData.includes('label: "Evaluación diagnóstica"'));
  assert.ok(nodesData.includes('label: "Informe"'));
  assert.ok(nodesData.includes('label: "Acceso digital"'));

  // El diagrama no contiene datos: ni códigos, ni fechas, ni cifras
  assert.equal(/\d/.test(nodesData), false);
});

test("home page refines section rhythm without homogeneous card grids (PR-18)", () => {
  const source = read(HOME_PAGE_PATH);
  const trustSection = extractBetween(
    source,
    'aria-labelledby="clinical-trust-heading"',
    'aria-labelledby="mobile-professionals-heading"',
  );
  const servicesSection = extractBetween(
    source,
    'aria-labelledby="services-heading"',
    'aria-labelledby="specimen-journey-heading"',
  );
  const benefitsSection = extractBetween(
    source,
    "{/* Beneficios */}",
    "{/* CTA final */}",
  );

  // Confianza clínica — franja horizontal de evidencia, sin cards individuales
  assert.ok(
    source.includes('className="public-evidence-band-light py-12 md:py-16"'),
  );
  assert.equal(trustSection.includes("bg-card p-5 shadow-sm"), false);
  assert.equal(trustSection.includes("premium-card"), false);

  // Servicios — módulo dominante premium, módulos secundarios sobrios
  assert.ok(servicesSection.includes("premium-card"));
  assert.ok(
    servicesSection.includes("border-vetneb-line/75 bg-card/85 shadow-none"),
  );
  assert.ok(servicesSection.includes("lg:p-8 lg:pb-4"));
  assert.ok(servicesSection.includes('isFeatured && "lg:text-2xl"'));

  // Beneficios — banda split de dos columnas, sin dos cards iguales
  assert.ok(
    source.includes('className="public-evidence-band-light py-16 md:py-20"'),
  );
  assert.ok(
    benefitsSection.includes("lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0"),
  );
  assert.equal(benefitsSection.includes("premium-card"), false);
  assert.equal(benefitsSection.includes("<Card"), false);
});

test("home page lists benefits for clinics and professionals", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes('aria-labelledby="benefits-heading"'));
  assert.ok(source.includes('id="benefits-heading"'));
  assert.ok(source.includes("Trabajo interdisciplinario y criterio diagnóstico"));
  assert.ok(source.includes("Diagnóstico integral"));
  assert.ok(source.includes("Para tener en cuenta"));
  assert.ok(source.includes("Articulamos el análisis con equipos de diagnóstico por imágenes"));
  assert.ok(source.includes("El análisis no es automatizado: requiere evaluación microscópica especializada"));
});

test("home page does not contain demo or simulated content (PR-15/PR-17 guard)", () => {
  const source = read(HOME_PAGE_PATH);
  const demoTerms = [
    "MUESTRA",
    "DEMOSTRATIVO",
    "DEMO-000",
    "DEMO-CLINICA",
    "Paciente demostrativo",
    "Canino demostrativo",
    "paciente demostrativo",
    "clínica demostrativa",
    "Ejemplo visual sin datos reales",
    "sin datos reales",
    "caso demo",
    "datos ficticios",
    "informe simulado",
    "informe inventado",
    "panel operativo simulado",
    "dashboard ficticio",
    "report-preview-card-title",
    "ReportPreviewCard",
  ];

  for (const term of demoTerms) {
    assert.equal(
      source.includes(term),
      false,
      `home page must not contain "${term}"`,
    );
  }
});

test("home page exposes final conversion CTA without private route metadata", () => {
  const source = read(HOME_PAGE_PATH);
  const routesSource = read("frontend/src/lib/routes.ts");
  const finalCtaSection = extractBetween(
    source,
    'className="relative isolate overflow-hidden bg-vetneb-navy py-16 text-primary-foreground md:py-20"',
    "</section>",
  );
  const forbiddenWords = [
    "marketplace",
    "ranking",
    "reviews",
    "estrellas",
    "telemedicina",
    "reservas online",
  ];

  assert.ok(source.includes('aria-labelledby="cta-heading"'));
  assert.ok(source.includes('id="cta-heading"'));
  assert.ok(source.includes("Empezá a trabajar con VETNEB"));
  assert.ok(
    source.includes(
      "Sumá a tu clínica a un flujo de diagnóstico anatomopatológico",
    ),
  );
  assert.ok(
    source.includes(
      "claro, seguro y pensado para la operación veterinaria.",
    ),
  );
  assert.ok(finalCtaSection.includes("Contactanos"));
  assert.ok(finalCtaSection.includes("Ver servicios"));
  assert.ok(finalCtaSection.includes("href={ROUTES.contacto}"));
  assert.ok(finalCtaSection.includes("href={ROUTES.servicios}"));
  assert.ok(routesSource.includes('contacto: "/contacto"'));
  assert.ok(routesSource.includes('servicios: "/servicios"'));
  assert.ok(source.includes("public-cta-outline"));
  assert.ok(finalCtaSection.includes('variant="primaryLight"'));
  assert.ok(finalCtaSection.includes('variant="secondaryOutline"'));
  assert.ok(finalCtaSection.includes("bg-vetneb-navy"));
  assert.equal(count(finalCtaSection, "<PublicRouteControl"), 2);
  assert.equal(/<form\b/i.test(finalCtaSection), false);
  assert.equal(/<input\b|<textarea\b|react-hook-form/i.test(finalCtaSection), false);
  assert.equal(source.includes("bg-primary py-16 text-white md:py-20"), false);
  assert.equal(source.includes('"/dashboard"'), false);
  assert.equal(source.includes('"/api"'), false);

  const finalCtaSurface = finalCtaSection.toLowerCase();
  for (const forbiddenWord of forbiddenWords) {
    assert.equal(
      finalCtaSurface.includes(forbiddenWord),
      false,
      `final CTA section must not contain ${forbiddenWord}`,
    );
  }
});
