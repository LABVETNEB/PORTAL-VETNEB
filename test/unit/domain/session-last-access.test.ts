import test from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS,
  shouldRefreshSessionLastAccess,
} from "../../../server/lib/session-last-access.ts";

test("shouldRefreshSessionLastAccess refreshes missing last access timestamps", () => {
  assert.equal(shouldRefreshSessionLastAccess(null, Date.now()), true);
  assert.equal(shouldRefreshSessionLastAccess(undefined, Date.now()), true);
});

test("shouldRefreshSessionLastAccess keeps fresh sessions untouched", () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);
  const freshLastAccess = new Date(
    now - SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS + 1,
  );

  assert.equal(shouldRefreshSessionLastAccess(freshLastAccess, now), false);
});

test("shouldRefreshSessionLastAccess refreshes stale sessions at the interval boundary", () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);
  const staleLastAccess = new Date(now - SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS);

  assert.equal(shouldRefreshSessionLastAccess(staleLastAccess, now), true);
});

test("shouldRefreshSessionLastAccess supports custom refresh intervals", () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);
  const lastAccess = new Date(now - 1_000);

  assert.equal(shouldRefreshSessionLastAccess(lastAccess, now, 2_000), false);
  assert.equal(shouldRefreshSessionLastAccess(lastAccess, now, 1_000), true);
});
