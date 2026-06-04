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
  assert.ok(source.includes('"Portal VETNEB — Laboratorio Patológico Veterinario"'));
  assert.ok(source.includes('"/"'));
  // Organization JSON-LD is injected by layout.tsx to avoid duplication on the home page
  assert.equal(source.includes("getOrganizationJsonLd"), false);
  assert.equal(source.includes("const jsonLd ="), false);
});

test("home page exposes accessible hero and primary CTAs", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes('aria-labelledby="hero-heading"'));
  assert.ok(source.includes('id="hero-heading"'));
  assert.ok(source.includes('src="/images/hero-microscope-vetneb.webp"'));
  assert.ok(source.includes('import Image from "next/image";'));
  assert.ok(source.includes("SERVICIO PATOLÓGICO VETNEB"));
  assert.ok(source.includes("VETNEB"));
  assert.ok(source.includes("Diagnóstico patológico veterinario con criterio clínico y"));
  assert.ok(source.includes("trazabilidad integral"));
  assert.ok(source.includes("Dr. BARBÉ, NICOLÁS E."));
  assert.ok(source.includes("Acceder a informes y trazabilidad"));
  assert.ok(source.includes("Consultá los resultados de sus informes las 24 hs."));
  assert.ok(source.includes("clinical-muted-band mt-7 w-fit max-w-full"));
  assert.equal(source.includes("inline-flex w-fit flex-col rounded-md border border-white/30"), false);
  assert.equal(source.includes("text-[0.62rem]"), false);
  assert.equal(source.includes("border-t border-white/35"), false);
  assert.equal(source.includes("premium-card p-6"), false);
  assert.ok(source.includes("Horario de atención Lunes a viernes de 8 a 17hs"));
  assert.ok(source.includes("Whatsapp: 3534138946"));
  assert.ok(source.includes("<PublicExternalControl"));
  assert.ok(source.includes('href="https://wa.me/5493534138946"'));
  assert.ok(source.includes('target="_blank"'));
  assert.equal(/<a\b/.test(source), false);
  assert.ok(source.includes('href={ROUTES.login}'));
  assert.ok(
    source.includes(
      'className="public-cta-on-hero w-full text-vetneb-navy hover:text-vetneb-navy active:text-vetneb-navy focus-visible:text-vetneb-navy sm:w-auto"',
    ),
  );
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
    "const howItWorksSteps = [",
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
  assert.ok(source.includes("grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"));

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

test("home page renders how it works section with exactly three operational steps", () => {
  const source = read(HOME_PAGE_PATH);
  const servicesIndex = source.indexOf('aria-labelledby="services-heading"');
  const howItWorksIndex = source.indexOf('aria-labelledby="how-it-works-heading"');
  const benefitsIndex = source.indexOf('aria-labelledby="benefits-heading"');
  const stepData = extractBetween(
    source,
    "const howItWorksSteps = [",
    "const benefits = [",
  );
  const sectionSource = extractBetween(
    source,
    'aria-labelledby="how-it-works-heading"',
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
  assert.ok(howItWorksIndex !== -1);
  assert.ok(benefitsIndex !== -1);
  assert.ok(servicesIndex < howItWorksIndex);
  assert.ok(howItWorksIndex < benefitsIndex);
  assert.ok(source.includes("Cómo funciona"));
  assert.ok(source.includes("Trabajar con VETNEB es simple"));
  assert.ok(source.includes('id="how-it-works-heading"'));
  assert.ok(source.includes("grid grid-cols-1 gap-5 md:grid-cols-3"));
  assert.ok(source.includes("Contactanos para empezar"));
  assert.ok(source.includes("href={ROUTES.contacto}"));

  assert.equal(count(stepData, "title:"), 3);
  assert.equal(count(stepData, "description:"), 3);
  assert.equal(count(stepData, 'title: "Enviás la muestra"'), 1);
  assert.equal(count(stepData, 'title: "VETNEB analiza"'), 1);
  assert.equal(count(stepData, 'title: "Recibís el informe"'), 1);
  assert.equal(
    count(
      stepData,
      "Preparás la muestra según el protocolo de VETNEB y la enviás con los datos del caso y de la clínica.",
    ),
    1,
  );
  assert.equal(
    count(
      stepData,
      "El anatomopatólogo examina el tejido o la muestra citológica y elabora el informe diagnóstico.",
    ),
    1,
  );
  assert.equal(
    count(
      stepData,
      "La clínica lo descarga directamente desde el portal. Si corresponde, el tutor del animal recibe acceso con un código privado.",
    ),
    1,
  );

  const howItWorksSurface = `${stepData}\n${sectionSource}`.toLowerCase();
  for (const forbiddenWord of forbiddenWords) {
    assert.equal(
      howItWorksSurface.includes(forbiddenWord),
      false,
      `how it works section must not contain ${forbiddenWord}`,
    );
  }
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

test("home page exposes final conversion CTA without private route metadata", () => {
  const source = read(HOME_PAGE_PATH);
  const routesSource = read("frontend/src/lib/routes.ts");
  const finalCtaSection = extractBetween(
    source,
    'className="bg-vetneb-navy py-16 text-primary-foreground md:py-20"',
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
