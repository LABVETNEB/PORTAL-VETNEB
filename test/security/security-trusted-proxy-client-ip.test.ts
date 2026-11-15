import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { buildContactRateLimitKey } from "../../server/lib/contact-rate-limit.ts";
import {
  createTrustedProxyFunction,
  isValidEdgeCidrList,
  parseTrustedHopChain,
  resolveTrustProxy,
} from "../../server/lib/trusted-proxy.ts";

// Valores 100% sintéticos: RFC 5737 / RFC 3849 y rangos privados. EDGE_CIDR
// representa un rango de borde de prueba, no un rango real de ningún proveedor.
const EDGE_CIDR = "192.0.2.0/24";
const EDGE_A = "192.0.2.10";
const EDGE_B = "192.0.2.77";
const PRIVATE_A = "10.20.30.40";
const PRIVATE_B = "10.99.1.2";
const CLIENT_1 = "198.51.100.11";
const CLIENT_2 = "198.51.100.22";
const FORGED = "203.0.113.99";
const EGRESS = "203.0.113.200";

const CHAIN = "loopback,private,edge";

async function buildApp(setting: ReturnType<typeof resolveTrustProxy>) {
  const app = Fastify({ logger: false, trustProxy: setting });
  app.get("/ip", async (request) => ({ ip: request.ip }));
  return app;
}

function structural() {
  return resolveTrustProxy({ chain: CHAIN, edgeCidrs: EDGE_CIDR });
}

async function resolveIp(
  app: Awaited<ReturnType<typeof buildApp>>,
  options: { peer?: string; headers?: Record<string, string | string[]> },
): Promise<string> {
  const response = await app.inject({
    method: "GET",
    url: "/ip",
    remoteAddress: options.peer ?? "127.0.0.1",
    headers: options.headers,
  });
  assert.equal(response.statusCode, 200);
  return (response.json() as { ip: string }).ip;
}

test("sin configuración el contrato previo no cambia: no se confía en ningún proxy", async () => {
  assert.equal(resolveTrustProxy({}), false);
  assert.equal(resolveTrustProxy({ trustProxy: "203.0.113.0/24" }), "203.0.113.0/24");
  const app = await buildApp(resolveTrustProxy({}));
  try {
    const ip = await resolveIp(app, {
      peer: "127.0.0.1",
      headers: { "x-forwarded-for": `${CLIENT_1}, ${EDGE_A}, ${PRIVATE_A}` },
    });
    assert.equal(ip, "127.0.0.1");
  } finally {
    await app.close();
  }
});

test("acceso directo de tres entradas: el cliente se resuelve", async () => {
  const app = await buildApp(structural());
  try {
    const ip = await resolveIp(app, {
      headers: { "x-forwarded-for": `${CLIENT_1}, ${EDGE_A}, ${PRIVATE_A}` },
    });
    assert.equal(ip, CLIENT_1);
  } finally {
    await app.close();
  }
});

test("dos clientes legítimos distintos no comparten bucket; el mismo cliente sí", async () => {
  const app = await buildApp(structural());
  try {
    const one = await resolveIp(app, {
      headers: { "x-forwarded-for": `${CLIENT_1}, ${EDGE_A}, ${PRIVATE_A}` },
    });
    const two = await resolveIp(app, {
      headers: { "x-forwarded-for": `${CLIENT_2}, ${EDGE_B}, ${PRIVATE_B}` },
    });
    const oneAgain = await resolveIp(app, {
      headers: { "x-forwarded-for": `${CLIENT_1}, ${EDGE_B}, ${PRIVATE_B}` },
    });
    assert.notEqual(one, two);
    assert.equal(one, oneAgain);
    assert.notEqual(buildContactRateLimitKey(one), buildContactRateLimitKey(two));
    assert.equal(buildContactRateLimitKey(one), buildContactRateLimitKey(oneAgain));
  } finally {
    await app.close();
  }
});

test("XFF falsificado a la izquierda no cambia la identidad resuelta", async () => {
  const app = await buildApp(structural());
  try {
    const honest = await resolveIp(app, {
      headers: { "x-forwarded-for": `${CLIENT_1}, ${EDGE_A}, ${PRIVATE_A}` },
    });
    for (const forged of [
      FORGED,
      `${FORGED}, ${FORGED}`,
      `${PRIVATE_B}, ${EDGE_B}, ${FORGED}`,
      "127.0.0.1",
      "::1",
      "unknown",
    ]) {
      const ip = await resolveIp(app, {
        headers: { "x-forwarded-for": `${forged}, ${CLIENT_1}, ${EDGE_A}, ${PRIVATE_A}` },
      });
      assert.equal(ip, honest, `forged prefix ${forged} must be ignored`);
    }
  } finally {
    await app.close();
  }
});

