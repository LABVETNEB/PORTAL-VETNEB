import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

import { buildContactRateLimitKey } from "../../server/lib/contact-rate-limit.ts";
import { registerSignedClientIp } from "../../server/lib/signed-forwarded-ip-hook.ts";
import {
  SIGNED_CLIENT_IP_HEADER,
  SIGNED_CLIENT_IP_MAX_AGE_SECONDS,
  SIGNED_CLIENT_IP_SIGNATURE_HEADER,
  SIGNED_CLIENT_IP_TIMESTAMP_HEADER,
  signClientIp,
  verifySignedClientIp,
} from "../../server/lib/signed-client-ip.ts";

// Valores sintéticos (RFC 5737 / RFC 3849). El secreto es de prueba.
const SECRET = "test-secret-test-secret-test-secret-0123456789";
const OTHER_SECRET = "other-secret-other-secret-other-secret-9876543210";
const CLIENT_1 = "198.51.100.11";
const CLIENT_2 = "198.51.100.22";
const CLIENT_V6 = "2001:db8::1234";
const FORGED = "203.0.113.99";
const NOW = 1_800_000_000;

function sign(ip: string, overrides: Partial<{ ts: number; method: string; path: string; secret: string }> = {}) {
  const headers = signClientIp({
    secret: overrides.secret ?? SECRET,
    ip,
    timestampSeconds: overrides.ts ?? NOW,
    method: overrides.method ?? "GET",
    path: overrides.path ?? "/ip",
  });
  assert.ok(headers);
  return headers;
}

async function buildApp(options: { secret?: string; trustProxy?: string }) {
  const app = Fastify({ logger: false, trustProxy: options.trustProxy ?? false });
  registerSignedClientIp(app, { secret: options.secret, now: () => NOW });
  app.get("/ip", async (request) => ({ ip: request.ip }));
  app.get("/other", async (request) => ({ ip: request.ip }));
  app.post("/upload", async (request) => ({ ip: request.ip, size: String(request.body ?? "").length }));
  return app;
}

async function ipOf(
  app: Awaited<ReturnType<typeof buildApp>>,
  headers: Record<string, string>,
  url = "/ip",
  peer = "127.0.0.1",
) {
  const response = await app.inject({ method: "GET", url, headers, remoteAddress: peer });
  assert.equal(response.statusCode, 200);
  return (response.json() as { ip: string }).ip;
}

test("IP firmada válida sustituye a request.ip e ignora un XFF falsificado", async () => {
  const app = await buildApp({ secret: SECRET });
  try {
    const ip = await ipOf(app, { ...sign(CLIENT_1), "x-forwarded-for": FORGED });
    assert.equal(ip, CLIENT_1);
    assert.equal(await ipOf(app, sign(CLIENT_V6)), CLIENT_V6);
  } finally {
    await app.close();
  }
});

test("sin secreto configurado el hook no existe y los encabezados firmados se ignoran", async () => {
  const app = await buildApp({});
  try {
    assert.equal(await ipOf(app, sign(CLIENT_1)), "127.0.0.1");
  } finally {
    await app.close();
  }
});

test("secreto demasiado corto no habilita la firma (verify y sign devuelven null)", () => {
  assert.equal(signClientIp({ secret: "short", ip: CLIENT_1, timestampSeconds: NOW, method: "GET", path: "/" }), null);
  assert.equal(
    verifySignedClientIp({ secret: "short", headers: sign(CLIENT_1), method: "GET", path: "/ip", nowSeconds: NOW }),
    null,
  );
});

test("firma inválida, IP alterada, secreto distinto o método/ruta distintos caen a la IP resuelta", async () => {
  const app = await buildApp({ secret: SECRET });
  try {
    const good = sign(CLIENT_1);
    // IP alterada con firma original
    assert.equal(await ipOf(app, { ...good, [SIGNED_CLIENT_IP_HEADER]: FORGED }), "127.0.0.1");
    // firma de otro secreto
    assert.equal(await ipOf(app, sign(CLIENT_1, { secret: OTHER_SECRET })), "127.0.0.1");
    // firma basura / longitud incorrecta / mayúsculas
    assert.equal(await ipOf(app, { ...good, [SIGNED_CLIENT_IP_SIGNATURE_HEADER]: "00".repeat(32) }), "127.0.0.1");
    assert.equal(await ipOf(app, { ...good, [SIGNED_CLIENT_IP_SIGNATURE_HEADER]: "abc" }), "127.0.0.1");
    assert.equal(
      await ipOf(app, { ...good, [SIGNED_CLIENT_IP_SIGNATURE_HEADER]: good[SIGNED_CLIENT_IP_SIGNATURE_HEADER].toUpperCase() }),
      "127.0.0.1",
    );
    // método distinto
    assert.equal(await ipOf(app, sign(CLIENT_1, { method: "POST" })), "127.0.0.1");
    // ruta distinta
    assert.equal(await ipOf(app, sign(CLIENT_1, { path: "/other" })), "127.0.0.1");
  } finally {
    await app.close();
  }
});

