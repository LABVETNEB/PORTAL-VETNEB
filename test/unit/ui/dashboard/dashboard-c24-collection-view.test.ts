import assert from "node:assert/strict";
import test from "node:test";
import {
  COLLECTION_GRID_REGIME,
  COLLECTION_VIEWS,
  COLLECTION_GRID_GAP_PX,
  COLLECTION_GRID_MIN_TRACK_PX,
  collectionGridColumns,
  collectionGridFit,
  collectionGridRows,
  resolveCollectionView,
} from "../../../../frontend/src/features/dashboard/presentation/surfaces/collection-view.ts";

// C24 · the grid lays out exactly the page the list would show: its rows are
// derived from the measured `limit`, never a capacity of its own (A03).

test("C24 · the two views and the grid regime are the shell phone boundary", () => {
  assert.deepEqual([...COLLECTION_VIEWS], ["list", "grid"]);
  assert.equal(COLLECTION_GRID_REGIME, "(min-width: 768px)");
});

test("C24 · below the grid regime the list is the only view, the preference survives", () => {
  assert.equal(resolveCollectionView("grid", true), "grid");
  assert.equal(resolveCollectionView("list", true), "list");
  assert.equal(resolveCollectionView("grid", false), "list");
  assert.equal(resolveCollectionView("list", false), "list");
});

test("C24 · grid rows hold the whole page without an empty row", () => {
  for (const columns of [2, 3]) {
    for (let limit = 1; limit <= 36; limit += 1) {
      const rows = collectionGridRows(limit, columns);
      assert.ok(rows * columns >= limit, `${limit}/${columns}: every item has a cell`);
      assert.ok((rows - 1) * columns < limit, `${limit}/${columns}: no empty row`);
    }
  }
  assert.equal(collectionGridRows(9, 3), 3);
  assert.equal(collectionGridRows(10, 3), 4);
  assert.equal(collectionGridRows(7, 2), 4);
});

test("C24 · degenerate inputs never yield a zero-row grid or a silent column count", () => {
  assert.equal(collectionGridRows(0, 2), 1);
  assert.equal(collectionGridRows(-4, 3), 1);
  assert.throws(() => collectionGridRows(9, 0), RangeError);
  assert.throws(() => collectionGridRows(9, 1.5), RangeError);
});

test("V5 · the Drive fit is floor((width + 16) / 236) and never drops below the adopter's floor", () => {
  assert.equal(COLLECTION_GRID_GAP_PX, 16);
  assert.equal(COLLECTION_GRID_MIN_TRACK_PX, 220);
  for (const [width, fit] of [[0, 0], [219, 0], [220, 1], [455, 1], [456, 2], [691, 2], [692, 3], [1034, 4], [1577, 6]] as const) {
    assert.equal(collectionGridFit(width), fit, `fit(${width})`);
    assert.equal(collectionGridColumns(width, 3), Math.max(3, fit), `columns(${width}, floor 3)`);
  }
  assert.equal(collectionGridColumns(-50, 2), 2);
  assert.throws(() => collectionGridColumns(900, 0), RangeError);
  assert.throws(() => collectionGridColumns(900, 2.5), RangeError);
});

test("V5 · a measured track widens the minimum and only ever adds columns over the floor", () => {
  assert.equal(collectionGridFit(1034, 250), 3);
  assert.equal(collectionGridFit(1107, 250), 4);
  assert.equal(collectionGridFit(1577, 250), 5);
  assert.equal(collectionGridFit(703, 320), 2);
  assert.equal(collectionGridFit(450, 320), 1);
  assert.equal(collectionGridColumns(450, 2, 320), 2);
  assert.equal(collectionGridColumns(695, 3, 250), 3);
});
