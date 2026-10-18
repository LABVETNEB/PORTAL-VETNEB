/**
 * C24 · list/grid alternation, pure part. The grid is a second presentation of
 * the page the list already shows: same dataset, same measured `limit`, same
 * pager. It never asks for a capacity of its own, so A03 cannot move.
 */
export const COLLECTION_VIEWS = ["list", "grid"] as const;

export type CollectionView = (typeof COLLECTION_VIEWS)[number];

/** The B09/C23a phone boundary: below it the list is the only view. */
export const COLLECTION_GRID_REGIME = "(min-width: 768px)";

export function resolveCollectionView(preferred: CollectionView, gridRegime: boolean): CollectionView {
  return gridRegime ? preferred : "list";
}

/** Rows that hold exactly one page of `limit` items in `columns` columns. */
export function collectionGridRows(limit: number, columns: number): number {
  if (!Number.isInteger(columns) || columns < 1) {
    throw new RangeError("collectionGridRows: columns must be a positive integer");
  }
  return Math.max(1, Math.ceil(Math.max(0, limit) / columns));
}
