import test from "node:test";
import assert from "node:assert/strict";
import type { FastifyReply, FastifyRequest } from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.CORS_ORIGIN ??= "https://vetneb.com.ar";

const { ENV } = await import("../server/lib/env.ts");
const {
  UNSAFE_METHODS,
  getAllowedOrigins,
  normalizeOrigin,
  getOriginHeader,
  getAllowedOriginForCors,
  getRequestOrigin,
  enforceTrustedOrigin,
  enforceTrustedOriginRequired,
} = await import("../server/lib/cors-headers.ts");

// ---------------------------------------------------------------------------
// Fakes mínimos: las funciones sólo leen method/headers y, para
// enforceTrustedOrigin, usan reply.code(n).send(body).
// ---------------------------------------------------------------------------

function fakeRequest(
  headers: Record<string, string | undefined>,
  method = "GET",
): FastifyRequest {
  return { method, headers, url: "/" } as unknown as FastifyRequest;
}

function fakeReply() {
  const state: { statusCode: number | null; body: unknown } = {
    statusCode: null,
    body: undefined,
  };
  const reply = {
    code(n: number) {
      state.statusCode = n;
      return reply;
    },
    send(body: unknown) {
      state.body = body;
      return reply;
    },
  };
  return { reply: reply as unknown as FastifyReply, state };
}

// ---------------------------------------------------------------------------
// normalizeOrigin
// ---------------------------------------------------------------------------

test("normalizeOrigin devuelve el origen en minúsculas y null para valores inválidos", () => {
  assert.equal(
    normalizeOrigin("HTTPS://VetNeb.com.AR/particulares"),
    "https://vetneb.com.ar",
  );
  assert.equal(normalizeOrigin("http://localhost:3000"), "http://localhost:3000");
  assert.equal(normalizeOrigin("no-es-una-url"), null);
  assert.equal(normalizeOrigin(""), null);
});

// ---------------------------------------------------------------------------
// getOriginHeader
// ---------------------------------------------------------------------------

test("getOriginHeader recorta el header Origin y devuelve '' cuando no es string", () => {
  assert.equal(
    getOriginHeader(fakeRequest({ origin: "  https://vetneb.com.ar  " })),
    "https://vetneb.com.ar",
  );
  assert.equal(getOriginHeader(fakeRequest({})), "");
});

// ---------------------------------------------------------------------------
// getAllowedOriginForCors
// ---------------------------------------------------------------------------

test("getAllowedOriginForCors refleja el Origin crudo sólo si está en la allowlist", () => {
  const allowed = new Set(["https://vetneb.com.ar"]);

  assert.equal(
    getAllowedOriginForCors(
      fakeRequest({ origin: "https://vetneb.com.ar" }),
      allowed,
    ),
    "https://vetneb.com.ar",
  );
  // Origin no permitido → null (no se refleja)
  assert.equal(
    getAllowedOriginForCors(
      fakeRequest({ origin: "https://evil.example" }),
      allowed,
    ),
    null,
  );
  // Sin Origin → null
  assert.equal(getAllowedOriginForCors(fakeRequest({}), allowed), null);
});

// ---------------------------------------------------------------------------
// getRequestOrigin (Origin tiene prioridad sobre Referer)
// ---------------------------------------------------------------------------

test("getRequestOrigin prioriza Origin y cae a Referer; sino null", () => {
  assert.equal(
    getRequestOrigin(
      fakeRequest({
        origin: "https://vetneb.com.ar",
        referer: "https://otro.example/x",
      }),
    ),
    "https://vetneb.com.ar",
  );
  assert.equal(
    getRequestOrigin(fakeRequest({ referer: "https://vetneb.com.ar/ruta" })),
    "https://vetneb.com.ar",
  );
  assert.equal(getRequestOrigin(fakeRequest({})), null);
});

// ---------------------------------------------------------------------------
// enforceTrustedOrigin (variante allow-null: sin Origin/Referer en método
// inseguro → permitido; el hook global de fastify-app cubre cookie-forgery)
// ---------------------------------------------------------------------------

test("enforceTrustedOrigin permite métodos seguros sin tocar la respuesta", () => {
  const allowed = new Set(["https://vetneb.com.ar"]);
  const { reply, state } = fakeReply();

  const result = enforceTrustedOrigin(
    fakeRequest({ origin: "https://evil.example" }, "GET"),
    reply,
    allowed,
  );

  assert.equal(result, true);
  assert.equal(state.statusCode, null);
});

