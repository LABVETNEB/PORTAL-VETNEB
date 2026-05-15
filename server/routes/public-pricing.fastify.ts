import type { FastifyPluginAsync } from "fastify";

type PricingItem = {
  id: number;
  category: string;
  studyName: string;
  priceLabel: string | null;
  displayOrder: number;
};

type ListPublicPricingItemsFn = () => Promise<PricingItem[]>;

export type PublicPricingNativeRoutesOptions = {
  listPublicPricingItems?: ListPublicPricingItemsFn;
};

type NativePublicPricingDeps = Required<
  Pick<PublicPricingNativeRoutesOptions, "listPublicPricingItems">
>;

type PublicPricingCategoryItem = {
  id: number;
  studyName: string;
  priceLabel: string | null;
  displayOrder: number;
};

type PublicPricingCategory = {
  category: string;
  items: PublicPricingCategoryItem[];
};

let defaultDepsPromise: Promise<NativePublicPricingDeps> | undefined;

async function loadDefaultDeps(): Promise<NativePublicPricingDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const pricing = await import("../db-pricing.ts");

      return {
        listPublicPricingItems: pricing.listPublicPricingItems,
      };
    })();
  }

  return defaultDepsPromise;
}

function groupPublicPricingItems(items: PricingItem[]): PublicPricingCategory[] {
  const categories: PublicPricingCategory[] = [];
  let currentCategory: PublicPricingCategory | undefined;

  for (const item of items) {
    if (!currentCategory || currentCategory.category !== item.category) {
      currentCategory = {
        category: item.category,
        items: [],
      };

      categories.push(currentCategory);
    }

    currentCategory.items.push({
      id: item.id,
      studyName: item.studyName,
      priceLabel: item.priceLabel ?? null,
      displayOrder: item.displayOrder,
    });
  }

  return categories;
}

export const publicPricingNativeRoutes: FastifyPluginAsync<
  PublicPricingNativeRoutesOptions
> = async (app, options) => {
  async function resolveDeps(): Promise<NativePublicPricingDeps> {
    const hasAllInjectedDeps = !!options.listPublicPricingItems;
    const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

    return {
      listPublicPricingItems:
        options.listPublicPricingItems ?? defaultDeps!.listPublicPricingItems,
    };
  }

  app.get("/", async (request, reply) => {
    try {
      const deps = await resolveDeps();
      const items = await deps.listPublicPricingItems();

      return reply.code(200).send({
        success: true,
        categories: groupPublicPricingItems(items),
      });
    } catch (error) {
      console.error("[PUBLIC_PRICING_LIST_ERROR]", {
        path: request.url,
        error,
      });

      return reply.code(500).send({
        success: false,
        error: "Error interno del servidor",
      });
    }
  });
};
