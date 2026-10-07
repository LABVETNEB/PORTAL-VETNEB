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
import { Card, CardContent } from "@/components/ui/card";
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

// Single-viewport App Shell: prices are organized by category tabs, and each
// category shows ALL its studies in one view (desktop/tablet space pass): the
// per-item manual form (contract) is one compact row locked to the `regular`
// pitch, so a whole category fits the canvas. The catalog is read in a single
// GET with no paging parameters, so this is presentation only. Should a category
// ever outgrow the measured canvas, it pages instead of scrolling (no-scroll
// contract), with the measured capacity as the page size.
//
// `PRICING_FALLBACK_ITEMS` only covers the pre-measurement capacity read; the
// cap bounds the fallback page size on very tall viewports.
const PRICING_FALLBACK_ITEMS = 1;
const PRICING_MIN_ITEMS = 1;
const PRICING_MAX_ITEMS = 32;

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

// Column grid shared by the header row and every item form, so labels and
// fields line up. From lg up the two read-only columns (public view, last
// update) join; below lg they are secondary and step out (AGENTS §10).
const PRICING_ROW_GRID_CLASS_NAME =
  "grid items-center gap-2 grid-cols-[minmax(0,2fr)_minmax(0,1fr)_4.5rem_7rem_7.5rem] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_4.5rem_7rem_minmax(0,1fr)_9.5rem_7.5rem]";

// Every study of the active category in one view, as one compact form row per
// study (desktop/tablet space pass). The rows keep the per-item manual form
// contract: same fields, same save, same messages. The pager survives only as
// an overflow fallback: when the measured canvas cannot hold the whole
// category, the category pages with the same Anterior/Siguiente control
// instead of scrolling.
function PricingCategoryItems({
  items,
  formStateById,
  savingItemId,
  isSavingAll,
  onUpdateItem,
  onSaveItem,
}: PricingCategoryItemsProps) {
  // Rows are locked to the `regular` row pitch (zero-scroll.css), so the
  // capacity is a pure function of the canvas, never of the rendered forms or
  // of a save message: the message shares the study cell instead of growing
  // the row.
  const [formsBodyNode, setFormsBodyNode] = useState<HTMLElement | null>(null);

  const { capacity, measured } = useDashboardCanvasCapacity({
    canvasNode: formsBodyNode,
    fallbackItems: PRICING_FALLBACK_ITEMS,
    minItems: PRICING_MIN_ITEMS,
    maxItems: PRICING_MAX_ITEMS,
  });

  const fitsInOneView = !measured || items.length <= capacity;
  const paged = usePagedRows(items, fitsInOneView ? Math.max(1, items.length) : capacity);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <div
        aria-hidden="true"
        data-admin-pricing-columns="true"
        className={`${PRICING_ROW_GRID_CLASS_NAME} shrink-0 border-b border-vetneb-line/65 px-2 pb-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground`}
      >
        <span>Estudio</span>
        <span>Precio</span>
        <span>Orden</span>
        <span>Estado</span>
        <span className="hidden lg:block">Vista pública</span>
        <span className="hidden lg:block">Última actualización</span>
        <span className="text-right">Acción</span>
      </div>
      <div
        ref={setFormsBodyNode}
        data-dashboard-adaptive-rows-canvas="true"
        data-dashboard-row-pitch="regular"
        data-admin-pricing-all-items={fitsInOneView ? "true" : "false"}
        className="flex min-h-0 flex-1 flex-col divide-y divide-vetneb-line/60 overflow-hidden"
      >
        {paged.pageItems.map((item) => {
          const formState = formStateById[item.id];

          if (!formState) {
            return null;
          }

          const isSaving = savingItemId === item.id;
          const message = formState.errorMessage ?? formState.statusMessage;

          return (
            <form
              key={item.id}
              data-admin-pricing-item-form
              data-dashboard-adaptive-row="true"
              className="flex items-center px-2"
              onSubmit={(event) => {
                event.preventDefault();
                void onSaveItem(item.id);
              }}
            >
              <fieldset
                className={`${PRICING_ROW_GRID_CLASS_NAME} w-full min-w-0`}
                disabled={isSaving || isSavingAll}
              >
                <div className="min-w-0">
                  <p
                    className="truncate text-xs font-semibold text-vetneb-ink"
                    title={item.studyName}
                  >
                    {item.studyName}
                  </p>
                  {message ? (
                    <p
                      className={`truncate text-[0.68rem] leading-tight ${
                        formState.errorMessage ? "text-destructive" : "text-vetneb-teal"
                      }`}
                      role={formState.errorMessage ? "alert" : "status"}
                      title={message}
                    >
                      {message}
                    </p>
                  ) : null}
                </div>

                <Input
                  aria-label={`Precio de ${item.studyName}`}
                  className="h-8 text-xs"
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

                <Input
                  aria-label={`Orden de ${item.studyName}`}
                  className="h-8 text-xs"
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

                <select
                  aria-label={`Estado de ${item.studyName}`}
                  value={formState.isActive ? "active" : "inactive"}
                  onChange={(event) =>
                    onUpdateItem(item.id, (current) => ({
                      ...current,
                      isActive: event.target.value === "active",
                      statusMessage: null,
                      errorMessage: null,
                    }))
                  }
                  className="field-select h-8 py-1 text-xs"
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>

                <span className="hidden truncate text-xs text-muted-foreground lg:block">
                  <span className="sr-only">Vista pública: </span>
                  {normalizePriceLabel(formState.priceLabel)}
                </span>

                <span className="hidden truncate text-xs text-muted-foreground lg:block">
                  <span className="sr-only">Última actualización: </span>
                  {formatUpdatedAt(item.updatedAt)}
                </span>

                <Button
                  type="submit"
                  size="sm"
                  className="h-8 w-full px-2.5 text-xs"
                  disabled={isSaving || isSavingAll}
                >
                  {isSaving ? "Guardando..." : "Guardar precio"}
                </Button>
              </fieldset>
            </form>
          );
        })}
      </div>

      {fitsInOneView ? null : (
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
      )}
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

  const showCategoryTabs = !loadError && hasPricingItems;
  const pricingActions = (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 px-2.5 text-xs"
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
        size="sm"
        className="h-8 px-2.5 text-xs"
        onClick={() => void loadPricing()}
        disabled={isLoading || savingItemId !== null || isSavingAll}
        aria-busy={isLoading ? true : undefined}
      >
        {isLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {isLoading ? "Actualizando..." : "Actualizar"}
      </Button>
    </>
  );

  // Desktop/tablet space pass: the "Lista de precios" header is retired and
  // Guardar todos / Actualizar ride the category tab bar. Without tabs (load
  // error, empty catalog) they keep a bare action row, so Actualizar stays
  // reachable to retry.
  return (
    <Card className="dashboard-surface flex min-h-0 flex-1 flex-col">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-3">
        {showCategoryTabs ? null : (
          <div className="flex shrink-0 items-center justify-end gap-2">
            {pricingActions}
          </div>
        )}
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

        {showCategoryTabs ? (
          <ModuleTabs
            ariaLabel="Categorías de precios"
            actions={pricingActions}
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
