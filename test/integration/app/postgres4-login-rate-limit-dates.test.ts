import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { inArray } from "drizzle-orm";

const { ENV } = await import("../../../server/lib/env.ts");

const target = new URL(ENV.databaseUrl);

if (
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  target.port !== "5432" ||
  target.pathname !== "/portal_vetneb_ci"
) {
  throw new Error(
    "POSTGRES4-HOTFIX requiere exclusivamente portal_vetneb_ci local",
  );
}

const {
  db,
  closeDbConnection,
  consumeLoginRateLimitAttempt,
  incrementLoginRateLimitEntry,
  getLoginRateLimitEntry,
} = await import("../../../server/db.ts");

const {
  loginRateLimits,
} = await import("../../../drizzle/schema.ts");

test("POSTGRES4-HOTFIX: fechas UTC, conflicto, reinicio y concurrencia", async (t) => {
  const keys: string[] = [];

  const newKey = () => {
    const key = `pg4-hotfix-${randomUUID()}`;
    keys.push(key);
    return key;
  };

  t.after(async () => {
    try {
      if (keys.length > 0) {
        await db
          .delete(loginRateLimits)
          .where(inArray(loginRateLimits.keyHash, keys));
      }
    } finally {
      await closeDbConnection();
    }
  });

  const start = new Date("2026-11-06T23:59:59.123Z");
  const reset = new Date(start.getTime() + 60_000);

  // Primera insercion y conflicto por el mismo identificador.
  const consumeKey = newKey();

  const first = await consumeLoginRateLimitAttempt({
    keyHash: consumeKey,
    now: start,
    resetAt: reset,
  });

  assert.ok(first);
  assert.equal(first.count, 1);
  assert.equal(first.resetAt.getTime(), reset.getTime());

  const second = await consumeLoginRateLimitAttempt({
    keyHash: consumeKey,
    now: new Date(start.getTime() + 1_000),
    resetAt: reset,
  });

  assert.ok(second);
  assert.equal(second.count, 2);
  assert.equal(second.resetAt.getTime(), reset.getTime());

  // Una ventana vencida debe reiniciar el contador.
  const afterExpiry = new Date(start.getTime() + 61_000);
  const renewedReset = new Date(afterExpiry.getTime() + 60_000);

  const renewed = await consumeLoginRateLimitAttempt({
    keyHash: consumeKey,
    now: afterExpiry,
    resetAt: renewedReset,
  });

  assert.ok(renewed);
  assert.equal(renewed.count, 1);
  assert.equal(renewed.resetAt.getTime(), renewedReset.getTime());

  // Segunda funcion afectada por Date en SQL crudo.
  const incrementKey = newKey();

  const incrementFirst = await incrementLoginRateLimitEntry({
    keyHash: incrementKey,
    count: 1,
    now: start,
    resetAt: reset,
  });

  assert.ok(incrementFirst);
  assert.equal(incrementFirst.count, 1);

  const incrementSecond = await incrementLoginRateLimitEntry({
    keyHash: incrementKey,
    count: 1,
    now: new Date(start.getTime() + 1_000),
    resetAt: reset,
  });

  assert.ok(incrementSecond);
  assert.equal(incrementSecond.count, 2);
  assert.equal(incrementSecond.resetAt.getTime(), reset.getTime());

  const incrementRenewed = await incrementLoginRateLimitEntry({
    keyHash: incrementKey,
    count: 1,
    now: afterExpiry,
    resetAt: renewedReset,
  });

  assert.ok(incrementRenewed);
  assert.equal(incrementRenewed.count, 1);
  assert.equal(incrementRenewed.resetAt.getTime(), renewedReset.getTime());

  // Concurrencia: ninguna actualizacion puede perderse.
  const concurrentKey = newKey();

  await Promise.all(
    Array.from({ length: 16 }, () =>
      consumeLoginRateLimitAttempt({
        keyHash: concurrentKey,
        now: start,
        resetAt: reset,
      }),
    ),
  );

  const concurrent = await getLoginRateLimitEntry(concurrentKey);

  assert.ok(concurrent);
  assert.equal(concurrent.count, 16);
  assert.equal(concurrent.resetAt.getTime(), reset.getTime());
});