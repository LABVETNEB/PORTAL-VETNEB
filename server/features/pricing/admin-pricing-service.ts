// Servicio directo del contexto Pricing para la administración (M19, Fase D).
//
// Retira de `server/routes/admin-pricing.fastify.ts` la orquestación de datos que
// no es del adapter HTTP: la carga lazy de la persistencia canónica, el
// agrupamiento del listado, la serialización del DTO, la búsqueda del registro
// previo y la ejecución del update. La ruta conserva el control explícito del
// orden contractual `update -> audit -> clear cache -> response`: la auditoría
// NO vive aquí. El servicio no conoce Fastify, auth, CORS ni audit; sólo compone
// los canónicos de infraestructura de Pricing. No hay reglas de dominio.
import type {
  PricingItem,
  UpdatePricingItemInput,
} from "./infrastructure/db-pricing.ts";
import { clearPublicPricingCache } from "./infrastructure/public-pricing-cache.ts";

export type UpdateAdminPricingPayload = Pick<
  UpdatePricingItemInput,
  "priceLabel" | "isActive" | "displayOrder"
>;

export type ListAdminPricingItemsFn = () => Promise<PricingItem[]>;
export type UpdatePricingItemFn = (
  id: number,
  payload: UpdateAdminPricingPayload & { now?: Date },
) => Promise<PricingItem | null>;

export type AdminPricingDataDeps = {
  listAdminPricingItems: ListAdminPricingItemsFn;
  updatePricingItem: UpdatePricingItemFn;
};

export type AdminPricingCategoryItem = {
  id: number;
  studyName: string;
  priceLabel: string | null;
  displayOrder: number;
  isActive: boolean;
  updatedAt: string;
};

export type AdminPricingCategory = {
  category: string;
  items: AdminPricingCategoryItem[];
};

export type AdminPricingItemDto = {
  id: number;
  category: string;
  studyName: string;
  priceLabel: string | null;
  displayOrder: number;
  isActive: boolean;
  updatedAt: string;
};

export type UpdateAdminPricingItemResult =
  | { status: "not_found" }
  | { status: "updated"; previous: PricingItem; updated: PricingItem };

let defaultDataDepsPromise: Promise<AdminPricingDataDeps> | undefined;

// Carga lazy de la persistencia canónica: sólo se invoca cuando la ruta no
// recibió las dependencias de datos inyectadas. Preserva la invariante de que
// registrar la ruta con todo inyectado no carga `server/db.ts`.
export async function loadDefaultAdminPricingDataDeps(): Promise<AdminPricingDataDeps> {
  if (!defaultDataDepsPromise) {
    defaultDataDepsPromise = (async () => {
      const pricing = await import("./infrastructure/db-pricing.ts");

      return {
        listAdminPricingItems: pricing.listAdminPricingItems,
        updatePricingItem: pricing.updatePricingItem as UpdatePricingItemFn,
      };
    })();
  }

  return defaultDataDepsPromise;
}

export function serializeAdminPricingItem(item: PricingItem): AdminPricingItemDto {
  return {
    id: item.id,
    category: item.category,
    studyName: item.studyName,
    priceLabel: item.priceLabel ?? null,
    displayOrder: item.displayOrder,
    isActive: item.isActive,
    updatedAt: item.updatedAt,
  };
}

export function groupAdminPricingItems(
  items: PricingItem[],
): AdminPricingCategory[] {
  const categories: AdminPricingCategory[] = [];
  let currentCategory: AdminPricingCategory | undefined;

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
      isActive: item.isActive,
      updatedAt: item.updatedAt,
    });
  }

  return categories;
}

export async function listAdminPricingCategories(deps: {
  listAdminPricingItems: ListAdminPricingItemsFn;
}): Promise<AdminPricingCategory[]> {
  const items = await deps.listAdminPricingItems();
  return groupAdminPricingItems(items);
}

// Busca el registro previo y, sólo si existe, ejecuta el update pasando el
// payload SIN alterarlo (más el `now` que fija la ruta). Devuelve previous+updated
// crudos para que la ruta construya la metadata de auditoría; no audita ni limpia
// el cache. `not_found` colapsa los dos 404 contractuales (item inexistente antes
// o después del update), que devuelven la misma respuesta HTTP.
export async function updateAdminPricingItem(
  deps: AdminPricingDataDeps,
  id: number,
  payload: UpdateAdminPricingPayload,
  now: Date,
): Promise<UpdateAdminPricingItemResult> {
  const previous = (await deps.listAdminPricingItems()).find(
    (item) => item.id === id,
  );

  if (!previous) {
    return { status: "not_found" };
  }

  const updated = await deps.updatePricingItem(id, {
    ...payload,
    now,
  });

  if (!updated) {
    return { status: "not_found" };
  }

  return { status: "updated", previous, updated };
}

// Invalidación del cache público expuesta como operación explícita para que la
// ruta la invoque en el punto exacto del orden (después de una auditoría exitosa),
// sin importar el módulo de cache directamente.
export function invalidatePublicPricingCache(): void {
  clearPublicPricingCache();
}
