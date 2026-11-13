import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { request as httpRequest } from "node:http";
import test from "node:test";
import Fastify, { type FastifyInstance } from "fastify";

import { UNMATCHED_ROUTE_TEMPLATE } from "../../../server/lib/observability-metrics.ts";
import {
  PROXY_DIAG_MAX_EVENTS,
  PROXY_DIAG_MAX_TTL_MS,
  PROXY_DIAG_PROBE_HEADER,
  PROXY_DIAG_STAGING_IDENTITY,
  classifyAddress,
  registerProxyDiagnostics,
  resolveProxyDiagnosticsConfig,
} from "../../../server/lib/proxy-diagnostics.ts";

// Solo direcciones reservadas para documentación y valores sintéticos. Fastify real
// con `inject` (sin red) salvo la prueba de socket, que usa loopback local.
const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
const HOUR = 60 * 60 * 1000;
const TOKEN = "synthetic-diag-probe-credential-0123456789-ABCDEF";
const PEER = "198.51.100.10";

function stagingEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const base: Record<string, string | undefined> = {
    RENDER: "true",
    RENDER_SERVICE_ID: PROXY_DIAG_STAGING_IDENTITY.serviceId,
    RENDER_SERVICE_NAME: PROXY_DIAG_STAGING_IDENTITY.serviceName,
    RENDER_EXTERNAL_HOSTNAME: PROXY_DIAG_STAGING_IDENTITY.externalHostname,
    PUBLIC_SITE_URL: `https://${PROXY_DIAG_STAGING_IDENTITY.siteHost}`,
    PROXY_DIAG_ENABLED: "1",
    PROXY_DIAG_RUN_ID: "e3e6-test-run",
    PROXY_DIAG_TOKEN: TOKEN,
    PROXY_DIAG_EXPIRES_AT: new Date(NOW + HOUR).toISOString(),
  };
  const merged = { ...base, ...overrides };
  const env: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(merged)) {
    if (value !== undefined) env[name] = value;
  }
  return env;
}

function record(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
  return Object.fromEntries(Object.entries(value));
}

function list(value: unknown): unknown[] {
  assert.ok(Array.isArray(value));
  return value;
}

function captureLogs() {
  const lines: string[] = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const push = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  console.log = push;
  console.warn = push;

  return {
    lines,
    restore() {
      console.log = originalLog;
      console.warn = originalWarn;
    },
    events(): Array<Record<string, unknown>> {
      return lines.filter((line) => line.startsWith("{")).map((line) => record(JSON.parse(line)));
    },
    observed(): Array<Record<string, unknown>> {
      return this.events()
        .filter((entry) => entry.event === "PROXY_DIAGNOSTIC_OBSERVED")
        .map((entry) => record(entry.context));
    },
    named(name: string): Array<Record<string, unknown>> {
      return this.events().filter((entry) => entry.event === name);
    },
  };
}

type BuildOptions = {
  env?: NodeJS.ProcessEnv;
  trustProxy?: string | false;
  now?: () => number;
};

function buildApp(options: BuildOptions = {}): FastifyInstance {
  const trustProxy = options.trustProxy ?? false;
  const app = Fastify({ trustProxy, logger: false });

  registerProxyDiagnostics(app, {
    trustProxyConfigured: Boolean(trustProxy),
    env: options.env ?? {},
    now: options.now ?? (() => NOW),
  });

  app.get("/api/ping", async (request) => ({ ok: true, ip: request.ip }));
  void app.register(
    async (child) => {
      child.get("/inner/:id", async (request) => ({ ok: true, ip: request.ip }));
    },
    { prefix: "/api/child" },
  );

  return app;
}

function probeHeaders(extra: Record<string, string | string[]> = {}) {
  return { [PROXY_DIAG_PROBE_HEADER]: TOKEN, ...extra };
}

async function probe(
  app: FastifyInstance,
  extra: Record<string, string | string[]> = {},
  options: { remoteAddress?: string; url?: string } = {},
) {
  return app.inject({
    method: "GET",
    url: options.url ?? "/api/ping",
    remoteAddress: options.remoteAddress ?? PEER,
    headers: probeHeaders(extra),
  });
}

