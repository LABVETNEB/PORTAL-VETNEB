import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const SERVICIOS_PAGE_PATH = "frontend/src/app/servicios/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("servicios page defines metadata JSON-LD and public layout wiring", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { PublicRouteControl } from "@/components/public/PublicRouteControl";'));
  assert.ok(source.includes('import { PublicLayout } from "@/components/layout/PublicLayout";'));
  assert.ok(source.includes('import { createPageMetadata, getServicesJsonLd } from "@/lib/seo";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Servicio Patológico Veterinario: Histopatología, Citología y Hematología"'));
  assert.ok(source.includes('"/servicios"'));
  assert.ok(source.includes("const jsonLd = getServicesJsonLd();"));
  assert.ok(source.includes('type="application/ld+json"'));
  assert.ok(source.includes("<PublicLayout>"));
});

test("servicios page exposes hero content", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes("Servicio patológico veterinario"));
  assert.ok(source.includes("La anatomía patológica veterinaria integra evaluación microscópica"));
  assert.ok(source.includes("trazabilidad de muestras e informes clínicos"));
});

test("servicios page lists laboratory service categories", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes("const serviceCategories = ["));
  const serviceTitles = [
    "Estudio anatomopatológico de tejidos",
    "Estudio citológico de muestras",
    "Tinciones especiales aplicadas",
    "Diagnóstico integral interdisciplinario",
    "Informes y seguimiento",
  ];

  for (const title of serviceTitles) {
    assert.ok(source.includes(title), `servicios page must keep "${title}"`);
  }

  assert.ok(source.includes("serviceCategories.map((service) =>"));
});

test("servicios page keeps detailed service feature bullets", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  const serviceFeatures = [
    "Recepción y procesamiento de muestras de tejidos",
    "Evaluación microscópica de lesiones histológicas",
    "Correlación anatomopatológica del caso clínico",
    "Informe diagnóstico con hallazgos relevantes",
    "Apoyo para decisiones terapéuticas",
    "Seguimiento del caso con el equipo tratante",
    "Estudio citológico de líquidos y punciones",
    "Valoración celular orientada a diagnóstico",
    "Identificación de patrones inflamatorios y proliferativos",
    "Apoyo diagnóstico en lesiones de tejidos blandos",
    "Integración con antecedentes clínicos del paciente",
    "Informe citológico con conclusión profesional",
    "Selección de técnicas según complejidad del caso",
    "Caracterización adicional de lesiones tisulares",
    "Soporte para diagnósticos diferenciales",
    "Complemento de histopatología y citopatología",
    "Mayor precisión frente a hallazgos complejos",
    "Registro diagnóstico trazable",
    "Integración de análisis histológico y citológico",
    "Trabajo conjunto con diagnóstico por imágenes",
    "Articulación con cirugía y clínica veterinaria",
    "Interconsulta profesional cuando el caso lo requiere",
    "Definición diagnóstica específica por paciente",
    "Orientación para tratamiento personalizado",
    "Consulta de resultados de informes las 24 hs",
    "Seguimiento del estado del estudio en portal",
    "Comunicación directa para coordinación de muestras",
    "Priorización según complejidad diagnóstica",
    "Tiempos variables según necesidad del caso",
    "Entrega final con criterio profesional y responsable",
  ];

  for (const feature of serviceFeatures) {
    assert.ok(source.includes(feature), `servicios page must keep "${feature}"`);
  }
});

test("servicios page exposes conversion CTAs and SEO copy", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes("Coordinación diagnóstica para clínicas y profesionales"));
  assert.ok(source.includes('href={ROUTES.contacto}'));
  assert.ok(source.includes("Solicitar coordinación diagnóstica"));
  assert.ok(source.includes('href={ROUTES.clinicas}'));
  assert.ok(source.includes("Conocer solución para clínicas"));
  assert.ok(source.includes("Diagnóstico integral para medicina veterinaria"));
  assert.ok(source.includes("Para tener en cuenta"));
  assert.ok(source.includes("Valores que guían el servicio"));
  assert.ok(source.includes("veterinaria confiable"));
});

test("servicios page remains public and avoids direct backend/API calls", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.equal(source.includes('"/dashboard"'), false);
  assert.equal(source.includes('"/api"'), false);
  assert.equal(source.includes("fetch("), false);
});

test("servicios page composes its diagnostic sections on the public rhythm system", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes('className="public-soft-canvas"'));
  assert.ok(source.includes('className="py-16 md:py-20"'));
  assert.ok(source.includes('className="public-evidence-band-light public-band"'));
  assert.ok(source.includes('className="public-band-feature"'));
  assert.ok(source.includes('className="public-evidence-band-muted public-band"'));
  assert.equal(source.includes('className="bg-white py-16"'), false);
  assert.equal(source.includes('className="bg-blue-50 py-16"'), false);
  assert.equal(source.includes('className="bg-gray-50 py-16"'), false);
  assert.equal(source.includes('data-public-soft-canvas="true"'), false);
});

