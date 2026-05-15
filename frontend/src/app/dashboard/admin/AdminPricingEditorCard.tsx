"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAdminPricing,
  updateAdminPricingItem,
  type AdminPricingCategory,
  type AdminPricingItem,
  type AdminPricingUpdatePayload,
} from "@/lib/api";

const LOAD_ERROR_MESSAGE = "No se pudieron cargar los precios. Intente nuevamente.";
const EMPTY_STATE_MESSAGE = "No hay precios configurados.";
const SAVE_ERROR_MESSAGE = "No se pudo actualizar el precio. Intente nuevamente.";
const SAVE_SUCCESS_MESSAGE = "Precio actualizado.";
const DISPLAY_ORDER_ERROR_MESSAGE =
  "El orden debe ser un entero mayor o igual a 0.";

type PricingItemFormState = {
  priceLabel: string;
  isActive: boolean;
  displayOrder: string;
  statusMessage: string | null;
  errorMessage: string | null;
};

function normalizePriceLabel(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "Consultar";
}

function normalizePriceLabelForPayload(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toFormState(item: {
  priceLabel: string | null;
  isActive: boolean;
  displayOrder: number;
}): PricingItemFormState {
  return {
    priceLabel: item.priceLabel ?? "",
    isActive: item.isActive,
    displayOrder: String(item.displayOrder),
    statusMessage: null,
    errorMessage: null,
  };
}

function parseDisplayOrder(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function sortCategories(categories: AdminPricingCategory[]): AdminPricingCategory[] {
  return categories.map((category) => ({
    ...category,
    items: [...category.items].sort(
      (a, b) => a.displayOrder - b.displayOrder || a.id - b.id,
    ),
  }));
}

function buildOriginalItemsById(
  categories: AdminPricingCategory[],
): Record<number, AdminPricingItem> {
  const itemsById: Record<number, AdminPricingItem> = {};

  for (const category of categories) {
    for (const item of category.items) {
      itemsById[item.id] = {
        ...item,
        category: category.category,
      };
    }
  }

  return itemsById;
}

function buildFormStateById(
  itemsById: Record<number, AdminPricingItem>,
): Record<number, PricingItemFormState> {
  return Object.fromEntries(
    Object.values(itemsById).map((item) => [item.id, toFormState(item)]),
  );
}

function applyUpdatedItem(
  categories: AdminPricingCategory[],
  updatedItem: AdminPricingItem,
) {
  return sortCategories(
    categories.map((category) => ({
      ...category,
      items: category.items.map((item) =>
        item.id === updatedItem.id
          ? {
              ...item,
              studyName: updatedItem.studyName,
              priceLabel: updatedItem.priceLabel,
              displayOrder: updatedItem.displayOrder,
              isActive: updatedItem.isActive,
              updatedAt: updatedItem.updatedAt,
            }
          : item,
      ),
    })),
  );
}

export function AdminPricingEditorCard() {
  const [categories, setCategories] = useState<AdminPricingCategory[]>([]);
  const [originalItemsById, setOriginalItemsById] = useState<
    Record<number, AdminPricingItem>
  >({});
  const [formStateById, setFormStateById] = useState<
    Record<number, PricingItemFormState>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);

  const hasPricingItems = useMemo(
    () => categories.some((category) => category.items.length > 0),
    [categories],
  );

  async function loadPricing() {
    setIsLoading(true);
    setLoadError(null);

    try {
      const snapshot = await getAdminPricing();
      const sortedCategories = sortCategories(snapshot.categories);
      const nextOriginalItemsById = buildOriginalItemsById(sortedCategories);

      setCategories(sortedCategories);
      setOriginalItemsById(nextOriginalItemsById);
      setFormStateById(buildFormStateById(nextOriginalItemsById));
    } catch {
      setLoadError(LOAD_ERROR_MESSAGE);
      setCategories([]);
      setOriginalItemsById({});
      setFormStateById({});
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPricing();
  }, []);

  function updateItemFormState(
    itemId: number,
    updater: (current: PricingItemFormState) => PricingItemFormState,
  ) {
    setFormStateById((current) => {
      const itemFormState = current[itemId];

      if (!itemFormState) {
        return current;
      }

      return {
        ...current,
        [itemId]: updater(itemFormState),
      };
    });
  }

  function getUpdatePayload(
    itemId: number,
  ): { payload: AdminPricingUpdatePayload | null; errorMessage: string | null } {
    const originalItem = originalItemsById[itemId];
    const formState = formStateById[itemId];

    if (!originalItem || !formState) {
      return { payload: null, errorMessage: SAVE_ERROR_MESSAGE };
    }

    const nextDisplayOrder = parseDisplayOrder(formState.displayOrder);

    if (nextDisplayOrder === null) {
      return { payload: null, errorMessage: DISPLAY_ORDER_ERROR_MESSAGE };
    }

    const nextPriceLabel = normalizePriceLabelForPayload(formState.priceLabel);
    const previousPriceLabel = normalizePriceLabelForPayload(
      originalItem.priceLabel ?? "",
    );

    const payload: AdminPricingUpdatePayload = {};

    if (nextPriceLabel !== previousPriceLabel) {
      payload.priceLabel = nextPriceLabel;
    }

    if (formState.isActive !== originalItem.isActive) {
      payload.isActive = formState.isActive;
    }

    if (nextDisplayOrder !== originalItem.displayOrder) {
      payload.displayOrder = nextDisplayOrder;
    }

    if (
      !Object.prototype.hasOwnProperty.call(payload, "priceLabel") &&
      !Object.prototype.hasOwnProperty.call(payload, "isActive") &&
      !Object.prototype.hasOwnProperty.call(payload, "displayOrder")
    ) {
      return { payload: null, errorMessage: null };
    }

    return { payload, errorMessage: null };
  }

  async function handleSaveItem(itemId: number) {
    if (savingItemId !== null) {
      return;
    }

    updateItemFormState(itemId, (current) => ({
      ...current,
      statusMessage: null,
      errorMessage: null,
    }));

    const { payload, errorMessage } = getUpdatePayload(itemId);

    if (errorMessage) {
      updateItemFormState(itemId, (current) => ({
        ...current,
        statusMessage: null,
        errorMessage,
      }));
      return;
    }

    if (!payload) {
      updateItemFormState(itemId, (current) => ({
        ...current,
        statusMessage: SAVE_SUCCESS_MESSAGE,
        errorMessage: null,
      }));
      return;
    }

    setSavingItemId(itemId);

    try {
      const response = await updateAdminPricingItem(itemId, payload);
      const updatedItem = response.pricingItem;

      setCategories((current) => applyUpdatedItem(current, updatedItem));
      setOriginalItemsById((current) => ({
        ...current,
        [updatedItem.id]: updatedItem,
      }));
      setFormStateById((current) => ({
        ...current,
        [updatedItem.id]: {
          ...toFormState(updatedItem),
          statusMessage: SAVE_SUCCESS_MESSAGE,
          errorMessage: null,
        },
      }));
    } catch {
      updateItemFormState(itemId, (current) => ({
        ...current,
        statusMessage: null,
        errorMessage: SAVE_ERROR_MESSAGE,
      }));
    } finally {
      setSavingItemId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="text-base">Lista de precios</CardTitle>
          <CardDescription>
            Gestión manual de etiquetas de precio por estudio.
          </CardDescription>
        </div>
        <Button
          type="button"
          onClick={() => void loadPricing()}
          disabled={isLoading || savingItemId !== null}
        >
          {isLoading ? "Actualizando..." : "Actualizar"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError ? (
          <p
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            {LOAD_ERROR_MESSAGE}
          </p>
        ) : null}

        {!loadError && !hasPricingItems ? (
          <p className="surface-empty">
            {isLoading ? "Cargando precios..." : EMPTY_STATE_MESSAGE}
          </p>
        ) : null}

        {!loadError && hasPricingItems ? (
          <div className="space-y-4">
            {categories.map((category) => (
              <div
                key={category.category}
                className="overflow-hidden rounded-xl border border-gray-100"
              >
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {category.category}
                  </h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estudio</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Orden</TableHead>
                      <TableHead>Activo</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {category.items.map((item) => {
                      const formState = formStateById[item.id];

                      if (!formState) {
                        return null;
                      }

                      const isSaving = savingItemId === item.id;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="align-top">
                            <p className="text-sm font-medium text-gray-900">
                              {item.studyName}
                            </p>
                          </TableCell>
                          <TableCell className="min-w-64 align-top">
                            <Input
                              value={formState.priceLabel}
                              onChange={(event) =>
                                updateItemFormState(item.id, (current) => ({
                                  ...current,
                                  priceLabel: event.target.value,
                                  statusMessage: null,
                                  errorMessage: null,
                                }))
                              }
                              disabled={isSaving}
                              placeholder="Consultar"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              Vista pública: {normalizePriceLabel(formState.priceLabel)}
                            </p>
                          </TableCell>
                          <TableCell className="w-32 align-top">
                            <Input
                              type="number"
                              min="0"
                              inputMode="numeric"
                              value={formState.displayOrder}
                              onChange={(event) =>
                                updateItemFormState(item.id, (current) => ({
                                  ...current,
                                  displayOrder: event.target.value,
                                  statusMessage: null,
                                  errorMessage: null,
                                }))
                              }
                              disabled={isSaving}
                            />
                          </TableCell>
                          <TableCell className="w-36 align-top">
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={formState.isActive}
                                onChange={(event) =>
                                  updateItemFormState(item.id, (current) => ({
                                    ...current,
                                    isActive: event.target.checked,
                                    statusMessage: null,
                                    errorMessage: null,
                                  }))
                                }
                                disabled={isSaving}
                              />
                              Activo
                            </label>
                          </TableCell>
                          <TableCell className="w-60 align-top text-right">
                            <div className="flex flex-col items-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => void handleSaveItem(item.id)}
                                disabled={isSaving}
                              >
                                {isSaving ? "Guardando..." : "Guardar"}
                              </Button>

                              {formState.errorMessage ? (
                                <p className="text-right text-xs text-red-700" role="alert">
                                  {formState.errorMessage}
                                </p>
                              ) : null}

                              {formState.statusMessage ? (
                                <p className="text-right text-xs text-green-700">
                                  {formState.statusMessage}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
