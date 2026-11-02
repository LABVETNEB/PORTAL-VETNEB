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

/** Drive tile geometry (audit §65.4, F0-D2): 16 px between tiles, ~220 px minimum track. */
export const COLLECTION_GRID_GAP_PX = 16;
export const COLLECTION_GRID_MIN_TRACK_PX = 220;

/**
 * Drive columns that fit `width`: `floor((width + gap) / (track + gap))`. `minTrack` is the
 * measured track the adopter's content needs (default: Drive's ~220 px).
 */
export function collectionGridFit(width: number, minTrack: number = COLLECTION_GRID_MIN_TRACK_PX): number {
  return Math.floor((Math.max(0, width) + COLLECTION_GRID_GAP_PX) / (minTrack + COLLECTION_GRID_GAP_PX));
}

/** The fit, never below the adopter's contract floor. */
export function collectionGridColumns(width: number, minimumColumns: number, minTrack: number = COLLECTION_GRID_MIN_TRACK_PX): number {
  if (!Number.isInteger(minimumColumns) || minimumColumns < 1) {
    throw new RangeError("collectionGridColumns: minimumColumns must be a positive integer");
  }
  return Math.max(minimumColumns, collectionGridFit(width, minTrack));
}

/** Rows that hold exactly one page of `limit` items in `columns` columns. */
export function collectionGridRows(limit: number, columns: number): number {
  if (!Number.isInteger(columns) || columns < 1) {
    throw new RangeError("collectionGridRows: columns must be a positive integer");
  }
  return Math.max(1, Math.ceil(Math.max(0, limit) / columns));
}
