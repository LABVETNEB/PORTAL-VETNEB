"use client";

import { useSearchParams } from "next/navigation";

import { GLOBAL_SEARCH_REPORT_ID_PARAM } from "@/lib/global-search";

/**
 * GLOBAL-SEARCH-3A · the report a deep link asks a module to open
 * (`?reportId=`). Canonical digits within the `integer` range only, the same
 * rule the server applies to `/:reportId`; anything else is no request.
 */
export function useRequestedReportId(): number | null {
  const value = useSearchParams()?.get(GLOBAL_SEARCH_REPORT_ID_PARAM) ?? null;
  if (!value || !/^[1-9][0-9]{0,9}$/.test(value)) return null;
  const id = Number(value);
  return id <= 2_147_483_647 ? id : null;
}
