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
      <section className="public-soft-canvas py-16 md:py-20" aria-labelledby="pricing-page-title">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h1
              id="pricing-page-title"
              className="text-3xl font-bold text-vetneb-ink md:text-4xl"
            >
              Lista de precios
            </h1>
          </div>

          {pricingLoadError ? (
            <p role="alert" className="surface-empty text-amber-700">
              No se pudieron cargar los precios. Intente nuevamente.
            </p>
          ) : hasPricingItems(pricingCategories) ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {pricingCategories.map((category) => (
                <Card
                  key={category.category}
                  className="border-vetneb-line bg-vetneb-surface-raised/80"
                >
                  <CardHeader className="border-b border-vetneb-line bg-primary py-4 text-center">
                    <CardTitle className="text-center text-lg font-semibold text-primary-foreground">
                      {category.category}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 p-0">
                    {category.items.map((item, index) => (
                      <div
                        key={item.id}
                        className={`flex items-start justify-between gap-4 px-4 py-3 ${
                          index < category.items.length - 1
                            ? "border-b border-vetneb-line/70"
                            : ""
                        }`}
                      >
                        <p className="text-sm font-medium text-vetneb-ink">
                          {item.studyName}
                        </p>
                        <p className="shrink-0 text-sm font-semibold text-vetneb-ink">
                          {normalizePriceLabel(item.priceLabel)}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="surface-empty">No hay precios disponibles.</p>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
