"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ModuleTabs } from "@/components/dashboard/ModuleTabs";
import { CompactPager } from "@/components/dashboard/CompactPager";
import { usePagedRows } from "@/components/dashboard/usePagedRows";
import { useDashboardCanvasCapacity } from "@/hooks/useDashboardCanvasCapacity";
import { formatDateTime } from "@/lib/utils";
import {
  BACKEND_CONNECTION_ERROR_MESSAGE,
  getAdminPricing,
  updateAdminPricingItem,
  type AdminPricingCategory,
  type AdminPricingItem,
  type AdminPricingUpdatePayload,
} from "@/lib/api";

// Single-viewport App Shell: prices are organized by category tabs and paginated
// within each category. The per-item manual form (contract) is tall, so the page
// size is derived from the measured forms region instead of a fixed constant —
// a fixed `ITEMS_PER_PAGE = 1` collapsed the editor to one study per page even
// when the viewport had room for more (VIS-ADMIN-002). The full catalog stays
// reachable via category tabs + the compact pager (pagination is preferred over
// scroll per the no-scroll contract).
//
// `PRICING_FALLBACK_ITEMS` covers the pre-measurement paint; the cap bounds the
// effective page size on very tall viewports. The 12px inter-form gap is fed to
// the hook as the row-height surcharge so `floor(height / rowHeight)` counts the
// real stacked footprint. The floor stays at 1 because the tall six-field manual
// form only physically fits a single instance at the shortest supported desktop
// height (1366×768, no-scroll contract); on taller viewports the measured value
// grows to show several studies per page, which is the actual VIS-ADMIN-002 win
// over the previous hard `= 1`.
const PRICING_FALLBACK_ITEMS = 1;
const PRICING_MIN_ITEMS = 1;
const PRICING_MAX_ITEMS = 6;

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

function formatUpdatedAt(value: string): string {
  if (!value.trim()) {
    return "—";
  }

  // Localized `dd/mm/aaaa, hh:mm` instead of the raw backend ISO timestamp
  // (VIS-ADMIN-005). Fall back to a neutral dash if the value is unparseable
  // so the field never surfaces "Invalid Date" to the operator.
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return formatDateTime(value);
}

function formatAdminPricingError(error: unknown, fallback: string) {
  if (error instanceof TypeError) {
    return BACKEND_CONNECTION_ERROR_MESSAGE;
  }

  if (error instanceof Error) {
    return error.message.toLowerCase().includes("failed to fetch")
      ? BACKEND_CONNECTION_ERROR_MESSAGE
      : error.message;
  }

  return fallback;
}

type PricingCategoryItemsProps = {
  items: AdminPricingCategory["items"];
  formStateById: Record<number, PricingItemFormState>;
  savingItemId: number | null;
  isSavingAll: boolean;
  onUpdateItem: (
    itemId: number,
    updater: (current: PricingItemFormState) => PricingItemFormState,
  ) => void;
  onSaveItem: (itemId: number) => void;
};

