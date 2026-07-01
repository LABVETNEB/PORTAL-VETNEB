"use client";

import { useAdaptiveItemsPerPage } from "@/hooks/useAdaptiveItemsPerPage";

export type AdaptiveRowsPerPageOptions = {
  containerNode: HTMLElement | null;
  fallbackRows: number;
  rowHeightPx: number;
  headerHeightPx?: number;
  safetyGapPx?: number;
  minRows?: number;
  maxRows?: number;
  enabled?: boolean;
};

export type UseAdaptiveRowsPerPageOptions = AdaptiveRowsPerPageOptions;

export type AdaptiveRowsPerPageResult = {
  rowsPerPage: number;
};

export type UseAdaptiveRowsPerPageResult = AdaptiveRowsPerPageResult;

export function useAdaptiveRowsPerPage(
  options: AdaptiveRowsPerPageOptions,
): AdaptiveRowsPerPageResult {
  const { itemsPerPage } = useAdaptiveItemsPerPage({
    containerNode: options.containerNode,
    fallbackItems: options.fallbackRows,
    itemHeightPx: options.rowHeightPx,
    headerHeightPx: options.headerHeightPx,
    safetyGapPx: options.safetyGapPx,
    minItems: options.minRows ?? 2,
    maxItems: options.maxRows,
    enabled: options.enabled,
  });

  return { rowsPerPage: itemsPerPage };
}
