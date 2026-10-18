import assert from "node:assert/strict";
import test from "node:test";
import {
  COLLECTION_GRID_REGIME,
  COLLECTION_VIEWS,
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
