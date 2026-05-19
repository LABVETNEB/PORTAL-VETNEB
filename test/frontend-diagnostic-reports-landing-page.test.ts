import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DIAGNOSTIC_REPORTS_PAGE_PATH =
  "frontend/src/app/informes-veterinarios/page.tsx";
const SERVICES_PAGE_PATH = "frontend/src/app/servicios/page.tsx";
const SITEMAP_PATH = "frontend/src/app/sitemap.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("veterinary diagnostic reports landing page exists", () => {
  assert.equal(
    existsSync(resolve(process.cwd(), DIAGNOSTIC_REPORTS_PAGE_PATH)),
    true,
  );
});

test("veterinary diagnostic reports landing page defines public SEO metadata", () => {
  const source = read(DIAGNOSTIC_REPORTS_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import Link from "next/link";'));
  assert.ok(source.includes('import { PublicLayout } from "@/components/layout/PublicLayout";'));
  assert.ok(source.includes('import { PublicScrollReveal } from "@/components/public/PublicScrollReveal";'));
  assert.ok(source.includes('import { VisualIcon } from "@/components/public/VisualAccents";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Informes Veterinarios | Resultados Veterinarios Online"'));
  assert.ok(source.includes('"/informes-veterinarios"'));
  assert.ok(source.includes("Informes veterinarios"));
  assert.ok(source.includes("resultados veterinarios online"));
  assert.ok(source.includes("consulta de informes veterinarios"));
  assert.ok(source.includes("informes patológicos veterinarios"));
  assert.ok(source.includes("trazabilidad de estudios veterinarios"));
});

test("veterinary diagnostic reports landing page uses truthful Service JSON-LD", () => {
  const source = read(DIAGNOSTIC_REPORTS_PAGE_PATH);

  assert.ok(source.includes("getDiagnosticServiceJsonLd"));
  assert.ok(source.includes("const jsonLd = getDiagnosticServiceJsonLd({"));
  assert.ok(source.includes('path: "/informes-veterinarios"'));
  assert.ok(source.includes('name: "Informes veterinarios"'));
  assert.ok(source.includes('serviceType: "Consulta y seguimiento de informes veterinarios"'));
  assert.ok(source.includes("knowsAbout: ["));
  assert.ok(source.includes('"resultados veterinarios online"'));
  assert.ok(source.includes('"informes patológicos veterinarios"'));
  assert.ok(source.includes('"trazabilidad de estudios veterinarios"'));
  assert.ok(source.includes('type="application/ld+json"'));
  assert.ok(
    source.includes(
      "dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}",
    ),
  );
});

test("veterinary diagnostic reports landing page explains access, traceability and timing limits", () => {
  const source = read(DIAGNOSTIC_REPORTS_PAGE_PATH);

  assert.ok(source.includes("Consulta y seguimiento de informes veterinarios"));
  assert.ok(source.includes("sin convertir la información privada"));
  assert.ok(source.includes("no se presenta como consulta pública abierta"));
  assert.ok(source.includes("Trazabilidad de estudios veterinarios"));
  assert.ok(source.includes("muestra, antecedentes y lectura"));
  assert.ok(source.includes("complejidad diagnóstica"));
  assert.ok(source.includes("técnicas complementarias o interconsulta"));
  assert.ok(source.includes("no se presentan plazos exactos garantizados"));
});

test("veterinary diagnostic reports landing page keeps public editorial navigation", () => {
  const source = read(DIAGNOSTIC_REPORTS_PAGE_PATH);

  assert.ok(source.includes('href="/contacto"'));
  assert.ok(source.includes("Consultar por informes"));
  assert.ok(source.includes('href="/servicios"'));
  assert.ok(source.includes("VER MAS SERVICIOS"));
  assert.ok(source.includes('href="/servicios"'));
  assert.equal(source.includes('"/dashboard"'), false);
  assert.equal(source.includes('href="/dashboard"'), false);
  assert.equal(source.includes('"/api"'), false);
  assert.equal(source.includes("fetch("), false);
});

test("services page links editorially to veterinary diagnostic reports", () => {
  const source = read(SERVICES_PAGE_PATH);

  assert.ok(source.includes('id: "informes"'));
  assert.ok(source.includes('href="/informes-veterinarios"'));
  assert.ok(source.includes("Ver informes veterinarios"));
  assert.equal(source.includes('href="/dashboard"'), false);
});

test("veterinary diagnostic reports landing page is included in sitemap below core diagnostic landings", () => {
  const source = read(SITEMAP_PATH);

  assert.ok(source.includes("url: `${SITE_URL}/informes-veterinarios`,"));
  assert.ok(source.includes("priority: 0.84,"));
  assert.ok(source.includes("url: `${SITE_URL}/laboratorio-patologico-veterinario`,"));
  assert.ok(source.includes("priority: 0.89,"));
  assert.ok(source.includes("url: `${SITE_URL}/histopatologia-veterinaria`,"));
  assert.ok(source.includes("url: `${SITE_URL}/citologia-veterinaria`,"));
  assert.ok(source.includes("priority: 0.88,"));
  assert.equal(source.includes("/dashboard"), false);
  assert.equal(source.includes("/api"), false);
});

test("veterinary diagnostic reports landing page avoids unverifiable claims", () => {
  const source = read(DIAGNOSTIC_REPORTS_PAGE_PATH);

  assert.equal(source.includes("AggregateRating"), false);
  assert.equal(source.includes('"@type": "Review"'), false);
  assert.equal(source.includes("openingHours"), false);
  assert.equal(source.includes("GeoCoordinates"), false);
  assert.equal(source.includes("PostalAddress"), false);
  assert.equal(source.includes("24 hs"), false);
  assert.equal(source.includes("horarios"), false);
  assert.equal(source.includes("garantizado para todos"), false);
  assert.equal(source.includes("from \"gsap\""), false);
  assert.equal(source.includes("from 'gsap'"), false);
});
test("veterinary diagnostic reports hides redundant visible related service links", () => {
  const source = read(DIAGNOSTIC_REPORTS_PAGE_PATH);

  assert.equal(source.includes("Ver servicios diagnósticos"), false);
  assert.equal(source.includes("Ver laboratorio patológico veterinario"), false);
});