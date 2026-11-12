import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

import {
  buildContactRateLimitKey,
  normalizeContactClientIdentifier,
} from "../../../server/lib/contact-rate-limit.ts";

import {
  buildLoginRateLimitKey,
  buildMissingCredentialsLoginRateLimitKey,
  hashLoginRateLimitIpAddress,
} from "../../../server/lib/login-rate-limit.ts";

// Direcciones reservadas exclusivamente para pruebas.
const TRUSTED_EDGE = "198.51.100.10";
const TRUSTED_INNER = "198.51.100.11";

const CLIENT = "203.0.113.25";
const SECOND_CLIENT = "203.0.113.26";

const SPOOFED_CLIENT = "192.0.2.199";
const UNTRUSTED_PEER = "192.0.2.50";

// Fastify real, sin listener TCP ni conexiones externas.
async function resolveRequestIp(options: {
  trustProxy: string | false | true;
  remoteAddress: string;
  forwardedFor?: string;
}): Promise<string> {
  const app = Fastify({
    trustProxy: options.trustProxy,
    logger: false,
  });

  try {
    app.get("/__ev01_local_fixture", async (request) => {
      return {
        ip: request.ip,
      };
    });

    const response = await app.inject({
      method: "GET",
      url: "/__ev01_local_fixture",
      remoteAddress: options.remoteAddress,
      headers: options.forwardedFor
        ? { "x-forwarded-for": options.forwardedFor }
        : {},
    });

    assert.equal(response.statusCode, 200);

    const result = response.json() as {
      ip?: unknown;
    };

    assert.equal(typeof result.ip, "string");

    return result.ip as string;
  } finally {
    await app.close();
  }
}

function loginKey(ipAddress: string): string {
  return buildLoginRateLimitKey({
    surface: "clinic",
    identifier: "synthetic-clinic-01",
    ipAddress,
  });
}

// ===========================================================
// A01 — SIN PROXY CONFIABLE
// ===========================================================

test(
  "EV-01 A01: trustProxy=false ignora XFF falsificado",
  async () => {
    const ip = await resolveRequestIp({
      trustProxy: false,
      remoteAddress: UNTRUSTED_PEER,
      forwardedFor: SPOOFED_CLIENT,
    });

    assert.equal(ip, UNTRUSTED_PEER);
  },
);

// ===========================================================
// A02 — PEER NO CONFIABLE
// ===========================================================

test(
  "EV-01 A02: una lista explicita rechaza XFF ajeno",
  async () => {
    const ip = await resolveRequestIp({
      trustProxy: TRUSTED_EDGE,
      remoteAddress: UNTRUSTED_PEER,
      forwardedFor: CLIENT,
    });

    assert.equal(ip, UNTRUSTED_PEER);
  },
);

// ===========================================================
// A03 — PEER CONFIABLE
// ===========================================================

test(
  "EV-01 A03: proxy confiable identifica al cliente",
  async () => {
    const ip = await resolveRequestIp({
      trustProxy: TRUSTED_EDGE,
      remoteAddress: TRUSTED_EDGE,
      forwardedFor: CLIENT,
    });

    assert.equal(ip, CLIENT);
  },
);

// ===========================================================
// A04 — XFF FALSIFICADO DESDE UN PROXY CONFIABLE
// ===========================================================

test(
  "EV-01 A04: no acepta el prefijo XFF falsificado",
  async () => {
    const ip = await resolveRequestIp({
      trustProxy: TRUSTED_EDGE,
      remoteAddress: TRUSTED_EDGE,
      forwardedFor: `${SPOOFED_CLIENT}, ${CLIENT}`,
    });

    assert.equal(ip, CLIENT);
  },
);

// ===========================================================
// A05 — CADENA PARCIAL
// ===========================================================

test(
  "EV-01 A05: cadena parcial termina en salto no listado",
  async () => {
    const ip = await resolveRequestIp({
      trustProxy: TRUSTED_EDGE,
      remoteAddress: TRUSTED_EDGE,
      forwardedFor: `${CLIENT}, ${TRUSTED_INNER}`,
    });

    assert.equal(ip, TRUSTED_INNER);
  },
);

// ===========================================================
// A06 — DOS PROXIES CONFIABLES
// ===========================================================

test(
  "EV-01 A06: lista completa identifica al cliente",
  async () => {
    const ip = await resolveRequestIp({
      trustProxy: `${TRUSTED_EDGE},${TRUSTED_INNER}`,
      remoteAddress: TRUSTED_EDGE,
      forwardedFor: `${CLIENT}, ${TRUSTED_INNER}`,
    });

    assert.equal(ip, CLIENT);
  },
);

// ===========================================================
// A07 — SPOOFING EN CADENA COMPLETA
// ===========================================================

test(
  "EV-01 A07: el prefijo falso no suplanta al cliente",
  async () => {
    const ip = await resolveRequestIp({
      trustProxy: `${TRUSTED_EDGE},${TRUSTED_INNER}`,
      remoteAddress: TRUSTED_EDGE,
      forwardedFor:
        `${SPOOFED_CLIENT}, ${CLIENT}, ${TRUSTED_INNER}`,
    });

    assert.equal(ip, CLIENT);
  },
);

// ===========================================================
// A08 — CIDR LIMITADO
// ===========================================================