test("enforceTrustedOrigin permite método inseguro con Origin de la allowlist", () => {
  const allowed = new Set(["https://vetneb.com.ar"]);
  const { reply, state } = fakeReply();

  const result = enforceTrustedOrigin(
    fakeRequest({ origin: "https://vetneb.com.ar" }, "POST"),
    reply,
    allowed,
  );

  assert.equal(result, true);
  assert.equal(state.statusCode, null);
});

test("enforceTrustedOrigin permite método inseguro sin Origin ni Referer (allow-null)", () => {
  const allowed = new Set(["https://vetneb.com.ar"]);
  const { reply, state } = fakeReply();

  const result = enforceTrustedOrigin(fakeRequest({}, "POST"), reply, allowed);

  assert.equal(result, true);
  assert.equal(state.statusCode, null);
});

test("enforceTrustedOrigin bloquea método inseguro con Origin externo: 403 'Origen no permitido'", () => {
  const allowed = new Set(["https://vetneb.com.ar"]);
  const { reply, state } = fakeReply();

  const result = enforceTrustedOrigin(
    fakeRequest({ origin: "https://evil.example" }, "POST"),
    reply,
    allowed,
  );

  assert.equal(result, false);
  assert.equal(state.statusCode, 403);
  assert.deepEqual(state.body, {
    success: false,
    error: "Origen no permitido",
  });
});

// ---------------------------------------------------------------------------
// enforceTrustedOriginRequired (variante block-null: sin Origin/Referer en
// método inseguro → 403 para rutas con sesión cookie que lo requieren localmente)
// ---------------------------------------------------------------------------

test("enforceTrustedOriginRequired permite métodos seguros sin tocar la respuesta", () => {
  const allowed = new Set(["https://vetneb.com.ar"]);
  const { reply, state } = fakeReply();

  const result = enforceTrustedOriginRequired(
    fakeRequest({ origin: "https://evil.example" }, "GET"),
    reply,
    allowed,
  );

  assert.equal(result, true);
  assert.equal(state.statusCode, null);
});

test("enforceTrustedOriginRequired permite método inseguro con Origin de la allowlist", () => {
  const allowed = new Set(["https://vetneb.com.ar"]);
  const { reply, state } = fakeReply();

  const result = enforceTrustedOriginRequired(
    fakeRequest({ origin: "https://vetneb.com.ar" }, "PATCH"),
    reply,
    allowed,
  );

  assert.equal(result, true);
  assert.equal(state.statusCode, null);
});

test("enforceTrustedOriginRequired bloquea método inseguro sin Origin ni Referer: 403 'Origen no permitido'", () => {
  const allowed = new Set(["https://vetneb.com.ar"]);
  const { reply, state } = fakeReply();

  const result = enforceTrustedOriginRequired(
    fakeRequest({}, "PATCH"),
    reply,
    allowed,
  );

  assert.equal(result, false);
  assert.equal(state.statusCode, 403);
  assert.deepEqual(state.body, {
    success: false,
    error: "Origen no permitido",
  });
});

test("enforceTrustedOriginRequired bloquea método inseguro con Origin externo: 403 'Origen no permitido'", () => {
  const allowed = new Set(["https://vetneb.com.ar"]);
  const { reply, state } = fakeReply();

  const result = enforceTrustedOriginRequired(
    fakeRequest({ origin: "https://evil.example" }, "PATCH"),
    reply,
    allowed,
  );

  assert.equal(result, false);
  assert.equal(state.statusCode, 403);
  assert.deepEqual(state.body, {
    success: false,
    error: "Origen no permitido",
  });
});

// ---------------------------------------------------------------------------
// getAllowedOrigins + UNSAFE_METHODS
// ---------------------------------------------------------------------------

test("getAllowedOrigins refleja ENV.corsOrigins normalizado y nunca está vacío", () => {
  const origins = getAllowedOrigins();

  assert.ok(origins.length > 0);
  // Todos en minúsculas y sin espacios
  for (const origin of origins) {
    assert.equal(origin, origin.trim().toLowerCase());
  }
  // Coincide con la allowlist central de ENV (mismo contrato)
  assert.deepEqual(
    origins,
    ENV.corsOrigins.map((o) => o.trim().toLowerCase()),
  );
});

test("UNSAFE_METHODS cubre exactamente POST/PUT/PATCH/DELETE", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.ok(UNSAFE_METHODS.has(method), `falta ${method}`);
  }
  assert.equal(UNSAFE_METHODS.has("GET"), false);
  assert.equal(UNSAFE_METHODS.has("OPTIONS"), false);
  assert.equal(UNSAFE_METHODS.size, 4);
});