test("PD-01 desactivado por defecto: sin variables no emite nada y la respuesta es normal", async () => {
  const logs = captureLogs();
  const app = buildApp({ env: {} });

  try {
    const response = await probe(app, { "x-forwarded-for": "203.0.113.77" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(logs.lines, []);
    assert.deepEqual(resolveProxyDiagnosticsConfig({}, NOW), { active: false, reason: "disabled" });

    for (const flag of ["", "0", "true", "yes", "01", " 1"]) {
      assert.deepEqual(resolveProxyDiagnosticsConfig(stagingEnv({ PROXY_DIAG_ENABLED: flag }), NOW), {
        active: false,
        reason: "disabled",
      });
    }
  } finally {
    await app.close();
    logs.restore();
  }
});

test("PD-02 cada condición de identidad de staging es obligatoria y el rechazo no filtra valores", async () => {
  const cases: Array<[Record<string, string | undefined>, string]> = [
    [{ RENDER: undefined }, "not_render"],
    [{ RENDER: "false" }, "not_render"],
    [{ RENDER_SERVICE_ID: "srv-0000000000000000000a" }, "service_id_mismatch"],
    [{ RENDER_SERVICE_NAME: "portal-vetneb-backend-staging" }, "service_name_mismatch"],
    [{ RENDER_EXTERNAL_HOSTNAME: "api.vetneb.com.ar" }, "hostname_mismatch"],
    [{ PUBLIC_SITE_URL: "https://www.vetneb.com.ar" }, "site_host_mismatch"],
    [{ PUBLIC_SITE_URL: undefined }, "site_host_mismatch"],
    [{ PUBLIC_SITE_URL: "not a url" }, "site_host_mismatch"],
  ];

  for (const [overrides, reason] of cases) {
    const logs = captureLogs();
    const app = buildApp({ env: stagingEnv(overrides) });

    try {
      assert.equal((await probe(app)).statusCode, 200);

      const notices = logs.named("PROXY_DIAG_NOT_ACTIVATED");
      assert.deepEqual(
        notices.map((entry) => record(entry.context)),
        [{ reason }],
      );
      assert.deepEqual(logs.observed(), []);

      const text = logs.lines.join("\n");
      assert.ok(!text.includes("vetneb.com.ar"));
      assert.ok(!text.includes(TOKEN));
    } finally {
      await app.close();
      logs.restore();
    }
  }
});

test("PD-03 imposible activarlo en producción: ni NODE_ENV ni la configuración del diagnóstico bastan", async () => {
  const productionLike = stagingEnv({
    NODE_ENV: "production",
    RENDER_SERVICE_ID: "srv-0000000000000000000b",
    RENDER_SERVICE_NAME: "portal-vetneb-backend-staging",
    RENDER_EXTERNAL_HOSTNAME: "api.vetneb.com.ar",
    PUBLIC_SITE_URL: "https://vetneb.com.ar",
  });
  const logs = captureLogs();
  const app = buildApp({ env: productionLike });

  try {
    assert.equal((await probe(app, { "x-forwarded-for": "203.0.113.77" })).statusCode, 200);
    assert.deepEqual(logs.observed(), []);
    assert.deepEqual(resolveProxyDiagnosticsConfig(productionLike, NOW), {
      active: false,
      reason: "service_id_mismatch",
    });
  } finally {
    await app.close();
    logs.restore();
  }

  // NODE_ENV no participa de la decisión: la identidad es lo que cuenta.
  for (const nodeEnv of ["production", "development", "test", undefined]) {
    assert.equal(resolveProxyDiagnosticsConfig(stagingEnv({ NODE_ENV: nodeEnv }), NOW).active, true);
  }
});

test("PD-04 validación de runId, credencial y vencimiento", () => {
  const cases: Array<[Record<string, string | undefined>, string]> = [
    [{ PROXY_DIAG_RUN_ID: undefined }, "bad_run_id"],
    [{ PROXY_DIAG_RUN_ID: "Run-Upper" }, "bad_run_id"],
    [{ PROXY_DIAG_RUN_ID: "abc" }, "bad_run_id"],
    [{ PROXY_DIAG_RUN_ID: "with space-1" }, "bad_run_id"],
    [{ PROXY_DIAG_TOKEN: undefined }, "bad_token"],
    [{ PROXY_DIAG_TOKEN: "a".repeat(31) }, "bad_token"],
    [{ PROXY_DIAG_TOKEN: `${"a".repeat(31)}!` }, "bad_token"],
    [{ PROXY_DIAG_TOKEN: "a".repeat(129) }, "bad_token"],
    [{ PROXY_DIAG_EXPIRES_AT: undefined }, "bad_expiry"],
    [{ PROXY_DIAG_EXPIRES_AT: "tomorrow" }, "bad_expiry"],
    [{ PROXY_DIAG_EXPIRES_AT: "2026-11-13 13:00:00" }, "bad_expiry"],
    [{ PROXY_DIAG_EXPIRES_AT: "2026-11-13T13:00:00+00:00" }, "bad_expiry"],
    [{ PROXY_DIAG_EXPIRES_AT: new Date(NOW - 1).toISOString() }, "expired"],
    [{ PROXY_DIAG_EXPIRES_AT: new Date(NOW).toISOString() }, "expired"],
    [{ PROXY_DIAG_EXPIRES_AT: new Date(NOW + PROXY_DIAG_MAX_TTL_MS + 1).toISOString() }, "ttl_too_long"],
  ];

  for (const [overrides, reason] of cases) {
    assert.deepEqual(resolveProxyDiagnosticsConfig(stagingEnv(overrides), NOW), { active: false, reason });
  }

  const boundary = stagingEnv({ PROXY_DIAG_EXPIRES_AT: new Date(NOW + PROXY_DIAG_MAX_TTL_MS).toISOString() });
  assert.equal(resolveProxyDiagnosticsConfig(boundary, NOW).active, true);
});

test("PD-05 sondas no autorizadas no producen eventos ni alteran la respuesta", async () => {
  const logs = captureLogs();
  const app = buildApp({ env: stagingEnv() });
  const baseline = logs.lines.length;

  try {
    const attempts: Array<Record<string, string>> = [
      {},
      { [PROXY_DIAG_PROBE_HEADER]: "" },
      { [PROXY_DIAG_PROBE_HEADER]: `${TOKEN.slice(0, -1)}X` },
      { [PROXY_DIAG_PROBE_HEADER]: TOKEN.slice(0, -1) },
      { [PROXY_DIAG_PROBE_HEADER]: `${TOKEN}${TOKEN}${TOKEN}` },
      { [PROXY_DIAG_PROBE_HEADER]: TOKEN.toLowerCase() },
      { [PROXY_DIAG_PROBE_HEADER]: "e3e6-test-run" },
    ];

    const statuses: number[] = [];
    for (const headers of attempts) {
      const response = await app.inject({
        method: "GET",
        url: "/api/ping",
        remoteAddress: PEER,
        headers: { ...headers, "x-forwarded-for": "203.0.113.77" },
      });
      statuses.push(response.statusCode);
    }

    assert.deepEqual(statuses, attempts.map(() => 200));
    assert.deepEqual(logs.lines.slice(baseline), []);
    assert.deepEqual(logs.observed(), []);
  } finally {
    await app.close();
    logs.restore();
  }
});

test("PD-06 sonda autorizada, acceso directo sin cabeceras: peer, request.ip y etiqueta efímera", async () => {
  const logs = captureLogs();
  const app = buildApp({ env: stagingEnv() });

  try {
    const response = await probe(app);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(record(response.json()), { ok: true, ip: PEER });

    const [event, ...others] = logs.observed();
    assert.deepEqual(others, []);
    const peer = record(event.peer);
    const requestIp = record(event.requestIp);

    assert.equal(event.runId, "e3e6-test-run");
    assert.equal(event.method, "GET");
    assert.equal(event.routeTemplate, "/api/ping");
    assert.equal(event.trustProxyConfigured, false);
    assert.deepEqual({ ...peer, tag: "T" }, { present: true, family: "ipv4", class: "documentation", tag: "T" });
    assert.match(String(peer.tag), /^[0-9a-f]{8}$/);
    assert.equal(requestIp.equalsPeer, true);
    assert.equal(requestIp.tag, peer.tag);
    assert.deepEqual(record(event.xff), {
      present: false,
      lineCount: 0,
      entryCount: 0,
      truncated: false,
      items: [],
    });
    assert.deepEqual(record(event.xRealIp), { present: false });
    assert.deepEqual(event.markers, []);

    // La etiqueta no es un hash reproducible sin la sal del proceso.
    const unsalted = createHash("sha256").update(PEER).digest("hex").slice(0, 8);
    assert.notEqual(peer.tag, unsalted);
  } finally {
    await app.close();
    logs.restore();
  }
});

test("PD-07 XFF falsificado con TRUST_PROXY ausente: marcador visible y request.ip intacto", async () => {
  const logs = captureLogs();
  const app = buildApp({ env: stagingEnv() });

  try {
    const response = await probe(app, { "x-forwarded-for": "203.0.113.77" });
    assert.deepEqual(record(response.json()), { ok: true, ip: PEER });

    const [event] = logs.observed();
    assert.deepEqual(event.markers, [
      { source: "x-forwarded-for", label: "C1", pos: 0, posFromRight: 0 },
    ]);
    const requestIp = record(event.requestIp);
    assert.equal(requestIp.equalsPeer, true);
    assert.equal(requestIp.class, "documentation");
  } finally {
    await app.close();
    logs.restore();
  }
});

test("PD-08 relación con los buckets: misma etiqueta sin confianza, etiquetas distintas con peer de confianza", async () => {
  const clients = ["203.0.113.25", "203.0.113.26"];

  const untrustedLogs = captureLogs();
  const untrusted = buildApp({ env: stagingEnv() });
  const untrustedIps: unknown[] = [];
  try {
    for (const client of clients) {
      untrustedIps.push(record((await probe(untrusted, { "x-forwarded-for": client })).json()).ip);
    }
    const tags = untrustedLogs.observed().map((event) => record(event.requestIp).tag);
    assert.deepEqual(untrustedIps, [PEER, PEER]);
    assert.equal(tags[0], tags[1]);
  } finally {
    await untrusted.close();
    untrustedLogs.restore();
  }

  const trustedLogs = captureLogs();
  const trusted = buildApp({ env: stagingEnv(), trustProxy: PEER });
  const trustedIps: unknown[] = [];
  try {
    for (const client of clients) {
      trustedIps.push(record((await probe(trusted, { "x-forwarded-for": client })).json()).ip);
    }
    const events = trustedLogs.observed();
    const requestTags = events.map((event) => record(event.requestIp).tag);
    const peerTags = events.map((event) => record(event.peer).tag);

    assert.deepEqual(trustedIps, clients);
    assert.notEqual(requestTags[0], requestTags[1]);
    assert.equal(peerTags[0], peerTags[1]);
    assert.equal(events.every((event) => event.trustProxyConfigured === true), true);
    assert.equal(events.every((event) => record(event.requestIp).equalsPeer === false), true);
  } finally {
    await trusted.close();
    trustedLogs.restore();
  }
});

test("PD-09 cadena de varios saltos: posiciones desde ambos extremos, clases y marcadores", async () => {
  const logs = captureLogs();
  const app = buildApp({ env: stagingEnv() });

  try {
    await probe(app, { "x-forwarded-for": "203.0.113.25, 198.51.100.9, 203.0.113.77, 10.0.0.1" });

    const [event] = logs.observed();
    const xff = record(event.xff);
    const items = list(xff.items).map(record);

    assert.equal(xff.entryCount, 4);
    assert.equal(xff.lineCount, 1);
    assert.deepEqual(items.map((item) => item.class), ["documentation", "documentation", "documentation", "private"]);
    assert.deepEqual(items.map((item) => item.control), [null, "C2", "C1", null]);
    assert.deepEqual(items.map((item) => item.posFromRight), [3, 2, 1, 0]);
    assert.deepEqual(items.map((item) => typeof item.tag), ["string", "object", "object", "string"]);
    assert.deepEqual(event.markers, [
      { source: "x-forwarded-for", label: "C2", pos: 1, posFromRight: 2 },
      { source: "x-forwarded-for", label: "C1", pos: 2, posFromRight: 1 },
    ]);
  } finally {
    await app.close();
    logs.restore();
  }
});

test("PD-10 IPv6, IPv4 mapeada y entradas inválidas en la cadena", async () => {
  const logs = captureLogs();
  const app = buildApp({ env: stagingEnv() });

  try {
    await probe(
      app,
      { "x-forwarded-for": "2001:db8::77, ::1, fe80::1, fd00::1, ::ffff:10.0.0.1, 2606:2800:220:1:248:1893:25c8:1946, garbage, , 203.0.113.9:8080" },
      { remoteAddress: "2001:db8::10" },
    );

    const [event] = logs.observed();
    const items = list(record(event.xff).items).map(record);

    assert.deepEqual(record(event.peer).family, "ipv6");
    assert.deepEqual(record(event.peer).class, "documentation");
    assert.deepEqual(items.map((item) => item.family), [
      "ipv6", "ipv6", "ipv6", "ipv6", "ipv4-mapped", "ipv6", "invalid", "none", "ipv4",
    ]);
    assert.deepEqual(items.map((item) => item.class), [
      "documentation", "loopback", "link-local", "ula", "private", "public", "none", "none", "documentation",
    ]);
    assert.deepEqual(items.map((item) => item.valid), [true, true, true, true, true, true, false, false, true]);
  } finally {
    await app.close();
    logs.restore();
  }
});

test("PD-11 tabla de clasificación de direcciones", () => {
  const table: Array<[unknown, string, string]> = [
    ["203.0.113.5", "ipv4", "documentation"],
    ["192.0.2.1", "ipv4", "documentation"],
    ["10.1.2.3", "ipv4", "private"],
    ["172.16.0.1", "ipv4", "private"],
    ["172.32.0.1", "ipv4", "public"],
    ["192.168.1.1", "ipv4", "private"],
    ["100.64.0.1", "ipv4", "cgnat"],
    ["100.128.0.1", "ipv4", "public"],
    ["169.254.1.1", "ipv4", "link-local"],
    ["127.0.0.1", "ipv4", "loopback"],
    ["0.0.0.0", "ipv4", "unspecified"],
    ["224.0.0.1", "ipv4", "multicast"],
    ["255.255.255.255", "ipv4", "reserved"],
    ["198.18.0.1", "ipv4", "reserved"],
    ["93.184.216.34", "ipv4", "public"],
    ["203.0.113.5:8080", "ipv4", "documentation"],
    ["[2001:db8::5]:443", "ipv6", "documentation"],
    ['"[2001:db8::5]:443"', "ipv6", "documentation"],
    ["::", "ipv6", "unspecified"],
    ["::1", "ipv6", "loopback"],
    ["fe80::1%eth0", "ipv6", "link-local"],
    ["fc00::1", "ipv6", "ula"],
    ["ff02::1", "ipv6", "multicast"],
    ["2001:db8:0:0:0:0:0:1", "ipv6", "documentation"],
    ["64:ff9b::1", "ipv6", "reserved"],
    ["::ffff:192.168.0.1", "ipv4-mapped", "private"],
    ["::ffff:c0a8:1", "ipv4-mapped", "private"],
    ["", "none", "none"],
    ["   ", "none", "none"],
    [undefined, "none", "none"],
    [42, "none", "none"],
    ["not-an-ip", "invalid", "none"],
    ["999.1.1.1", "invalid", "none"],
    ["unknown", "invalid", "none"],
    ["_hidden", "invalid", "none"],
    ["1.2.3", "invalid", "none"],
    ["1.2.3.4.5", "invalid", "none"],
  ];

  for (const [input, family, addressClass] of table) {
    const result = classifyAddress(input);
    assert.deepEqual([result.family, result.class], [family, addressClass], `classifyAddress(${String(input)})`);
  }
});

test("PD-12 lista larga: se trunca, informa el total y no falla", async () => {
  const logs = captureLogs();
  const app = buildApp({ env: stagingEnv() });

  try {
    const chain = Array.from({ length: 900 }, () => "203.0.113.1").join(",");
    const response = await probe(app, { "x-forwarded-for": chain });
    assert.equal(response.statusCode, 200);

    const [event] = logs.observed();
    const xff = record(event.xff);
    const items = list(xff.items).map(record);

    assert.equal(xff.entryCount, 900);
    assert.equal(xff.truncated, true);
    assert.deepEqual(items.map((item) => item.pos).slice(-2), [18, 19]);
    assert.equal(items.at(-1)?.posFromRight, 880);
  } finally {
    await app.close();
    logs.restore();
  }
});

test("PD-13 X-Real-IP, Forwarded y cabeceras del borde: presencia, marcadores y valores no eco", async () => {
  const logs = captureLogs();
  const app = buildApp({ env: stagingEnv() });

  try {
    await probe(app, {
      "x-real-ip": "203.0.113.5",
      forwarded: 'for=203.0.113.6;proto=https, for="[2001:db8::1]:80", for=unknown',
      "cf-connecting-ip": "synthetic-edge-value",
      "true-client-ip": "synthetic-edge-value",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "javascript:alert(1)",
    });

    const [event] = logs.observed();
    const forwarded = record(event.forwarded);
    const items = list(forwarded.items).map(record);

    assert.equal(record(event.xRealIp).control, "C3");
    assert.equal(forwarded.forCount, 3);
    assert.deepEqual(items.map((item) => item.control), ["C4", null, null]);
    assert.deepEqual(items.map((item) => item.class), ["documentation", "documentation", "none"]);
    assert.deepEqual(event.markers, [
      { source: "x-real-ip", label: "C3", pos: 0, posFromRight: 0 },
      { source: "forwarded", label: "C4", pos: 0, posFromRight: 2 },
    ]);
    assert.deepEqual(record(event.otherHeaders), {
      cfConnectingIp: true,
      trueClientIp: true,
      xForwardedHost: true,
      xForwardedProto: "other",
    });

    const text = logs.lines.join("\n");
    for (const forbidden of ["attacker.example", "javascript", "synthetic-edge-value"]) {
      assert.ok(!text.includes(forbidden), forbidden);
    }
  } finally {
    await app.close();
    logs.restore();
  }
});

test("PD-14 los registros no contienen IP, cadenas XFF, credenciales, cookies ni cabeceras", async () => {
  const logs = captureLogs();
  const app = buildApp({ env: stagingEnv(), trustProxy: PEER });
  const addresses = [PEER, "203.0.113.25", "203.0.113.77", "198.51.100.9", "93.184.216.34", "10.0.0.1", "2001:db8::77", "2606:2800:220:1:248:1893:25c8:1946"];

  try {
    await probe(app, {
      "x-forwarded-for": addresses.slice(1).join(", "),
      "x-real-ip": "203.0.113.5",
      forwarded: "for=203.0.113.6",
      cookie: "admin_session_id=synthetic-cookie-value-123",
      authorization: "Bearer synthetic-bearer-value-456",
    });

    const text = logs.lines.join("\n");
    const forbidden = [
      ...addresses,
      "203.0.113.5",
      "203.0.113.6",
      "2001:db8",
      TOKEN,
      "synthetic-cookie-value",
      "synthetic-bearer-value",
      "admin_session_id",
      "x-forwarded-for: ",
    ];

    for (const value of forbidden) {
      assert.ok(!text.includes(value), `aparece ${value}`);
    }
    assert.equal(/\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(text), false);
    assert.equal(logs.observed().length > 0, true);
  } finally {
    await app.close();
    logs.restore();
  }
});

test("PD-15 tope de 300 eventos: el siguiente no se emite y se avisa una sola vez", async () => {
  const logs = captureLogs();
  const app = buildApp({ env: stagingEnv() });

  try {
    for (let attempt = 0; attempt < PROXY_DIAG_MAX_EVENTS + 5; attempt += 1) {
      await probe(app);
    }

    const emitted = logs.observed().length;
    const notices = logs.named("PROXY_DIAG_LIMIT_REACHED").length;

    assert.equal(PROXY_DIAG_MAX_EVENTS, 300);
    assert.equal(emitted, PROXY_DIAG_MAX_EVENTS);
    assert.equal(notices, 1);
  } finally {
    await app.close();
    logs.restore();
  }
});

test("PD-16 vencimiento efectivo en tiempo de ejecución", async () => {
  let clock = NOW;
  const logs = captureLogs();
  const app = buildApp({ env: stagingEnv(), now: () => clock });

  try {
    await probe(app);
    assert.equal(logs.observed().length, 1);

    clock = NOW + HOUR - 1;
    await probe(app);
    assert.equal(logs.observed().length, 2);

    clock = NOW + HOUR;
    await probe(app);
    await probe(app);
    assert.equal(logs.observed().length, 2);
    assert.equal(logs.named("PROXY_DIAG_EXPIRED").length, 1);

    const linesBefore = logs.lines.length;
    await app.inject({ method: "GET", url: "/api/ping", remoteAddress: PEER });
    await app.inject({
      method: "GET",
      url: "/api/ping",
      remoteAddress: PEER,
      headers: { [PROXY_DIAG_PROBE_HEADER]: "not-the-probe-credential" },
    });
    assert.equal(logs.lines.length, linesBefore);
  } finally {
    await app.close();
    logs.restore();
  }
});

test("PD-17 no altera la respuesta funcional ni request.ip con el diagnóstico activo", async () => {
  const logs = captureLogs();
  const active = buildApp({ env: stagingEnv(), trustProxy: PEER });
  const inactive = buildApp({ env: {}, trustProxy: PEER });

  try {
    const requests = [
      { url: "/api/ping", headers: { "x-forwarded-for": "203.0.113.25" } },
      { url: "/api/ping", headers: {} },
      { url: "/api/child/inner/7", headers: { "x-forwarded-for": "203.0.113.26, 198.51.100.9" } },
      { url: "/api/unknown", headers: {} },
    ];

    for (const { url, headers } of requests) {
      const withDiag = await active.inject({
        method: "GET",
        url,
        remoteAddress: PEER,
        headers: { ...headers, [PROXY_DIAG_PROBE_HEADER]: TOKEN },
      });
      const without = await inactive.inject({ method: "GET", url, remoteAddress: PEER, headers });

      const normalize = (headersObject: Record<string, unknown>) => {
        const copy = { ...headersObject };
        delete copy.date;
        return copy;
      };

      assert.equal(withDiag.statusCode, without.statusCode, url);
      assert.equal(withDiag.body, without.body, url);
      assert.deepEqual(normalize(withDiag.headers), normalize(without.headers), url);
    }
  } finally {
    await active.close();
    await inactive.close();
    logs.restore();
  }
});

test("PD-18 compatible con Fastify: rutas encapsuladas y 404 sin plantilla", async () => {
  const logs = captureLogs();
  const app = buildApp({ env: stagingEnv() });

  try {
    await probe(app, {}, { url: "/api/child/inner/9" });
    await probe(app, {}, { url: "/api/does-not-exist" });

    assert.deepEqual(
      logs.observed().map((event) => event.routeTemplate),
      ["/api/child/inner/:id", UNMATCHED_ROUTE_TEMPLATE],
    );
  } finally {
    await app.close();
    logs.restore();
  }
});

test("PD-19 socket real en loopback: líneas de cabecera repetidas y peer observado", async () => {
  const logs = captureLogs();
  const app = buildApp({ env: stagingEnv() });

  try {
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    assert.ok(address !== null && typeof address === "object");
    const { port } = address;

    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(
        {
          host: "127.0.0.1",
          port,
          path: "/api/ping",
          method: "GET",
          headers: {
            [PROXY_DIAG_PROBE_HEADER]: TOKEN,
            "x-forwarded-for": ["203.0.113.25", "198.51.100.9"],
          },
        },
        (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode ?? 0));
        },
      );
      req.on("error", reject);
      req.end();
    });

    assert.equal(status, 200);

    const [event] = logs.observed();
    const xff = record(event.xff);

    assert.equal(record(event.peer).class, "loopback");
    assert.equal(xff.lineCount, 2);
    assert.equal(xff.entryCount, 2);
    assert.deepEqual(event.markers, [
      { source: "x-forwarded-for", label: "C2", pos: 1, posFromRight: 0 },
    ]);
  } finally {
    await app.close();
    logs.restore();
  }
});