test(
  "EV-01 A08: CIDR acepta solo peers del rango",
  async () => {
    const accepted = await resolveRequestIp({
      trustProxy: "198.51.100.0/28",
      remoteAddress: TRUSTED_EDGE,
      forwardedFor: CLIENT,
    });

    const rejected = await resolveRequestIp({
      trustProxy: "198.51.100.0/28",
      remoteAddress: UNTRUSTED_PEER,
      forwardedFor: SPOOFED_CLIENT,
    });

    assert.equal(accepted, CLIENT);
    assert.equal(rejected, UNTRUSTED_PEER);
  },
);

// ===========================================================
// A09 — PEERS IPV6
// ===========================================================

test(
  "EV-01 A09: IPv6 requiere confianza explicita",
  async () => {
    const ipv6Peer = "2001:db8::10";

    const accepted = await resolveRequestIp({
      trustProxy: ipv6Peer,
      remoteAddress: ipv6Peer,
      forwardedFor: CLIENT,
    });

    const rejected = await resolveRequestIp({
      trustProxy: ipv6Peer,
      remoteAddress: "2001:db8::11",
      forwardedFor: SPOOFED_CLIENT,
    });

    assert.equal(accepted, CLIENT);
    assert.equal(rejected, "2001:db8::11");
  },
);

// ===========================================================
// A10 — RATE LIMIT DE CONTACTO
// ===========================================================

test(
  "EV-01 A10: XFF falso no rota bucket de contacto",
  async () => {
    const first = await resolveRequestIp({
      trustProxy: TRUSTED_EDGE,
      remoteAddress: UNTRUSTED_PEER,
      forwardedFor: CLIENT,
    });

    const second = await resolveRequestIp({
      trustProxy: TRUSTED_EDGE,
      remoteAddress: UNTRUSTED_PEER,
      forwardedFor: SECOND_CLIENT,
    });

    assert.equal(first, UNTRUSTED_PEER);
    assert.equal(second, UNTRUSTED_PEER);

    assert.equal(
      buildContactRateLimitKey(first),
      buildContactRateLimitKey(second),
    );
  },
);

// ===========================================================
// A11 — RATE LIMIT DE LOGIN
// ===========================================================

test(
  "EV-01 A11: XFF falso no rota bucket de login",
  async () => {
    const first = await resolveRequestIp({
      trustProxy: TRUSTED_EDGE,
      remoteAddress: UNTRUSTED_PEER,
      forwardedFor: CLIENT,
    });

    const second = await resolveRequestIp({
      trustProxy: TRUSTED_EDGE,
      remoteAddress: UNTRUSTED_PEER,
      forwardedFor: SPOOFED_CLIENT,
    });

    assert.equal(loginKey(first), loginKey(second));

    assert.equal(
      hashLoginRateLimitIpAddress(first),
      hashLoginRateLimitIpAddress(second),
    );

    assert.equal(
      buildMissingCredentialsLoginRateLimitKey({
        surface: "clinic",
        ipAddress: first,
      }),
      buildMissingCredentialsLoginRateLimitKey({
        surface: "clinic",
        ipAddress: second,
      }),
    );
  },
);

// ===========================================================
// A12 — SEPARACION ENTRE CLIENTES
// ===========================================================

test(
  "EV-01 A12: clientes diferentes tienen buckets distintos",
  async () => {
    const first = await resolveRequestIp({
      trustProxy: TRUSTED_EDGE,
      remoteAddress: TRUSTED_EDGE,
      forwardedFor: CLIENT,
    });

    const second = await resolveRequestIp({
      trustProxy: TRUSTED_EDGE,
      remoteAddress: TRUSTED_EDGE,
      forwardedFor: SECOND_CLIENT,
    });

    assert.notEqual(first, second);

    assert.notEqual(
      buildContactRateLimitKey(first),
      buildContactRateLimitKey(second),
    );

    assert.notEqual(
      loginKey(first),
      loginKey(second),
    );
  },
);

// ===========================================================
// A13 — NORMALIZACION IPV4-MAPPED IPV6
// ===========================================================

test(
  "EV-01 A13: contacto normaliza IPv4 mapeada en IPv6",
  () => {
    assert.equal(
      normalizeContactClientIdentifier(`::ffff:${CLIENT}`),
      CLIENT,
    );

    assert.equal(
      buildContactRateLimitKey(CLIENT),
      buildContactRateLimitKey(`::ffff:${CLIENT}`),
    );
  },
);

// ===========================================================
// A14 — CONTROL NEGATIVO DE TRUSTPROXY TRUE
// ===========================================================

test(
  "EV-01 A14: trustProxy=true permite spoofing",
  async () => {
    // Control negativo; nunca usar true en produccion.
    const first = await resolveRequestIp({
      trustProxy: true,
      remoteAddress: UNTRUSTED_PEER,
      forwardedFor: CLIENT,
    });

    const spoofed = await resolveRequestIp({
      trustProxy: true,
      remoteAddress: UNTRUSTED_PEER,
      forwardedFor: SPOOFED_CLIENT,
    });

    assert.equal(first, CLIENT);
    assert.equal(spoofed, SPOOFED_CLIENT);

    assert.notEqual(
      loginKey(first),
      loginKey(spoofed),
    );
  },
);