import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { pgClient, consumeLoginRateLimitAttempt, incrementLoginRateLimitEntry } = await import(
  "../../../server/db.ts"
);

type Captured = { query: string; params: unknown[] };

const NOW = new Date("2026-11-06T15:04:05.123Z");
const RESET_AT = new Date("2026-11-06T15:19:05.123Z");

async function capture(run: () => Promise<unknown>): Promise<Captured> {
  const calls: Captured[] = [];
  const original = pgClient.unsafe;
  const rows = [[2, "2026-11-06 15:19:05.123"]];
  pgClient.unsafe = ((query: string, params: unknown[] = []) => {
    calls.push({ query, params });
    return Object.assign(Promise.resolve(rows), { values: async () => rows });
  }) as unknown as typeof pgClient.unsafe;
  try {
    await run();
  } finally {
    pgClient.unsafe = original;
  }
  assert.equal(calls.length, 1, "un único statement: el upsert sigue siendo atómico");
  return calls[0]!;
}

test("postgres@4 + drizzle: un Date crudo llega sin serializar y el driver lo rechaza", () => {
  const serialize = pgClient.options.serializers[1184] as (value: unknown) => unknown;
  const out = serialize(NOW);
  assert.ok(out instanceof Date, "drizzle neutraliza el serializer de timestamptz");
  assert.throws(() => Buffer.byteLength(out as unknown as string), { code: "ERR_INVALID_ARG_TYPE" });
});

for (const [name, run] of [
  [
    "consumeLoginRateLimitAttempt",
    () => consumeLoginRateLimitAttempt({ keyHash: "k", resetAt: RESET_AT, now: NOW }),
  ],
  [
    "incrementLoginRateLimitEntry",
    () => incrementLoginRateLimitEntry({ keyHash: "k", count: 1, resetAt: RESET_AT, now: NOW }),
  ],
] as const) {
  test(`${name}: no liga Date crudos y conserva el instante UTC del mapeador de columna`, async () => {
    const { query, params } = await capture(run);

    assert.deepEqual(
      params.filter((value) => value instanceof Date),
      [],
      "postgres@4 rechaza un Date ligado en SQL crudo (ERR_INVALID_ARG_TYPE)",
    );
    for (const value of params) {
      assert.ok(value === null || ["string", "number"].includes(typeof value), String(value));
    }

    assert.match(query, /^insert into "login_rate_limits" .* on conflict \("key_hash"\) do update set /s);

    const nowRefs = params.flatMap((value, index) => (value === NOW.toISOString() ? [index + 1] : []));
    const resetRefs = params.flatMap((value, index) => (value === RESET_AT.toISOString() ? [index + 1] : []));
    // created_at, updated_at (insert), updated_at (update) + dos comparaciones del CASE.
    assert.equal(nowRefs.length, 5);
    // reset_at (insert) + rama de reinicio del CASE.
    assert.equal(resetRefs.length, 2);

    const caseNow = query.match(/"reset_at" <= \$(\d+)::timestamp/g) ?? [];
    assert.equal(caseNow.length, 2, "ambos CASE comparan contra now como timestamp sin zona");
    for (const ref of caseNow) {
      assert.ok(nowRefs.includes(Number(/\$(\d+)/.exec(ref)![1])));
    }
    const resetCast = new RegExp(`THEN \\$(${resetRefs.join("|")})::timestamp`);
    assert.match(query, resetCast, "la ventana reiniciada usa el mismo instante UTC que el insert");
  });
}
