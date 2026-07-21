import { asc, eq } from "drizzle-orm";

import { db } from "../../../db.ts";
import { pricingItems } from "../../../../drizzle/schema.ts";

export type PricingItem = {
  id: number;
  category: string;
  studyName: string;
  priceLabel: string | null;
  displayOrder: number;
  isActive: boolean;
  updatedAt: string;
};

export type UpdatePricingItemInput = {
  priceLabel?: string | null;
  isActive?: boolean;
  displayOrder?: number;
  now?: Date;
};

type PricingItemRow = {
  id: number;
  category: string;
  studyName: string;
  priceLabel: string | null;
  displayOrder: number;
  isActive: boolean;
  updatedAt: Date;
};

function serializePricingItem(row: PricingItemRow): PricingItem {
  return {
    id: row.id,
    category: row.category,
    studyName: row.studyName,
    priceLabel: row.priceLabel ?? null,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function hasPatchFields(input: UpdatePricingItemInput) {
  return (
    Object.prototype.hasOwnProperty.call(input, "priceLabel") ||
    Object.prototype.hasOwnProperty.call(input, "isActive") ||
    Object.prototype.hasOwnProperty.call(input, "displayOrder")
  );
}

async function getPricingItemById(id: number): Promise<PricingItem | null> {
  const rows = await db
    .select({
      id: pricingItems.id,
      category: pricingItems.category,
      studyName: pricingItems.studyName,
      priceLabel: pricingItems.priceLabel,
      displayOrder: pricingItems.displayOrder,
      isActive: pricingItems.isActive,
      updatedAt: pricingItems.updatedAt,
    })
    .from(pricingItems)
    .where(eq(pricingItems.id, id))
    .limit(1);

  const row = rows[0];
  return row ? serializePricingItem(row) : null;
}

export async function listPublicPricingItems(): Promise<PricingItem[]> {
  const rows = await db
    .select({
      id: pricingItems.id,
      category: pricingItems.category,
      studyName: pricingItems.studyName,
      priceLabel: pricingItems.priceLabel,
      displayOrder: pricingItems.displayOrder,
      isActive: pricingItems.isActive,
      updatedAt: pricingItems.updatedAt,
    })
    .from(pricingItems)
    .where(eq(pricingItems.isActive, true))
    .orderBy(
      asc(pricingItems.category),
      asc(pricingItems.displayOrder),
      asc(pricingItems.id),
    );

  return rows.map((row) => serializePricingItem(row));
}

export async function listAdminPricingItems(): Promise<PricingItem[]> {
  const rows = await db
    .select({
      id: pricingItems.id,
      category: pricingItems.category,
      studyName: pricingItems.studyName,
      priceLabel: pricingItems.priceLabel,
      displayOrder: pricingItems.displayOrder,
      isActive: pricingItems.isActive,
      updatedAt: pricingItems.updatedAt,
    })
    .from(pricingItems)
    .orderBy(
      asc(pricingItems.category),
      asc(pricingItems.displayOrder),
      asc(pricingItems.id),
    );

  return rows.map((row) => serializePricingItem(row));
}

export async function updatePricingItem(
  id: number,
  input: UpdatePricingItemInput,
): Promise<PricingItem | null> {
  if (!hasPatchFields(input)) {
    return getPricingItemById(id);
  }

  const setValues: {
    priceLabel?: string | null;
    isActive?: boolean;
    displayOrder?: number;
    updatedAt: Date;
  } = {
    updatedAt: input.now ?? new Date(),
  };

  if (Object.prototype.hasOwnProperty.call(input, "priceLabel")) {
    setValues.priceLabel = input.priceLabel ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(input, "isActive")) {
    setValues.isActive = input.isActive;
  }

  if (Object.prototype.hasOwnProperty.call(input, "displayOrder")) {
    setValues.displayOrder = input.displayOrder;
  }

  const rows = await db
    .update(pricingItems)
    .set(setValues)
    .where(eq(pricingItems.id, id))
    .returning({
      id: pricingItems.id,
      category: pricingItems.category,
      studyName: pricingItems.studyName,
      priceLabel: pricingItems.priceLabel,
      displayOrder: pricingItems.displayOrder,
      isActive: pricingItems.isActive,
      updatedAt: pricingItems.updatedAt,
    });

  const row = rows[0];
  return row ? serializePricingItem(row) : null;
}
