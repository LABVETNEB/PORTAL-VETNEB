import type { FastifyPluginAsync, FastifyReply } from "fastify";

import {
  getCachedPublicPricingSnapshot,
  setCachedPublicPricingSnapshot,
  type PublicPricingSnapshot,
} from "../lib/public-pricing-cache.ts";

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

const PUBLIC_PRICING_HTTP_CACHE_CONTROL =
  "public, max-age=60, stale-while-revalidate=300";

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

function attachPublicPricingCacheHeaders(
  reply: FastifyReply,
  cacheStatus: "HIT" | "MISS",
) {
  reply.header("Cache-Control", PUBLIC_PRICING_HTTP_CACHE_CONTROL);
  reply.header("X-Pricing-Cache", cacheStatus);
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
      const cachedSnapshot = getCachedPublicPricingSnapshot();

      if (cachedSnapshot) {
        attachPublicPricingCacheHeaders(reply, "HIT");
        return reply.code(200).send(cachedSnapshot);
      }

      const deps = await resolveDeps();
      const items = await deps.listPublicPricingItems();
      const snapshot: PublicPricingSnapshot = {
        success: true,
        categories: groupPublicPricingItems(items),
      };

      setCachedPublicPricingSnapshot(snapshot);
      attachPublicPricingCacheHeaders(reply, "MISS");

      return reply.code(200).send(snapshot);
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
