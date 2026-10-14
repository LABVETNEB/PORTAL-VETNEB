"use client";

import { X } from "lucide-react";
import { ActionMenu, ActionMenuItem } from "../surfaces/ActionMenu";
import { filterChipName, type ActiveFilter } from "./FilterChip";

/**
 * C11 · the filters that do not fit, on the C08 menu owner (no second surface).
 * Each hidden filter stays readable and, when the consumer allows it, removable;
 * the global clear joins the menu only when the host places it here.
 */
export type FilterOverflowProps = {
  filters: readonly ActiveFilter[];
  onClearAll?: () => void;
  clearAllLabel?: string;
  removeLabel?: string;
  disabled?: boolean;
};

export function FilterOverflow({ filters, onClearAll, clearAllLabel = "Limpiar filtros", removeLabel = "Quitar filtro", disabled = false }: FilterOverflowProps) {
  if (filters.length === 0) return null;
  const count = filters.length;

  return (
    <ActionMenu
      align="end"
      label={`+${count} ${count === 1 ? "filtro activo" : "filtros activos"}`}
      trigger={<span aria-hidden="true">+{count}</span>}
      triggerClassName="shrink-0 rounded-lg text-[0.8125rem] font-medium"
    >
      {filters.map((filter) => {
        const name = filterChipName(filter.label, filter.value);
        const removable = Boolean(filter.onRemove) && !filter.disabled && !disabled;
        return (
          <ActionMenuItem
            key={filter.id}
            icon={removable ? <X aria-hidden="true" /> : undefined}
            disabled={!removable}
            onSelect={() => filter.onRemove?.()}
          >
            <span title={name}>{name}</span>
            {removable ? <span className="sr-only">, {removeLabel}</span> : null}
          </ActionMenuItem>
        );
      })}
      {onClearAll ? (
        <ActionMenuItem disabled={disabled} onSelect={onClearAll}>
          {clearAllLabel}
        </ActionMenuItem>
      ) : null}
    </ActionMenu>
  );
}
