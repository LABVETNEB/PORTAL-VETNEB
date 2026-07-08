import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContactRateLimitKey,
  CONTACT_RATE_LIMIT_ERROR_MESSAGE,
  CONTACT_RATE_LIMIT_MAX_ATTEMPTS,
  CONTACT_RATE_LIMIT_WINDOW_MS,
  normalizeContactClientIdentifier,
} from "../../../server/lib/contact-rate-limit.ts";

test("contact rate limit policy constants are stable", () => {
  assert.equal(CONTACT_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000);
  assert.equal(CONTACT_RATE_LIMIT_MAX_ATTEMPTS, 5);
  assert.equal(
    CONTACT_RATE_LIMIT_ERROR_MESSAGE,
    "Demasiadas solicitudes. Intentá nuevamente en unos minutos.",
  );
});

test("contact client identifier normalization accepts one bounded IP value", () => {
  assert.equal(
    normalizeContactClientIdentifier(" 198.51.100.60, 203.0.113.60 "),
    "198.51.100.60",
  );
  assert.equal(
    normalizeContactClientIdentifier("::ffff:198.51.100.61"),
    "198.51.100.61",
  );
  assert.equal(normalizeContactClientIdentifier("not-an-ip"), "unknown");
  assert.equal(normalizeContactClientIdentifier("1".repeat(65)), "unknown");
});

test("contact rate limit key is stable isolated and does not retain the raw IP", () => {
  const first = buildContactRateLimitKey("198.51.100.70");
  const firstAgain = buildContactRateLimitKey("198.51.100.70");
  const second = buildContactRateLimitKey("198.51.100.71");

  assert.equal(first, firstAgain);
  assert.notEqual(first, second);
  assert.equal(first.includes("198.51.100.70"), false);
  assert.match(first, /^[a-f0-9]{64}$/);
});
