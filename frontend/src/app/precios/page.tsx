import type { Metadata } from "next";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicPricing, type PublicPricingCategory } from "@/lib/api";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata(
  "Lista de precios",
  "Listado público de estudios de citologías e histopatologías con sus valores de referencia y estado vigente.",
  "/precios",
);

const CATEGORY_PRIORITY = new Map<string, number>([
  ["CITOLOGÍAS", 0],
  ["HISTOPATOLOGÍAS", 1],
]);

function normalizePriceLabel(priceLabel: string | null | undefined): string {
  const normalizedPriceLabel = priceLabel?.trim();

  return normalizedPriceLabel ? normalizedPriceLabel : "Consultar";
}

function hasPricingItems(categories: PublicPricingCategory[]): boolean {
  return categories.some((category) => category.items.length > 0);
}

function sortPricingCategories(
  categories: PublicPricingCategory[],
): PublicPricingCategory[] {
  return categories
    .map((category, index) => ({ category, index }))
    .sort((a, b) => {
      const aPriority = CATEGORY_PRIORITY.get(a.category.category);
      const bPriority = CATEGORY_PRIORITY.get(b.category.category);

      if (aPriority !== undefined && bPriority !== undefined) {
        return aPriority - bPriority;
      }

      if (aPriority !== undefined) {
        return -1;
      }

      if (bPriority !== undefined) {
        return 1;
      }

      return a.index - b.index;
    })
    .map((entry) => entry.category);
}

export default async function PreciosPage() {
  let pricingCategories: PublicPricingCategory[] = [];
  let pricingLoadError = false;

  try {
    const pricingSnapshot = await getPublicPricing(
      { cache: "no-store" },
      { throwOnError: true },
    );

    pricingCategories = sortPricingCategories(pricingSnapshot.categories);
  } catch {
    pricingLoadError = true;
  }

  return (
    <PublicLayout>
      <section
        className="public-soft-canvas py-16 md:py-20"
        aria-labelledby="pricing-page-title"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              Valores de referencia
            </p>
            <h1
              id="pricing-page-title"
              className="text-3xl font-bold text-vetneb-ink md:text-4xl"
            >
              Lista de precios
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Referencia orientativa para la coordinación administrativa. Los
              valores sin definición vigente se muestran como “Consultar”.
            </p>
          </div>

          {pricingLoadError ? (
            <p
              role="alert"
              className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800 shadow-sm"
            >
              No se pudieron cargar los precios. Intente nuevamente.
            </p>
          ) : hasPricingItems(pricingCategories) ? (
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-7 lg:grid-cols-2">
              {pricingCategories.map((category) => (
                <Card
                  key={category.category}
                  className="overflow-hidden border-vetneb-line/90 bg-card shadow-[0_18px_48px_rgba(15,45,62,0.09)] ring-1 ring-slate-200/70"
                >
                  <CardHeader className="border-b border-vetneb-line bg-[hsl(var(--vetneb-navy))] px-6 py-5 text-center text-white">
                    <CardTitle className="text-center text-base font-semibold uppercase tracking-[0.22em] text-white">
                      {category.category}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="bg-vetneb-surface-raised/60 p-4">
                    <div className="overflow-hidden rounded-xl border border-vetneb-line bg-card shadow-sm">
                      {category.items.map((item, index) => (
                        <div
                          key={item.id}
                          className={`flex items-start justify-between gap-5 px-5 py-4 transition-colors hover:bg-vetneb-surface-raised ${
                            index < category.items.length - 1
                              ? "border-b border-vetneb-line/80"
                              : ""
                          }`}
                        >
                          <p className="text-sm font-semibold uppercase tracking-[0.04em] text-vetneb-ink">
                            {item.studyName}
                          </p>
                          <p className="shrink-0 rounded-full border border-vetneb-line bg-vetneb-surface-raised px-3 py-1 text-sm font-bold text-primary shadow-sm">
                            {normalizePriceLabel(item.priceLabel)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="surface-empty mx-auto max-w-4xl">
              No hay precios disponibles.
            </p>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}