test("líneas XFF duplicadas enviadas por el cliente quedan a la izquierda y se ignoran", async () => {
  const app = await buildApp(structural());
  try {
    const ip = await resolveIp(app, {
      headers: {
        "x-forwarded-for": [FORGED, `${CLIENT_1}, ${EDGE_A}, ${PRIVATE_A}`],
      },
    });
    assert.equal(ip, CLIENT_1);
  } finally {
    await app.close();
  }
});

test("cabeceras alternativas falsificadas no participan en la resolución", async () => {
  const app = await buildApp(structural());
  try {
    const ip = await resolveIp(app, {
      headers: {
        "x-forwarded-for": `${CLIENT_1}, ${EDGE_A}, ${PRIVATE_A}`,
        "cf-connecting-ip": FORGED,
        "true-client-ip": FORGED,
        "x-real-ip": FORGED,
        forwarded: `for=${FORGED}`,
        "x-proxy-signature": "deadbeef",
      },
    });
    assert.equal(ip, CLIENT_1);
  } finally {
    await app.close();
  }
});

test("tramo rewrite de seis entradas: la salida de Next no se confía y el límite es seguro", async () => {
  const app = await buildApp(structural());
  try {
    const rewritten = `${CLIENT_1}, ${EDGE_A}, ${PRIVATE_A}, ${EGRESS}, ${EDGE_B}, ${PRIVATE_B}`;
    const ip = await resolveIp(app, { headers: { "x-forwarded-for": rewritten } });
    assert.equal(ip, EGRESS, "la identidad se detiene en la salida compartida, no en un valor controlable");
    const forgedPrefix = await resolveIp(app, {
      headers: { "x-forwarded-for": `${FORGED}, ${rewritten}` },
    });
    assert.equal(forgedPrefix, EGRESS);
  } finally {
    await app.close();
  }
});

test("un cliente dentro de un rango confiable en posición de cliente no escala confianza", async () => {
  const app = await buildApp(structural());
  try {
    const ip = await resolveIp(app, {
      headers: { "x-forwarded-for": `${FORGED}, ${EDGE_B}, ${EDGE_A}, ${PRIVATE_A}` },
    });
    assert.equal(ip, EDGE_B, "un tercer salto de borde queda sin confianza");
    const workerLike = await resolveIp(app, {
      headers: { "x-forwarded-for": `${FORGED}, ${EDGE_B}, ${EDGE_A}, ${PRIVATE_A}` },
    });
    assert.notEqual(workerLike, FORGED);
  } finally {
    await app.close();
  }
});

test("topología desconocida o corta falla de forma segura", async () => {
  const app = await buildApp(structural());
  try {
    assert.equal(await resolveIp(app, { headers: {} }), "127.0.0.1");
    assert.equal(
      await resolveIp(app, { headers: { "x-forwarded-for": "" } }),
      "127.0.0.1",
    );
    assert.equal(
      await resolveIp(app, { headers: { "x-forwarded-for": CLIENT_1 } }),
      CLIENT_1,
    );
    assert.equal(
      await resolveIp(app, { headers: { "x-forwarded-for": `${CLIENT_1}, ${PRIVATE_A}` } }),
      CLIENT_1,
      "un hop de borde ausente no concede confianza al público",
    );
    assert.equal(
      await resolveIp(app, { headers: { "x-forwarded-for": `${CLIENT_1}, ${EDGE_A}` } }),
      EDGE_A,
      "hop privado ausente: se detiene en el primer salto no confiable",
    );
  } finally {
    await app.close();
  }
});

test("peer no loopback (acceso fuera de la topología) no confía en XFF", async () => {
  const app = await buildApp(structural());
  try {
    const ip = await resolveIp(app, {
      peer: CLIENT_2,
      headers: { "x-forwarded-for": `${FORGED}, ${EDGE_A}, ${PRIVATE_A}` },
    });
    assert.equal(ip, CLIENT_2);
    const privatePeer = await resolveIp(app, {
      peer: PRIVATE_B,
      headers: { "x-forwarded-for": `${FORGED}, ${EDGE_A}, ${PRIVATE_A}` },
    });
    assert.equal(privatePeer, PRIVATE_B, "peer privado no es loopback: hop 0 exige loopback");
  } finally {
    await app.close();
  }
});

