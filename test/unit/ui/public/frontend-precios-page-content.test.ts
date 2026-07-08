import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PRECIOS_PAGE_PATH = "frontend/src/app/precios/page.tsx";
const PRECIOS_CONTENT_PATH =
  "frontend/src/components/public/PreciosContent.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("precios page defines public metadata and layout", () => {
  const pageSource = read(PRECIOS_PAGE_PATH);
  const contentSource = read(PRECIOS_CONTENT_PATH);

  assert.ok(pageSource.includes('import type { Metadata } from "next";'));
  assert.ok(pageSource.includes('import { PreciosContent } from "@/components/public/PreciosContent";'));
  assert.ok(pageSource.includes('import { createPageMetadata, getPreciosPageJsonLd } from "@/lib/seo";'));
  assert.ok(pageSource.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(pageSource.includes('"Precios de Estudios Patológicos Veterinarios"'));
  assert.ok(pageSource.includes('"/precios"'));
  assert.ok(pageSource.includes("<PreciosContent />"));
  assert.ok(contentSource.includes('"use client";'));
  assert.ok(contentSource.includes('import { PublicLayout } from "@/components/layout/PublicLayout";'));
  assert.ok(contentSource.includes("<PublicLayout>"));
});

test("precios page keeps category priority with citologías then histopatologías", () => {
  const source = read(PRECIOS_CONTENT_PATH);
  const citologiasIndex = source.indexOf('"CITOLOGÍAS"');
  const histopatologiasIndex = source.indexOf('"HISTOPATOLOGÍAS"');

  assert.ok(source.includes("const CATEGORY_PRIORITY = new Map<string, number>(["));
  assert.ok(citologiasIndex !== -1);
  assert.ok(histopatologiasIndex !== -1);
  assert.ok(citologiasIndex < histopatologiasIndex);
  assert.ok(source.includes("function sortPricingCategories("));
});

test("precios page renders responsive side-by-side category cards with formal medical visual style", () => {
  const source = read(PRECIOS_CONTENT_PATH);

  assert.ok(source.includes("mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10"));
  assert.ok(source.includes("clinical-card overflow-hidden"));
  assert.ok(source.includes("clinical-card-header"));
  assert.ok(source.includes("border-b border-vetneb-line px-6 py-5 text-center"));
  assert.equal(source.includes("bg-[hsl(var(--vetneb-navy))]"), false);
  assert.ok(source.includes("text-center text-base font-semibold uppercase"));
  assert.ok(source.includes("bg-vetneb-surface-raised/60"));
  assert.ok(source.includes("rounded-lg border border-vetneb-line bg-card shadow-sm"));
  assert.equal(source.includes("estudios disponibles"), false);
});

test("precios page renders price rows with bordered pills and clear hierarchy", () => {
  const source = read(PRECIOS_CONTENT_PATH);

  assert.ok(
    source.includes(
      "clinical-hover-row flex flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5",
    ),
  );
  assert.equal(
    source.includes("clinical-hover-row flex items-start justify-between gap-5 px-5 py-4"),
    false,
  );
  assert.ok(
    source.includes(
      "w-full min-w-0 break-words text-sm font-medium leading-6 text-vetneb-ink sm:flex-1",
    ),
  );
  assert.equal(
    source.includes(
      "w-full min-w-0 break-words text-sm font-semibold uppercase tracking-[0.04em] text-vetneb-ink sm:flex-1",
    ),
    false,
  );
  assert.ok(
    source.includes(
      "clinical-pill max-w-full self-start break-words px-3.5 py-1.5 text-base font-bold tracking-normal shadow-sm sm:ml-auto sm:shrink-0",
    ),
  );
  assert.ok(source.includes("normalizePriceLabel(item.priceLabel)"));
});

