"use client";

import { useEffect, useState } from "react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicPricing, type PublicPricingCategory } from "@/lib/api";
import {
  getCachedPublicPricingSnapshot,
  setCachedPublicPricingSnapshot,
} from "@/lib/public-pricing-cache";

const CATEGORY_PRIORITY = new Map<string, number>([
  ["CITOLOGÍAS", 0],
  ["HISTOPATOLOGÍAS", 1],
]);

type PricingState =
  | { status: "loading"; categories: PublicPricingCategory[] }
  | { status: "success"; categories: PublicPricingCategory[] }
  | { status: "error"; categories: PublicPricingCategory[] };

function normalizePriceLabel(priceLabel: string | null | undefined): string {
  const normalizedPriceLabel = priceLabel?.trim();

  return normalizedPriceLabel ? normalizedPriceLabel : "Consultar";
}

function hasPricingItems(categories: PublicPricingCategory[]): boolean {
  return categories.some((category) => category.items.length > 0);
}

function toSemanticId(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "categoria"
  );
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

export function PreciosContent() {
  const [state, setState] = useState<PricingState>({
    status: "loading",
    categories: [],
  });

  useEffect(() => {
    let isCurrent = true;

    async function loadPricing() {
      try {
        const cachedSnapshot = getCachedPublicPricingSnapshot();
        const pricingSnapshot =
          cachedSnapshot ??
          (await getPublicPricing(
            { cache: "no-store" },
            { throwOnError: true },
          ));

        if (!cachedSnapshot && pricingSnapshot.success) {
          setCachedPublicPricingSnapshot(pricingSnapshot);
        }

        if (!isCurrent) {
          return;
        }

        setState({
          status: "success",
          categories: sortPricingCategories(pricingSnapshot.categories),
        });
      } catch {
        if (!isCurrent) {
          return;
        }

        setState({ status: "error", categories: [] });
      }
    }

    void loadPricing();

    return () => {
      isCurrent = false;
    };
  }, []);

  const pricingCategories = state.categories;
  const pricingLoadError = state.status === "error";

  return (
    <PublicLayout>
      <section
        className="public-secondary-hero-surface py-16 text-white md:py-20"
        aria-labelledby="pricing-page-title"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-primary-foreground/90">
              Valores de referencia
            </p>
            <h1
              id="pricing-page-title"
              className="text-3xl font-bold text-primary-foreground md:text-4xl"
            >
              Lista de precios
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-primary-foreground/88 md:text-base">
              Referencia orientativa para la coordinación administrativa. Los
              valores sin definición vigente se muestran como “Consultar”.
            </p>
          </div>

          <section aria-labelledby="pricing-catalog-heading">
            <h2 id="pricing-catalog-heading" className="sr-only">
              Catálogo público de precios por categoría
            </h2>

            {state.status === "loading" ? (
              <p className="surface-empty mx-auto max-w-4xl">
                Cargando precios disponibles...
              </p>
            ) : pricingLoadError ? (
              <p
                role="alert"
                className="mx-auto max-w-4xl rounded-lg bg-vetneb-surface-raised/92 px-5 py-4 text-center text-sm font-medium text-vetneb-navy shadow-none"
              >
                No se pudieron cargar los precios. Intente nuevamente.
              </p>
            ) : hasPricingItems(pricingCategories) ? (
              <div className="mx-auto grid max-w-7xl grid-cols-1 gap-7 lg:grid-cols-2">
                {pricingCategories.map((category) => {
                  const categoryHeadingId = `pricing-category-${toSemanticId(category.category)}`;

                  return (
                    <article
                      key={category.category}
                      aria-labelledby={categoryHeadingId}
                    >
                      <Card className="clinical-card overflow-hidden">
                        <CardHeader className="clinical-card-header border-b border-vetneb-line px-6 py-5 text-center">
                          <CardTitle
                            id={categoryHeadingId}
                            className="text-center text-base font-semibold uppercase tracking-[0.22em] text-white"
                          >
                            {category.category}
                          </CardTitle>
                        </CardHeader>

                        <CardContent className="bg-vetneb-surface-raised/60 p-4">
                          <div className="overflow-hidden rounded-lg border border-vetneb-line bg-card shadow-sm">
                            {category.items.map((item, index) => (
                              <div
                                key={item.id}
                                className={`clinical-hover-row flex flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5 ${
                                  index < category.items.length - 1
                                    ? "border-b border-vetneb-line/80"
                                    : ""
                                }`}
                              >
                                <p className="w-full min-w-0 break-words text-sm font-semibold uppercase tracking-[0.04em] text-vetneb-ink sm:flex-1">
                                  {item.studyName}
                                </p>
                                <p className="clinical-pill max-w-full self-start break-words px-3 py-1 text-sm font-bold tracking-normal shadow-sm sm:ml-auto sm:shrink-0">
                                  {normalizePriceLabel(item.priceLabel)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="surface-empty mx-auto max-w-4xl">
                No hay precios disponibles.
              </p>
            )}
          </section>
        </div>
      </section>
    </PublicLayout>
  );
}