test("IPv6 e IPv4-mapped se tratan por clase y rango", async () => {
  const trust = createTrustedProxyFunction({
    hops: ["loopback", "private", "edge"],
    edgeCidrs: [EDGE_CIDR, "2001:db8:abcd::/48"],
  });
  assert.equal(trust("::1", 0), true);
  assert.equal(trust("::ffff:127.0.0.1", 0), true);
  assert.equal(trust("::ffff:10.1.2.3", 1), true);
  assert.equal(trust("fd00::1", 1), true);
  assert.equal(trust("2001:db8:abcd::5", 2), true);
  assert.equal(trust("::ffff:192.0.2.9", 2), true);
  assert.equal(trust("2001:db8:ffff::5", 2), false);
  assert.equal(trust("fe80::1", 1), false);
  assert.equal(trust("::ffff:203.0.113.5", 2), false);

  const app = await buildApp(
    resolveTrustProxy({ chain: CHAIN, edgeCidrs: `${EDGE_CIDR}, 2001:db8:abcd::/48` }),
  );
  try {
    const ip = await resolveIp(app, {
      peer: "::1",
      headers: { "x-forwarded-for": `2001:db8::77, 2001:db8:abcd::5, fd00::9` },
    });
    assert.equal(ip, "2001:db8::77");
  } finally {
    await app.close();
  }
});

test("la función exige posición Y clase; ni una ni otra bastan", () => {
  const trust = createTrustedProxyFunction({ hops: ["loopback", "private", "edge"], edgeCidrs: [EDGE_CIDR] });
  assert.equal(trust("127.0.0.1", 0), true);
  assert.equal(trust("127.0.0.1", 1), false, "clase correcta en posición incorrecta");
  assert.equal(trust(PRIVATE_A, 0), false);
  assert.equal(trust(PRIVATE_A, 1), true);
  assert.equal(trust(CLIENT_1, 1), false, "posición correcta, clase incorrecta");
  assert.equal(trust(EDGE_A, 2), true);
  assert.equal(trust(EDGE_A, 3), false, "más allá de la cadena declarada nada es confiable");
  for (const bad of ["", " ", "unknown", "1.2.3", "1.2.3.4:80", "1.2.3.4%eth0", "999.1.1.1", "fe80::1%1", "10.0.0.1/8", "0x7f.0.0.1"]) {
    for (let hop = 0; hop < 4; hop += 1) {
      assert.equal(trust(bad, hop), false, `malformed ${JSON.stringify(bad)} hop ${hop}`);
    }
  }
  assert.equal(trust("127.0.0.1", -1), false);
  assert.equal(trust("127.0.0.1", 0.5), false);
  assert.equal(trust("127.0.0.1", Number.NaN), false);
});

test("validación de configuración: CIDR e hops inválidos o amplios se rechazan", () => {
  assert.deepEqual(parseTrustedHopChain("loopback, private ,edge"), ["loopback", "private", "edge"]);
  for (const bad of ["", "true", "1", "loopback,,edge", "any", "loopback,private,edge,edge,edge", "10.0.0.1"]) {
    assert.equal(parseTrustedHopChain(bad), null, bad);
  }
  assert.equal(isValidEdgeCidrList("192.0.2.0/24, 2001:db8::/32"), true);
  assert.equal(isValidEdgeCidrList("192.0.2.5"), true);
  for (const bad of ["0.0.0.0/0", "::/0", "0.0.0.0/7", "2001::/15", "192.0.2.0/33", "192.0.2.0/", "abc", "", "192.0.2.0/24,", "192.0.2.0/24/8"]) {
    assert.equal(isValidEdgeCidrList(bad), false, bad);
  }
});

test("combinaciones ambiguas de variables fallan al arrancar, nunca confían", () => {
  assert.throws(() => resolveTrustProxy({ chain: CHAIN, edgeCidrs: EDGE_CIDR, trustProxy: "10.0.0.0/8" }));
  assert.throws(() => resolveTrustProxy({ chain: CHAIN }));
  assert.throws(() => resolveTrustProxy({ chain: "loopback", edgeCidrs: EDGE_CIDR }));
  assert.throws(() => resolveTrustProxy({ edgeCidrs: EDGE_CIDR }));
  assert.throws(() => resolveTrustProxy({ chain: "true" }));
  assert.throws(() => resolveTrustProxy({ chain: CHAIN, edgeCidrs: "0.0.0.0/0" }));
  assert.equal(typeof resolveTrustProxy({ chain: "loopback" }), "function");
});

test("la función resuelta nunca es trustProxy global ni numérico", () => {
  const setting = structural();
  assert.equal(typeof setting, "function");
  assert.notEqual(setting, true);
  assert.equal((setting as (a: string, h: number) => boolean)("203.0.113.5", 0), false);
});
