import { readSourceFile } from "../helpers/tracked-source-files.ts";
import test from "node:test";
import assert from "node:assert/strict";

import {
  applyClientIpHeaders,
  buildEdgeList,
  buildSignedClientIpHeaders,
  resolveClientIpFromForwardedFor,
} from "../../frontend/src/lib/security/client-ip-signing.ts";
import { verifySignedClientIp } from "../../server/lib/signed-client-ip.ts";

// Valores sintéticos. EDGE es un rango de prueba, no un rango real de proveedor.
const SECRET = "test-secret-test-secret-test-secret-0123456789";
const EDGE = "192.0.2.0/24";
const EDGE_HOP = "192.0.2.10";
const PRIVATE_HOP = "10.20.30.40";
const CLIENT_1 = "198.51.100.11";
const CLIENT_2 = "198.51.100.22";
const CLIENT_V6 = "2001:db8::77";
const FORGED = "203.0.113.99";
const NOW = 1_800_000_000;
const edge = () => buildEdgeList(EDGE);

test("resolución anclada a la derecha: toma el cliente que agregó el borde y valida cada salto", () => {
  assert.equal(
    resolveClientIpFromForwardedFor(`${CLIENT_1}, ${EDGE_HOP}, ${PRIVATE_HOP}`, edge()),
    CLIENT_1,
  );
  assert.equal(
    resolveClientIpFromForwardedFor(`${CLIENT_V6}, ${EDGE_HOP}, ${PRIVATE_HOP}`, edge()),
    CLIENT_V6,
  );
  // salto privado IPv6 y borde mapeado
  assert.equal(
    resolveClientIpFromForwardedFor(`${CLIENT_1}, ::ffff:${EDGE_HOP}, fd00::5`, edge()),
    CLIENT_1,
  );
});

test("entradas falsificadas a la izquierda no desplazan al cliente real", () => {
  assert.equal(
    resolveClientIpFromForwardedFor(`${FORGED}, ${CLIENT_1}, ${EDGE_HOP}, ${PRIVATE_HOP}`, edge()),
    CLIENT_1,
  );
  assert.equal(
    resolveClientIpFromForwardedFor(`${FORGED}, ${FORGED}, ${CLIENT_2}, ${EDGE_HOP}, ${PRIVATE_HOP}`, edge()),
    CLIENT_2,
  );
});

test("cadenas parciales, saltos fuera de clase o basura fallan cerrado (null)", () => {
  const cases = [
    "",
    CLIENT_1,
    `${CLIENT_1}, ${PRIVATE_HOP}`,
    `${EDGE_HOP}, ${PRIVATE_HOP}`,
    // el último salto no es privado (cliente directo que fija el XFF)
    `${CLIENT_1}, ${EDGE_HOP}, ${FORGED}`,
    // el salto de borde no pertenece al rango declarado
    `${CLIENT_1}, ${FORGED}, ${PRIVATE_HOP}`,
    // cliente no es una IP literal
    `not-an-ip, ${EDGE_HOP}, ${PRIVATE_HOP}`,
    `${CLIENT_1}:443, ${EDGE_HOP}, ${PRIVATE_HOP}`,
    `, ${EDGE_HOP}, ${PRIVATE_HOP}`,
    // orden invertido
    `${CLIENT_1}, ${PRIVATE_HOP}, ${EDGE_HOP}`,
  ];
  for (const value of cases) {
    assert.equal(resolveClientIpFromForwardedFor(value, edge()), null, value);
  }
  assert.equal(resolveClientIpFromForwardedFor(null, edge()), null);
  assert.equal(resolveClientIpFromForwardedFor(undefined, edge()), null);
});

test("sin rangos de borde válidos (ausentes, demasiado amplios o malformados) no se resuelve ni firma", () => {
  assert.equal(buildEdgeList(undefined), null);
  assert.equal(buildEdgeList(""), null);
  assert.equal(buildEdgeList("0.0.0.0/0"), null);
  assert.equal(buildEdgeList("::/0"), null);
  assert.equal(buildEdgeList("192.0.2.0/4"), null);
  assert.equal(buildEdgeList("192.0.2.0/24, basura"), null);
  const header = `${CLIENT_1}, ${EDGE_HOP}, ${PRIVATE_HOP}`;
  assert.equal(resolveClientIpFromForwardedFor(header, null), null);
  assert.equal(
    buildSignedClientIpHeaders({
      secret: SECRET,
      edgeCidrs: "0.0.0.0/0",
      forwardedFor: header,
      method: "GET",
      path: "/api/x",
      nowSeconds: NOW,
    }),
    null,
  );
});

