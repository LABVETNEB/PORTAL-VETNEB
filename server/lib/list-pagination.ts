export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;
export const DEFAULT_LIST_OFFSET = 0;
export const MAX_LIST_OFFSET = 100_000;

export type ListPaginationOptions = {
  defaultLimit?: number;
  maxLimit?: number;
  defaultOffset?: number;
  maxOffset?: number;
};

export function normalizeListLimit(
  value: unknown,
  options: Pick<ListPaginationOptions, "defaultLimit" | "maxLimit"> = {},
) {
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIST_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_LIST_LIMIT;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultLimit;
  }

  return Math.min(Math.max(Math.trunc(value), 1), maxLimit);
}

export function normalizeListOffset(
  value: unknown,
  options: Pick<ListPaginationOptions, "defaultOffset" | "maxOffset"> = {},
) {
  const defaultOffset = options.defaultOffset ?? DEFAULT_LIST_OFFSET;
  const maxOffset = options.maxOffset ?? MAX_LIST_OFFSET;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultOffset;
  }

  return Math.min(Math.max(Math.trunc(value), 0), maxOffset);
}

export function normalizeListPagination(
  input:
    | {
        limit?: unknown;
        offset?: unknown;
      }
    | undefined,
  options: ListPaginationOptions = {},
) {
  return {
    limit: normalizeListLimit(input?.limit, options),
    offset: normalizeListOffset(input?.offset, options),
  };
}
