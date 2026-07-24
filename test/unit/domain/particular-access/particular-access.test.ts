import assert from "node:assert/strict";
import test from "node:test";

import {
  belongsToClinic,
  getParticularTokenLast4,
  hasLinkedParticularReport,
} from "../../../../server/features/particular-access/domain/index.ts";

test("Particular Access conserva ownership, hasLinkedReport y tokenLast4 puros", () => {
  assert.equal(belongsToClinic(7, 7), true);
  assert.equal(belongsToClinic(7, 8), false);
  assert.equal(hasLinkedParticularReport(11), true);
  assert.equal(hasLinkedParticularReport(null), false);
  assert.equal(hasLinkedParticularReport(undefined), false);
  assert.equal(getParticularTokenLast4("token-abcdef"), "cdef");
  assert.equal(getParticularTokenLast4("abc"), "abc");
});
