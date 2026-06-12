"use client";

import { ArrowRight, CheckCircle2, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { PerspectiveScrollSection } from "@/components/public/PerspectiveScrollSection";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
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

function hasConsultarItems(categories: PublicPricingCategory[]): boolean {
  return categories.some((cat) =>
    cat.items.some((item) => normalizePriceLabel(item.priceLabel) === "Consultar"),
  );
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

function PricingSkeletonGrid() {
  return (
    <div data-pricing-skeleton="true">
      <p className="sr-only">Cargando precios disponibles...</p>
      <div
        className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10"
        aria-hidden="true"
      >
        {[0, 1].map((i) => (
          <div
            key={i}
            className="overflow-hidden rounded-lg border border-vetneb-line/60"
          >
            <div className="clinical-skeleton h-14 w-full" />
            <div className="space-y-3 bg-vetneb-surface-raised/60 p-4">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="clinical-skeleton h-11 w-full rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
        className="public-secondary-hero-surface public-band-compact text-white"
        aria-labelledby="pricing-page-title"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-primary-foreground/90">
              Histopatología · Citología
            </p>
            <h1
              id="pricing-page-title"
              className="text-3xl font-bold text-primary-foreground md:text-4xl"
            >
              Lista de precios
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-primary-foreground/88 md:text-base">
              Valores de referencia para la coordinación de estudios
              anatomopatológicos. Los estudios sin valor definido se coordinan
              por contacto.
            </p>
            <div className="mt-6 flex justify-center">
              <PublicRouteControl
                href="/contacto"
                variant="secondaryOutline"
                className="public-cta-on-hero w-full sm:w-auto"
              >
                Consultar por un estudio
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </PublicRouteControl>
            </div>
          </div>

        </div>
      </section>

      <section
        className="public-evidence-band-light public-band-compact"
        aria-labelledby="pricing-catalog-heading"
      >
        {/* Contenedor general del catálogo: única superficie con perspectiva en
            precios. Filas, valores y badges no llevan transform propio. */}
        <PerspectiveScrollSection intensity="subtle">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="pricing-catalog-heading" className="sr-only">
            Catálogo público de precios por categoría
          </h2>

          {state.status === "loading" ? (
            <PricingSkeletonGrid />
          ) : pricingLoadError ? (
            <p
              role="alert"
              className="mx-auto max-w-4xl rounded-lg border border-vetneb-line/80 bg-vetneb-surface-raised/92 px-5 py-4 text-center text-sm font-medium text-vetneb-navy shadow-none"
            >
              No se pudieron cargar los precios. Intente nuevamente.
            </p>
          ) : hasPricingItems(pricingCategories) ? (
            <>
              <div className="mx-auto mb-8 max-w-7xl">
                <div className="clinical-card px-6 py-5">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-vetneb-ink/70">
                    Incluido en cada estudio
                  </p>
                  <ul className="grid gap-3 sm:grid-cols-3">
                    {[
                      "Informe diagnóstico digital",
                      "Acceso al portal para consulta del caso",
                      "Seguimiento disponible según complejidad del caso",
                    ].map((value) => (
                      <li
                        key={value}
                        className="flex items-center gap-2 text-sm text-vetneb-ink"
                      >
                        <CheckCircle2
                          className="h-4 w-4 shrink-0 text-vetneb-teal"
                          aria-hidden="true"
                        />
                        {value}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
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
                                <p className="w-full min-w-0 break-words text-sm font-medium leading-6 text-vetneb-ink sm:flex-1">
                                  {item.studyName}
                                </p>
                                <p className="clinical-pill max-w-full self-start break-words px-3.5 py-1.5 text-base font-bold tracking-normal shadow-sm sm:ml-auto sm:shrink-0">
                                  {normalizePriceLabel(item.priceLabel)}
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 flex justify-end border-t border-vetneb-line/50 pt-4">
                            <PublicRouteControl
                              href="/contacto"
                              variant="primaryDark"
                              className="public-cta-primary w-full text-sm sm:w-auto"
                            >
                              Consultar este estudio
                              <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </PublicRouteControl>
                          </div>
                        </CardContent>
                      </Card>
                    </article>
                  );
                })}
              </div>

              {hasConsultarItems(pricingCategories) && (
                <div className="mx-auto mt-8 max-w-7xl">
                  <div className="clinical-card px-6 py-5">
                    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <HelpCircle
                          className="mt-0.5 h-5 w-5 shrink-0 text-vetneb-teal"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-sm font-semibold text-vetneb-ink">
                            Estudios con valor a Consultar
                          </p>
                          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                            El precio depende de la complejidad, las tinciones
                            especiales requeridas o la coordinación previa con
                            el laboratorio.
                          </p>
                        </div>
                      </div>
                      <PublicRouteControl
                        href="/contacto"
                        variant="primaryDark"
                        className="public-cta-primary w-full shrink-0 text-sm sm:w-auto"
                      >
                        Coordinar por contacto
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </PublicRouteControl>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="surface-empty mx-auto max-w-4xl">
              No hay precios disponibles.
            </p>
          )}
        </div>
        </PerspectiveScrollSection>
      </section>
    </PublicLayout>
  );
}
