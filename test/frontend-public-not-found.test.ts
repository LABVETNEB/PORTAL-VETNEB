import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const NOT_FOUND_PATH = "frontend/src/app/not-found.tsx";
const PUBLIC_LAYOUT_PATH =
  "frontend/src/components/layout/PublicLayout.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("App Router exposes an institutional branded not-found page", () => {
  assert.equal(existsSync(resolve(process.cwd(), NOT_FOUND_PATH)), true);

  const source = read(NOT_FOUND_PATH);

  assert.equal(source.split("<h1").length - 1, 1);
  assert.ok(source.includes("Página no encontrada"));
  assert.ok(source.includes("Portal VETNEB"));
  assert.ok(source.includes("VETNEB"));
  assert.ok(source.includes("No encontramos la página que estás buscando."));
  assert.ok(source.includes("Volver al inicio"));
  assert.ok(source.includes("Ver servicios"));
  assert.ok(source.includes("Contactar"));
  assert.ok(source.includes("href={ROUTES.home}"));
  assert.ok(source.includes("href={ROUTES.servicios}"));
  assert.ok(source.includes("href={ROUTES.contacto}"));
  assert.ok(source.includes("<PublicLayout showFaq={false}>"));
  assert.ok(source.includes('title: "Página no encontrada"'));
  assert.equal(source.includes("robots:"), false);
});

test("not-found page avoids internal, demo, and fictitious content", () => {
  const source = read(NOT_FOUND_PATH).toLowerCase();
  const prohibited = [
    "stack trace",
    "exception",
    "internal server",
    "dashboard",
    "api/",
    "demo-",
    "demostrativo",
    "datos ficticios",
    "paciente",
    "clínica demostrativa",
  ];

  for (const text of prohibited) {
    assert.equal(
      source.includes(text),
      false,
      `not-found no debe contener ${text}`,
    );
  }
});

test("public layout can omit the FAQ without changing its default", () => {
  const source = read(PUBLIC_LAYOUT_PATH);

  assert.ok(source.includes("showFaq?: boolean;"));
  assert.ok(source.includes("showFaq = true"));
  assert.ok(source.includes("{showFaq ? <FooterFaq /> : null}"));
});
