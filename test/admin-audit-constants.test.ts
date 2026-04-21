import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_AUDIT_ACTOR_TYPES,
  ADMIN_AUDIT_EVENTS,
  AUDIT_LOG_CSV_HEADERS,
} from "../server/lib/admin-audit.ts";

test("ADMIN_AUDIT_ACTOR_TYPES expone strings únicos y normalizados", () => {
  assert.equal(Array.isArray(ADMIN_AUDIT_ACTOR_TYPES), true);
  assert.equal(ADMIN_AUDIT_ACTOR_TYPES.length > 0, true);

  const unique = new Set(ADMIN_AUDIT_ACTOR_TYPES);
  assert.equal(unique.size, ADMIN_AUDIT_ACTOR_TYPES.length);

  for (const actorType of ADMIN_AUDIT_ACTOR_TYPES) {
    assert.equal(typeof actorType, "string");
    assert.equal(actorType.trim(), actorType);
    assert.equal(actorType.length > 0, true);
    assert.match(actorType, /^[a-z0-9_]+$/);
  }
});

test("ADMIN_AUDIT_EVENTS expone eventos únicos con formato de dominio", () => {
  assert.equal(Array.isArray(ADMIN_AUDIT_EVENTS), true);
  assert.equal(ADMIN_AUDIT_EVENTS.length > 0, true);

  const unique = new Set(ADMIN_AUDIT_EVENTS);
  assert.equal(unique.size, ADMIN_AUDIT_EVENTS.length);

  for (const eventName of ADMIN_AUDIT_EVENTS) {
    assert.equal(typeof eventName, "string");
    assert.equal(eventName.trim(), eventName);
    assert.equal(eventName.length > 0, true);
    assert.match(eventName, /^[a-z0-9_.]+$/);
    assert.match(eventName, /\./);
  }
});

test("AUDIT_LOG_CSV_HEADERS expone cabeceras únicas y seguras para CSV", () => {
  assert.equal(Array.isArray(AUDIT_LOG_CSV_HEADERS), true);
  assert.equal(AUDIT_LOG_CSV_HEADERS.length > 0, true);

  const unique = new Set(AUDIT_LOG_CSV_HEADERS);
  assert.equal(unique.size, AUDIT_LOG_CSV_HEADERS.length);

  for (const header of AUDIT_LOG_CSV_HEADERS) {
    assert.equal(typeof header, "string");
    assert.equal(header.trim(), header);
    assert.equal(header.length > 0, true);
    assert.doesNotMatch(header, /["\r\n,]/);
  }
});

test("constantes de auditoría mantienen cardinalidades coherentes", () => {
  assert.equal(ADMIN_AUDIT_ACTOR_TYPES.length >= 2, true);
  assert.equal(ADMIN_AUDIT_EVENTS.length >= ADMIN_AUDIT_ACTOR_TYPES.length, true);
  assert.equal(AUDIT_LOG_CSV_HEADERS.length >= 5, true);
});