test("precios page preserves fallback labels and error/empty states", () => {
  const source = read(PRECIOS_CONTENT_PATH);

  assert.ok(source.includes('return normalizedPriceLabel ? normalizedPriceLabel : "Consultar";'));
  assert.ok(source.includes("No se pudieron cargar los precios. Intente nuevamente."));
  assert.ok(source.includes("No hay precios disponibles."));
  assert.ok(source.includes("Cargando precios disponibles..."));
  assert.ok(source.includes("hasPricingItems(pricingCategories)"));
  assert.ok(source.includes('role="alert"'));
});

test("precios page only shows load error when client getPublicPricing fails", () => {
  const source = read(PRECIOS_CONTENT_PATH);

  assert.ok(source.includes("useEffect(() => {"));
  assert.ok(source.includes("const [state, setState] = useState<PricingState>"));
  assert.ok(source.includes("const cachedSnapshot = getCachedPublicPricingSnapshot();"));
  assert.ok(source.includes("await getPublicPricing("));
  assert.ok(source.includes('{ throwOnError: true },'));
  assert.ok(source.includes("categories: sortPricingCategories(pricingSnapshot.categories),"));
  assert.ok(source.includes("} catch {"));
  assert.ok(source.includes('setState({ status: "error", categories: [] });'));
  assert.ok(source.includes("pricingLoadError ? ("));
  assert.ok(source.includes(": hasPricingItems(pricingCategories) ? ("));
});

test("precios page and content do not contain demo or simulated content (PR-15 guard)", () => {
  const pageSource = read(PRECIOS_PAGE_PATH);
  const contentSource = read(PRECIOS_CONTENT_PATH);
  const combined = `${pageSource}\n${contentSource}`;
  const demoTerms = [
    "DEMOSTRATIVO",
    "DEMO-000",
    "Paciente demostrativo",
    "Ejemplo visual sin datos reales",
    "ReportPreviewCard",
  ];

  for (const term of demoTerms) {
    assert.equal(
      combined.includes(term),
      false,
      `precios must not contain "${term}"`,
    );
  }
});

test("precios page separates compact hero from light catalog band (PR-19)", () => {
  const source = read(PRECIOS_CONTENT_PATH);

  assert.ok(
    source.includes("public-secondary-hero-surface public-band-compact"),
    "hero must stay on the shared dark surface with compact band rhythm",
  );
  assert.ok(
    source.includes("public-evidence-band-light public-band-compact"),
    "catalog must live on a light evidence band outside the hero",
  );

  const heroIndex = source.indexOf("public-secondary-hero-surface");
  const catalogBandIndex = source.indexOf("public-evidence-band-light");
  assert.ok(heroIndex !== -1);
  assert.ok(catalogBandIndex !== -1);
  assert.ok(
    heroIndex < catalogBandIndex,
    "hero section must render before the catalog band",
  );

  const incluidoIndex = source.indexOf("Incluido en cada estudio");
  const catalogGridIndex = source.indexOf(
    "{pricingCategories.map((category) => {",
  );
  assert.ok(incluidoIndex !== -1);
  assert.ok(catalogGridIndex !== -1);
  assert.ok(
    incluidoIndex < catalogGridIndex,
    "'Incluido en cada estudio' must appear before the pricing catalog",
  );

  const consultarBlockIndex = source.indexOf("Estudios con valor a Consultar");
  assert.ok(consultarBlockIndex !== -1);
  assert.ok(
    catalogGridIndex < consultarBlockIndex,
    "'Estudios con valor a Consultar' must close the catalog as actionable CTA",
  );
});

test("precios page renders grouped categories and study items when categories exist", () => {
  const source = read(PRECIOS_CONTENT_PATH);

  assert.ok(source.includes("{pricingCategories.map((category) => {"));
  assert.ok(source.includes("key={category.category}"));
  assert.ok(source.includes("{category.items.map((item, index) => ("));
  assert.ok(source.includes("index < category.items.length - 1"));
  assert.ok(source.includes("{item.studyName}"));
  assert.ok(source.includes("{normalizePriceLabel(item.priceLabel)}"));
});