test("servicios page uses a hierarchical diagnostic bento", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes('layout: "dominant" as const'));
  assert.equal((source.match(/layout: "medium" as const/g) ?? []).length, 2);
  assert.equal((source.match(/layout: "connector" as const/g) ?? []).length, 2);
  assert.ok(source.includes('data-services-diagnostic-bento="true"'));
  assert.ok(source.includes("grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6"));
  assert.ok(source.includes('isDominant && "lg:col-span-12"'));
  assert.ok(source.includes('isMedium && "lg:col-span-6"'));
  assert.ok(source.includes('"lg:col-span-7"'));
  assert.ok(source.includes('"lg:col-span-5"'));
  assert.ok(source.includes('data-service-layout={service.layout}'));
  assert.ok(source.includes("isConnector"));
  assert.ok(source.includes('"premium-card-muted"'));
});

test("servicios page consolidates repeated bands into composed sections", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes('data-services-composed-band="coordination-integral"'));
  assert.ok(source.includes('data-services-composed-band="considerations-values"'));

  const coordinationBandIndex = source.indexOf(
    'data-services-composed-band="coordination-integral"',
  );
  const coordinationHeadingIndex = source.indexOf(
    'id="services-coordination-heading"',
  );
  const integralHeadingIndex = source.indexOf('id="services-integral-heading"');
  const closingBandIndex = source.indexOf(
    'data-services-composed-band="considerations-values"',
  );
  const considerationsHeadingIndex = source.indexOf(
    'id="services-considerations-heading"',
  );
  const valuesHeadingIndex = source.indexOf('id="services-values-heading"');

  assert.ok(coordinationBandIndex < coordinationHeadingIndex);
  assert.ok(coordinationHeadingIndex < integralHeadingIndex);
  assert.ok(closingBandIndex < considerationsHeadingIndex);
  assert.ok(considerationsHeadingIndex < valuesHeadingIndex);
});

test("servicios page hides service link typography while keeping link semantics", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes('href: "/laboratorio-patologico-veterinario"'));
  assert.ok(source.includes('href: "/histopatologia-veterinaria"'));
  assert.ok(source.includes('href: "/citologia-veterinaria"'));
  assert.ok(source.includes('href: "/informes-veterinarios"'));
  assert.ok(source.includes('className="sr-only"'));
  assert.ok(source.includes("<span"));
  assert.ok(source.includes("{service.linkLabel}"));
  assert.ok(source.includes("hover:[&_.premium-card]:bg-vetneb-surface-muted/40"));
  assert.ok(source.includes("hover:[&_.premium-card]:border-vetneb-teal/48"));
  assert.ok(source.includes("hover:[&_.premium-card]:shadow-[0_22px_66px_rgba(15,45,62,0.145)]"));
  assert.equal(source.includes("group-hover:text-vetneb-teal"), false);
});

test("servicios page shows unified card CTA while preserving hidden SEO labels", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes("<span aria-hidden=\"true\">Ver más</span>"));
  assert.ok(source.includes("{service.linkLabel}"));
  assert.ok(source.includes('className="sr-only"'));
  assert.ok(source.includes("hover:[&_.premium-card]:bg-vetneb-surface-muted/40"));
  assert.ok(source.includes("hover:[&_.premium-card]:border-vetneb-teal/48"));
  assert.ok(source.includes("hover:[&_.premium-card]:shadow-[0_22px_66px_rgba(15,45,62,0.145)]"));
  assert.equal(source.includes("Ver laboratorio patológico veterinario</div>"), false);
  assert.equal(source.includes("Ver histopatología veterinaria</div>"), false);
  assert.equal(source.includes("Ver citología veterinaria</div>"), false);
  assert.equal(source.includes("Ver informes veterinarios</div>"), false);
});

test("servicios page does not contain demo or simulated content (PR-15 guard)", () => {
  const source = read(SERVICIOS_PAGE_PATH);
  const normalizedSource = source.toLowerCase();
  const demoTerms = [
    "demostrativo",
    "ejemplo visual",
    "sin datos reales",
    "caso demo",
    "demo-000",
    "demo-clinica-001",
    "paciente demostrativo",
    "clínica demostrativa",
    "preview de informe simulado",
    "panel operativo simulado",
    "dashboard ficticio",
    "informe inventado",
    "datos ficticios visibles",
    "report-preview-card-title",
    "reportpreviewcard",
  ];

  assert.equal(source.includes("MUESTRA"), false);

  for (const term of demoTerms) {
    assert.equal(
      normalizedSource.includes(term),
      false,
      `servicios page must not contain "${term}"`,
    );
  }
});

test("servicios page card links are constrained to explicit CTAs not full card wrappers", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  // No Link wrapping the full card surface
  assert.equal(source.includes("group block h-full"), false);
  assert.equal(source.includes('"group block'), false);
  // No absolute overlay link trick
  assert.equal(source.includes("absolute inset-0"), false);
  // Explicit constrained CTA exists inside card
  assert.ok(source.includes("inline-flex w-fit"));
  assert.ok(source.includes("href={service.href}"));
});
