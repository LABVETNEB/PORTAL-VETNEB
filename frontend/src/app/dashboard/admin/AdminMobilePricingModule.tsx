"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAdminPricing,
  updateAdminPricingItem,
  type AdminPricingUpdatePayload,
} from "@/lib/api";
import { AdminMobileConfigModule } from "./AdminMobileConfigModule";
import { AdminMobileOpsPager } from "./AdminMobileOpsPager";

type FlatPricingItem = {
  id: number;
  category: string;
  studyName: string;
  priceLabel: string | null;
  displayOrder: number;
  isActive: boolean;
};

const CATALOG_PAGE_SIZE = 4;

function normalizePriceLabel(value: string | null): string {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : "Consultar";
}

export function AdminMobilePricingModule() {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [items, setItems] = useState<FlatPricingItem[]>([]);
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [priceDraft, setPriceDraft] = useState("");
  const [orderDraft, setOrderDraft] = useState("");
  const [activeDraft, setActiveDraft] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const current = items[index] ?? null;

  function syncDraftFromItem(item: FlatPricingItem | null) {
    setPriceDraft(item?.priceLabel ?? "");
    setOrderDraft(item ? String(item.displayOrder) : "");
    setActiveDraft(item ? item.isActive : true);
    setSaveMessage(null);
    setSaveError(null);
  }

  async function loadPricing() {
    if (!isMobileViewport) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const snapshot = await getAdminPricing();
      const flat: FlatPricingItem[] = snapshot.categories.flatMap((category) =>
        [...category.items]
          .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
          .map((item) => ({
            id: item.id,
            category: category.category,
            studyName: item.studyName,
            priceLabel: item.priceLabel,
            displayOrder: item.displayOrder,
            isActive: item.isActive,
          })),
      );
      setItems(flat);
      setIndex(0);
      syncDraftFromItem(flat[0] ?? null);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los precios.",
      );
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) return;
    void loadPricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobileViewport]);

  function goToIndex(next: number) {
    const bounded = Math.max(0, Math.min(items.length - 1, next));
    setIndex(bounded);
    syncDraftFromItem(items[bounded] ?? null);
  }

  function parseOrder(value: string): number | null {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  async function handleSave() {
    if (!current || isSaving) return;
    const nextOrder = parseOrder(orderDraft);
    if (nextOrder === null) {
      setSaveMessage(null);
      setSaveError("El orden debe ser un entero ≥ 0.");
      return;
    }
    const payload: AdminPricingUpdatePayload = {};
    const nextPrice = priceDraft.trim() ? priceDraft.trim() : null;
    if (nextPrice !== (current.priceLabel?.trim() ? current.priceLabel : null)) {
      payload.priceLabel = nextPrice;
    }
    if (activeDraft !== current.isActive) payload.isActive = activeDraft;
    if (nextOrder !== current.displayOrder) payload.displayOrder = nextOrder;

    if (Object.keys(payload).length === 0) {
      setSaveError(null);
      setSaveMessage("Sin cambios para guardar.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const { pricingItem } = await updateAdminPricingItem(current.id, payload);
      setItems((prev) =>
        prev.map((item) =>
          item.id === pricingItem.id
            ? {
                ...item,
                priceLabel: pricingItem.priceLabel,
                displayOrder: pricingItem.displayOrder,
                isActive: pricingItem.isActive,
              }
            : item,
        ),
      );
      setSaveMessage("Precio actualizado.");
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el precio.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const catalogPage = Math.floor(index / CATALOG_PAGE_SIZE);
  const catalogRows = useMemo(
    () =>
      items.slice(
        catalogPage * CATALOG_PAGE_SIZE,
        catalogPage * CATALOG_PAGE_SIZE + CATALOG_PAGE_SIZE,
      ),
    [items, catalogPage],
  );
  const catalogTotalPages = Math.max(
    1,
    Math.ceil(items.length / CATALOG_PAGE_SIZE),
  );

  const editorSection = (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-vetneb-ink">
            {current ? current.studyName : isLoading ? "Cargando…" : "Sin estudios"}
          </p>
          {current ? (
            <p className="truncate text-[0.66rem] text-muted-foreground">
              {current.category}
            </p>
          ) : null}
        </div>
        {loadError ? null : (
          <Badge
            variant={activeDraft ? "default" : "outline"}
            className="h-5 shrink-0 px-1.5 text-[10px]"
          >
            {activeDraft ? "Activo" : "Inactivo"}
          </Badge>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-3 gap-1.5 overflow-hidden">
        <label className="flex min-h-0 flex-col justify-center gap-0.5 text-[0.66rem] font-medium text-muted-foreground">
          Precio
          <Input
            className="h-8 text-sm"
            value={priceDraft}
            placeholder="Consultar"
            disabled={!current || isSaving}
            onChange={(event) => {
              setPriceDraft(event.target.value);
              setSaveMessage(null);
              setSaveError(null);
            }}
          />
        </label>
        <label className="flex min-h-0 flex-col justify-center gap-0.5 text-[0.66rem] font-medium text-muted-foreground">
          Orden
          <Input
            className="h-8 text-sm"
            type="number"
            min="0"
            inputMode="numeric"
            value={orderDraft}
            disabled={!current || isSaving}
            onChange={(event) => {
              setOrderDraft(event.target.value);
              setSaveMessage(null);
              setSaveError(null);
            }}
          />
        </label>
        <label className="flex min-h-0 flex-col justify-center gap-0.5 text-[0.66rem] font-medium text-muted-foreground">
          Estado
          <select
            className="field-select h-8 text-sm"
            value={activeDraft ? "active" : "inactive"}
            disabled={!current || isSaving}
            onChange={(event) => {
              setActiveDraft(event.target.value === "active");
              setSaveMessage(null);
              setSaveError(null);
            }}
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </label>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2">
        <p
          className={`min-w-0 truncate text-[0.66rem] ${saveError ? "text-destructive" : "text-muted-foreground"}`}
          role={saveError ? "alert" : undefined}
          aria-live="polite"
        >
          {saveError ?? saveMessage ?? `Vista pública: ${normalizePriceLabel(priceDraft)}`}
        </p>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 px-3 text-xs"
          disabled={!current || isSaving}
          aria-busy={isSaving ? true : undefined}
          onClick={() => void handleSave()}
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          Guardar
        </Button>
      </div>

      <AdminMobileOpsPager
        ariaLabel="Paginación de estudios"
        page={items.length ? index + 1 : 0}
        pageCount={items.length || 1}
        rangeLabel={
          current ? `${index + 1} de ${items.length}` : "Sin estudios"
        }
        previousDisabled={index === 0}
        nextDisabled={index >= items.length - 1}
        disabled={isSaving || !items.length}
        onPrevious={() => goToIndex(index - 1)}
        onNext={() => goToIndex(index + 1)}
      />
    </div>
  );

  const catalogSection = (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <p className="shrink-0 truncate text-xs font-semibold text-vetneb-ink">
        {items.length ? `${items.length} estudios` : isLoading ? "Cargando…" : "Catálogo de precios"}
      </p>
      <div className="grid min-h-0 flex-1 grid-rows-4 gap-1.5 overflow-hidden">
        {catalogRows.length ? (
          catalogRows.map((item) => {
            const itemIndex = items.indexOf(item);
            const isCurrent = itemIndex === index;
            return (
              <button
                key={item.id}
                type="button"
                data-admin-mobile-config-item="true"
                onClick={() => goToIndex(itemIndex)}
                className={`flex min-h-0 items-center justify-between gap-2 overflow-hidden rounded-md border px-2.5 py-1.5 text-left ${isCurrent ? "border-vetneb-teal/60 bg-vetneb-surface-muted/60" : "border-vetneb-line/70 bg-card/95"}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-vetneb-ink">
                    {item.studyName}
                  </p>
                  <p className="truncate text-[0.66rem] text-muted-foreground">
                    {item.category} · {normalizePriceLabel(item.priceLabel)}
                  </p>
                </div>
                <Badge
                  variant={item.isActive ? "default" : "outline"}
                  className="h-5 shrink-0 px-1.5 text-[10px]"
                >
                  {item.isActive ? "Activo" : "Inactivo"}
                </Badge>
              </button>
            );
          })
        ) : (
          <div className="row-span-4 flex items-center justify-center px-4 text-center text-xs text-muted-foreground">
            {loadError ?? (isLoading ? "Cargando precios…" : "Sin precios configurados.")}
          </div>
        )}
      </div>
      <AdminMobileOpsPager
        ariaLabel="Paginación de catálogo"
        page={items.length ? catalogPage + 1 : 0}
        pageCount={catalogTotalPages}
        rangeLabel={
          items.length
            ? `${catalogPage * CATALOG_PAGE_SIZE + 1}–${Math.min((catalogPage + 1) * CATALOG_PAGE_SIZE, items.length)} de ${items.length}`
            : "Sin precios"
        }
        previousDisabled={catalogPage === 0}
        nextDisabled={catalogPage >= catalogTotalPages - 1}
        disabled={!items.length}
        onPrevious={() => goToIndex((catalogPage - 1) * CATALOG_PAGE_SIZE)}
        onNext={() => goToIndex((catalogPage + 1) * CATALOG_PAGE_SIZE)}
      />
    </div>
  );

  return (
    <AdminMobileConfigModule
      moduleKey="admin-pricing"
      ariaLabel="Precios"
      sections={[
        { id: "editar", label: "Editar", content: editorSection },
        { id: "catalogo", label: "Catálogo", content: catalogSection },
      ]}
    />
  );
}