test("sin secreto o con secreto corto no se firma nada", () => {
  for (const secret of [undefined, "", "short"]) {
    assert.equal(
      buildSignedClientIpHeaders({
        secret,
        edgeCidrs: EDGE,
        forwardedFor: `${CLIENT_1}, ${EDGE_HOP}, ${PRIVATE_HOP}`,
        method: "GET",
        path: "/api/x",
        nowSeconds: NOW,
      }),
      null,
    );
  }
});

test("contrato cruzado: lo que firma el frontend lo verifica el backend (y sólo para esa request)", () => {
  const signed = buildSignedClientIpHeaders({
    secret: SECRET,
    edgeCidrs: EDGE,
    forwardedFor: `${FORGED}, ${CLIENT_1}, ${EDGE_HOP}, ${PRIVATE_HOP}`,
    method: "POST",
    path: "/api/auth/login?next=/x",
    nowSeconds: NOW,
  });
  assert.ok(signed);
  const verify = (overrides: Partial<Parameters<typeof verifySignedClientIp>[0]> = {}) =>
    verifySignedClientIp({
      secret: SECRET,
      headers: signed,
      method: "POST",
      path: "/api/auth/login?other=1",
      nowSeconds: NOW,
      ...overrides,
    });
  assert.equal(verify(), CLIENT_1);
  assert.equal(verify({ method: "GET" }), null);
  assert.equal(verify({ path: "/api/auth/logout" }), null);
  assert.equal(verify({ nowSeconds: NOW + 31 }), null);
  assert.equal(verify({ secret: "x".repeat(40) }), null);
});

test("dos clientes distintos producen identidades firmadas distintas", () => {
  const make = (client: string) =>
    buildSignedClientIpHeaders({
      secret: SECRET,
      edgeCidrs: EDGE,
      forwardedFor: `${client}, ${EDGE_HOP}, ${PRIVATE_HOP}`,
      method: "GET",
      path: "/api/x",
      nowSeconds: NOW,
    });
  assert.notEqual(make(CLIENT_1)?.["x-vetneb-client-ip"], make(CLIENT_2)?.["x-vetneb-client-ip"]);
});

test("applyClientIpHeaders elimina SIEMPRE la identidad enviada por el navegador", () => {
  const source = new Headers({
    "x-vetneb-client-ip": FORGED,
    "x-vetneb-client-ip-ts": String(NOW),
    "x-vetneb-client-ip-sig": "a".repeat(64),
    cookie: "k=v",
    "content-type": "application/json",
  });
  const withoutSignature = applyClientIpHeaders(source, null);
  assert.equal(withoutSignature.get("x-vetneb-client-ip"), null);
  assert.equal(withoutSignature.get("x-vetneb-client-ip-ts"), null);
  assert.equal(withoutSignature.get("x-vetneb-client-ip-sig"), null);
  assert.equal(withoutSignature.get("cookie"), "k=v");
  assert.equal(withoutSignature.get("content-type"), "application/json");
  // el original no se muta
  assert.equal(source.get("x-vetneb-client-ip"), FORGED);
});

test("contrato del proxy: /api/* sólo reenvía con identidad propia y /dashboard conserva su compuerta", () => {
  const source = readSourceFile("frontend/src/proxy.ts");
  assert.ok(source.includes('matcher: ["/dashboard/:path*", "/api/:path*"]'));
  assert.ok(source.includes("applyClientIpHeaders(request.headers, signed)"));
  assert.ok(source.includes("process.env.CLIENT_IP_SIGNING_SECRET"));
  assert.ok(source.includes("process.env.CLIENT_IP_EDGE_CIDRS"));
  // el proxy no decide acceso en /api: nunca redirige ahí
  const apiBranch = source.slice(
    source.indexOf("if (pathname.startsWith(API_PATH_PREFIX))"),
    source.indexOf("const requiredCookieName"),
  );
  assert.ok(apiBranch.includes("forwardApiRequestWithSignedClientIp(request)"));
  assert.ok(!apiBranch.includes("redirect"));
  // las variables jamás son públicas
  assert.ok(!source.includes("NEXT_PUBLIC_CLIENT_IP"));
  assert.ok(source.includes("NextResponse.redirect(loginUrl)"));
});

test("el límite de cuerpo del proxy cubre el máximo de subida del backend (sin truncar uploads)", () => {
  const config = readSourceFile("frontend/next.config.ts");
  const match = /proxyClientMaxBodySize:\s*"(\d+)mb"/i.exec(config);
  assert.ok(match, "proxyClientMaxBodySize debe estar declarado");
  const uploadDefault = readSourceFile("server/lib/env.ts").match(/maxUploadFileSizeMb: rawEnv\.MAX_UPLOAD_FILE_SIZE_MB \?\? (\d+)/);
  assert.ok(uploadDefault);
  assert.ok(Number(match[1]) > Number(uploadDefault[1]), "debe superar el máximo de subida por defecto");
});