// Paginated editable studies for a single pricing category. Keeps the per-item
// manual form contract while bounding how many forms render so a page fits one
// desktop viewport without scroll.
function PricingCategoryItems({
  items,
  formStateById,
  savingItemId,
  isSavingAll,
  onUpdateItem,
  onSaveItem,
}: PricingCategoryItemsProps) {
  // ── Adaptive page size (measures EVERY visible form) ─────────────────────
  // A per-item manual form grows when its status/error message appears after a
  // save. Observing only the first form let a later, taller errored form
  // overflow the region and push the pager out of view (PR #1465 review P2).
  //
  // The page size used to come from the MAXIMUM measured form height, which
  // closed a genuine oscillation: an error grows a form -> fewer forms fit ->
  // the tall form unmounts -> the measured height shrinks -> more forms fit ->
  // the error reappears. That needed a monotonic-within-item-set reservation to
  // damp it. With the footprint declared in CSS the oscillation cannot be
  // expressed: no form height reaches the page size, so the damping, the
  // per-form observer and the category-keyed reset all disappear with it.
  const [formsBodyNode, setFormsBodyNode] = useState<HTMLElement | null>(null);

  const { capacity: itemsPerPage } = useDashboardCanvasCapacity({
    canvasNode: formsBodyNode,
    fallbackItems: PRICING_FALLBACK_ITEMS,
    minItems: PRICING_MIN_ITEMS,
    maxItems: PRICING_MAX_ITEMS,
  });

  const paged = usePagedRows(items, itemsPerPage);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        ref={setFormsBodyNode}
        data-dashboard-adaptive-rows-canvas="true"
        data-dashboard-row-pitch="form"
        data-dashboard-row-gap="wide"
        className="flex min-h-0 flex-1 flex-col gap-3 content-start"
      >
        {paged.pageItems.map((item) => {
          const formState = formStateById[item.id];

          if (!formState) {
            return null;
          }

          const isSaving = savingItemId === item.id;

          return (
            <form
              key={item.id}
              data-admin-pricing-item-form
              data-dashboard-adaptive-row="true"
              className="rounded-lg border border-vetneb-line/75 bg-vetneb-surface-raised/76 p-3.5 shadow-[0_8px_22px_rgba(15,45,62,0.07)]"
              onSubmit={(event) => {
                event.preventDefault();
                void onSaveItem(item.id);
              }}
            >
              <fieldset
                className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3"
                disabled={isSaving || isSavingAll}
              >
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Estudio
                  </span>
                  <Input value={item.studyName} readOnly className="bg-card/90" />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Precio
                  </span>
                  <Input
                    value={formState.priceLabel}
                    onChange={(event) =>
                      onUpdateItem(item.id, (current) => ({
                        ...current,
                        priceLabel: event.target.value,
                        statusMessage: null,
                        errorMessage: null,
                      }))
                    }
                    placeholder="Consultar"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Orden
                  </span>
                  <Input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={formState.displayOrder}
                    onChange={(event) =>
                      onUpdateItem(item.id, (current) => ({
                        ...current,
                        displayOrder: event.target.value,
                        statusMessage: null,
                        errorMessage: null,
                      }))
                    }
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Estado
                  </span>
                  <select
                    value={formState.isActive ? "active" : "inactive"}
                    onChange={(event) =>
                      onUpdateItem(item.id, (current) => ({
                        ...current,
                        isActive: event.target.value === "active",
                        statusMessage: null,
                        errorMessage: null,
                      }))
                    }
                    className="field-select"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Vista pública
                  </span>
                  <Input
                    value={normalizePriceLabel(formState.priceLabel)}
                    readOnly
                    className="bg-card/90"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Última actualización
                  </span>
                  <Input
                    value={formatUpdatedAt(item.updatedAt)}
                    readOnly
                    className="bg-card/90"
                  />
                </label>
              </fieldset>

              <div className="mt-3 flex flex-col gap-3 border-t border-vetneb-line/65 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-h-5">
                  {formState.errorMessage ? (
                    <p className="clinical-alert-error px-3 py-2" role="alert">
                      {formState.errorMessage}
                    </p>
                  ) : null}

                  {formState.statusMessage ? (
                    <p className="clinical-alert-success px-3 py-2">
                      {formState.statusMessage}
                    </p>
                  ) : null}
                </div>

                <Button type="submit" className="w-full sm:w-auto" disabled={isSaving || isSavingAll}>
                  {isSaving ? "Guardando..." : "Guardar precio"}
                </Button>
              </div>
            </form>
          );
        })}
      </div>

      <CompactPager
        page={paged.page}
        pageCount={paged.pageCount}
        rangeStart={paged.rangeStart}
        rangeEnd={paged.rangeEnd}
        total={paged.total}
        hasPrev={paged.hasPrev}
        hasNext={paged.hasNext}
        onPrev={paged.goPrev}
        onNext={paged.goNext}
        itemLabel="estudios"
      />
    </div>
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
  const [isSavingAll, setIsSavingAll] = useState(false);

  const hasPricingItems = useMemo(
    () => categories.some((category) => category.items.length > 0),
    [categories],
  );

  const { pendingItemIds, hasPendingValidationErrors } = useMemo(() => {
    const ids: number[] = [];
    let hasErrors = false;

    for (const id of Object.keys(formStateById).map(Number)) {
      const original = originalItemsById[id];
      const form = formStateById[id];

      if (!original || !form) {
        continue;
      }

      const nextDisplayOrder = parseDisplayOrder(form.displayOrder);

      if (nextDisplayOrder === null) {
        ids.push(id);
        hasErrors = true;
        continue;
      }

      const nextPriceLabel = normalizePriceLabelForPayload(form.priceLabel);
      const prevPriceLabel = normalizePriceLabelForPayload(original.priceLabel ?? "");

      if (
        nextPriceLabel !== prevPriceLabel ||
        form.isActive !== original.isActive ||
        nextDisplayOrder !== original.displayOrder
      ) {
        ids.push(id);
      }
    }

    return { pendingItemIds: ids, hasPendingValidationErrors: hasErrors };
  }, [formStateById, originalItemsById]);

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
    } catch (error) {
      setLoadError(formatAdminPricingError(error, LOAD_ERROR_MESSAGE));
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

  async function handleSaveAll() {
    if (savingItemId !== null || isSavingAll || pendingItemIds.length === 0 || hasPendingValidationErrors) {
      return;
    }

    setIsSavingAll(true);

    const toSave = pendingItemIds
      .map((id) => ({ id, ...getUpdatePayload(id) }))
      .filter(
        (item): item is typeof item & { payload: AdminPricingUpdatePayload } =>
          item.payload !== null && item.errorMessage === null,
      );

    for (const { id, payload } of toSave) {
      try {
        const response = await updateAdminPricingItem(id, payload);
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
      } catch (error) {
        updateItemFormState(id, (current) => ({
          ...current,
          statusMessage: null,
          errorMessage: formatAdminPricingError(error, SAVE_ERROR_MESSAGE),
        }));
      }
    }

    setIsSavingAll(false);
  }

  async function handleSaveItem(itemId: number) {
    if (savingItemId !== null || isSavingAll) {
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
    } catch (error) {
      updateItemFormState(itemId, (current) => ({
        ...current,
        statusMessage: null,
        errorMessage: formatAdminPricingError(error, SAVE_ERROR_MESSAGE),
      }));
    } finally {
      setSavingItemId(null);
    }
  }

  return (
    <Card className="dashboard-surface flex min-h-0 flex-1 flex-col">
      <CardHeader className="shrink-0 flex flex-col gap-3 border-b border-vetneb-line/70 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="text-base">Lista de precios</CardTitle>
          <CardDescription>
            Gestión manual de etiquetas de precio por estudio.
          </CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleSaveAll()}
            disabled={
              isLoading ||
              savingItemId !== null ||
              isSavingAll ||
              pendingItemIds.length === 0 ||
              hasPendingValidationErrors
            }
            data-save-all
          >
            {isSavingAll
              ? "Guardando todos..."
              : pendingItemIds.length > 0
                ? `Guardar todos (${pendingItemIds.length})`
                : "Guardar todos"}
          </Button>
          <Button
            type="button"
            onClick={() => void loadPricing()}
            disabled={isLoading || savingItemId !== null || isSavingAll}
            aria-busy={isLoading ? true : undefined}
          >
            {isLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {isLoading ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-4">
        {loadError ? (
          <p
            role="alert"
            className="clinical-alert-warning px-3 py-2"
          >
            {loadError}
          </p>
        ) : null}

        {!loadError && !hasPricingItems ? (
          <p className="surface-empty">
            {isLoading ? "Cargando precios..." : EMPTY_STATE_MESSAGE}
          </p>
        ) : null}

        {!loadError && hasPricingItems ? (
          <ModuleTabs
            ariaLabel="Categorías de precios"
            tabs={categories.map((category) => ({
              id: category.category,
              label: category.category,
              badge: (
                <span className="rounded-full bg-vetneb-surface-muted px-1.5 text-[0.62rem] font-semibold text-muted-foreground">
                  {category.items.length}
                </span>
              ),
              content: (
                <PricingCategoryItems
                  items={category.items}
                  formStateById={formStateById}
                  savingItemId={savingItemId}
                  isSavingAll={isSavingAll}
                  onUpdateItem={updateItemFormState}
                  onSaveItem={handleSaveItem}
                />
              ),
            }))}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
