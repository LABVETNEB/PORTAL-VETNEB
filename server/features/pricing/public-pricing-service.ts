// Servicio directo del contexto Pricing para la lectura pública (M19, Fase D).
//
// Retira de `server/routes/public-pricing.fastify.ts` la orquestación que no es
// del adapter HTTP: la composición read-through del cache, la query DB por
// defecto (lazy), el agrupamiento de resultados y la construcción del snapshot.
// La ruta conserva sólo las responsabilidades HTTP (headers, status, logging de
// errores). No conoce Fastify, auth, CORS ni audit: es la mínima abstracción real
// sobre los canónicos de infraestructura de Pricing. No hay reglas de dominio.
import {
  getCachedPublicPricingSnapshot,
  setCachedPublicPricingSnapshot,
  type PublicPricingSnapshot,
} from "./infrastructure/public-pricing-cache.ts";

export type PublicPricingServiceItem = {
  id: number;
  category: string;
  studyName: string;
  priceLabel: string | null;
  displayOrder: number;
};

export type ListPublicPricingItemsFn = () => Promise<PublicPricingServiceItem[]>;

export type PublicPricingCacheStatus = "HIT" | "MISS";

export type PublicPricingReadThrough = {
  snapshot: PublicPricingSnapshot;
  cacheStatus: PublicPricingCacheStatus;
};

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

let defaultListPromise: Promise<ListPublicPricingItemsFn> | undefined;

async function loadDefaultListPublicPricingItems(): Promise<ListPublicPricingItemsFn> {
  if (!defaultListPromise) {
    defaultListPromise = (async () => {
      const pricing = await import("./infrastructure/db-pricing.ts");
      return pricing.listPublicPricingItems;
    })();
  }

  return defaultListPromise;
}

function groupPublicPricingItems(
  items: PublicPricingServiceItem[],
): PublicPricingCategory[] {
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

// Read-through del cache canónico: HIT devuelve el snapshot cacheado por
// referencia sin tocar la DB; MISS ejecuta exactamente una query (la inyectada o
// la canónica lazy), agrupa, construye el snapshot, lo persiste en el cache y lo
// devuelve. Si la query falla, propaga el error ANTES de escribir el cache (sin
// fallback mock silencioso): la ruta traduce a un 500 seguro.
export async function readThroughPublicPricing(
  options: { listPublicPricingItems?: ListPublicPricingItemsFn } = {},
): Promise<PublicPricingReadThrough> {
  const cachedSnapshot = getCachedPublicPricingSnapshot();

  if (cachedSnapshot) {
    return { snapshot: cachedSnapshot, cacheStatus: "HIT" };
  }

  const listPublicPricingItems =
    options.listPublicPricingItems ??
    (await loadDefaultListPublicPricingItems());
  const items = await listPublicPricingItems();

  const snapshot: PublicPricingSnapshot = {
    success: true,
    categories: groupPublicPricingItems(items),
  };

  setCachedPublicPricingSnapshot(snapshot);

  return { snapshot, cacheStatus: "MISS" };
}