test("replay: la misma firma no sirve en otra ruta ni fuera de la ventana temporal", async () => {
  const app = await buildApp({ secret: SECRET });
  try {
    const forIp = sign(CLIENT_1, { path: "/ip" });
    assert.equal(await ipOf(app, forIp, "/ip"), CLIENT_1);
    assert.equal(await ipOf(app, forIp, "/other"), "127.0.0.1");
    // la query no forma parte del contrato: misma ruta, misma firma
    assert.equal(await ipOf(app, forIp, "/ip?x=1"), CLIENT_1);
    // vencida y a futuro
    assert.equal(await ipOf(app, sign(CLIENT_1, { ts: NOW - SIGNED_CLIENT_IP_MAX_AGE_SECONDS - 1 })), "127.0.0.1");
    assert.equal(await ipOf(app, sign(CLIENT_1, { ts: NOW - SIGNED_CLIENT_IP_MAX_AGE_SECONDS })), CLIENT_1);
    assert.equal(await ipOf(app, sign(CLIENT_1, { ts: NOW + 60 })), "127.0.0.1");
    // timestamp manipulado sin re-firmar
    assert.equal(await ipOf(app, { ...forIp, [SIGNED_CLIENT_IP_TIMESTAMP_HEADER]: String(NOW + 1) }), "127.0.0.1");
  } finally {
    await app.close();
  }
});

test("encabezados incompletos, duplicados o malformados se rechazan", async () => {
  const app = await buildApp({ secret: SECRET });
  try {
    const good = sign(CLIENT_1);
    const { [SIGNED_CLIENT_IP_SIGNATURE_HEADER]: _sig, ...withoutSig } = good;
    assert.equal(await ipOf(app, withoutSig), "127.0.0.1");
    // IP con basura, lista, puerto, zona o vacío
    for (const bad of [`${CLIENT_1}, ${FORGED}`, `${CLIENT_1}:443`, "fe80::1%eth0", "", "not-an-ip", "1.2.3.4\n5.6.7.8"]) {
      assert.equal(await ipOf(app, { ...good, [SIGNED_CLIENT_IP_HEADER]: bad }), "127.0.0.1");
    }
    // timestamp no numérico
    for (const bad of ["abc", "-1", "1e9", "", "0x10"]) {
      assert.equal(await ipOf(app, { ...good, [SIGNED_CLIENT_IP_TIMESTAMP_HEADER]: bad }), "127.0.0.1");
    }
  } finally {
    await app.close();
  }
});

test("la cabecera duplicada (array) nunca valida", () => {
  const good = sign(CLIENT_1);
  assert.equal(
    verifySignedClientIp({
      secret: SECRET,
      headers: { ...good, [SIGNED_CLIENT_IP_HEADER]: [CLIENT_1, FORGED] },
      method: "GET",
      path: "/ip",
      nowSeconds: NOW,
    }),
    null,
  );
});

test("dos clientes legítimos distintos no comparten bucket y un mismo cliente sí", async () => {
  const app = await buildApp({ secret: SECRET });
  try {
    const a = await ipOf(app, sign(CLIENT_1));
    const b = await ipOf(app, sign(CLIENT_2));
    const a2 = await ipOf(app, sign(CLIENT_1, { ts: NOW + 1 }));
    assert.notEqual(buildContactRateLimitKey(a), buildContactRateLimitKey(b));
    assert.equal(buildContactRateLimitKey(a), buildContactRateLimitKey(a2));
  } finally {
    await app.close();
  }
});

test("sin firma el contrato previo se conserva, también con trustProxy configurado", async () => {
  const app = await buildApp({ secret: SECRET, trustProxy: "127.0.0.1" });
  try {
    assert.equal(await ipOf(app, { "x-forwarded-for": CLIENT_2 }), CLIENT_2);
    // la firma válida gana sobre la cadena de trustProxy
    assert.equal(await ipOf(app, { ...sign(CLIENT_1), "x-forwarded-for": CLIENT_2 }), CLIENT_1);
  } finally {
    await app.close();
  }
});

test("un POST con cuerpo en streaming conserva la IP firmada y no se altera la entrega", async () => {
  const app = await buildApp({ secret: SECRET });
  try {
    const payload = "x".repeat(200_000);
    const response = await app.inject({
      method: "POST",
      url: "/upload",
      headers: { ...sign(CLIENT_1, { method: "POST", path: "/upload" }), "content-type": "text/plain" },
      payload,
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ip: CLIENT_1, size: payload.length });
  } finally {
    await app.close();
  }
});

test("la firma no se aplica a otra request del mismo proceso (sin contaminación)", async () => {
  const app = await buildApp({ secret: SECRET });
  try {
    assert.equal(await ipOf(app, sign(CLIENT_1)), CLIENT_1);
    assert.equal(await ipOf(app, {}), "127.0.0.1");
    assert.equal(await ipOf(app, sign(CLIENT_2)), CLIENT_2);
  } finally {
    await app.close();
  }
});
