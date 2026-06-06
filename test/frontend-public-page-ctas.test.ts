import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PROFESIONALES_PAGE_PATH = "frontend/src/app/profesionales/page.tsx";
const PROFESIONALES_SEARCH_CONTENT_PATH =
  "frontend/src/components/public/ProfesionalesSearchContent.tsx";
const SERVICIOS_PAGE_PATH = "frontend/src/app/servicios/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("profesionales public page exposes search instead of conversion CTAs", () => {
  const pageSource = read(PROFESIONALES_PAGE_PATH);
  const contentSource = read(PROFESIONALES_SEARCH_CONTENT_PATH);
  const combined = [pageSource, contentSource].join("\n");

  assert.ok(combined.includes("ProfesionalesSearchContent"));
  assert.ok(combined.includes("Consultar la red verificada"));
  assert.ok(combined.includes('aria-label="Consulta de la red profesional"'));
  assert.ok(combined.includes('name="q"'));
  assert.equal(combined.includes("¿Querés integrar tu práctica a Portal VETNEB?"), false);
  assert.equal(combined.includes("Contactar a VETNEB"), false);
  assert.equal(combined.includes("Ver portal para clínicas"), false);
});

test("servicios public page exposes conversion CTAs", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes('import { PublicRouteControl } from "@/components/public/PublicRouteControl";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes"'));
  assert.ok(source.includes("Coordinar con el laboratorio"));
  assert.ok(source.includes("Acceso para clínicas"));
  assert.ok(source.includes("href={ROUTES.contacto}"));
  assert.ok(source.includes("href={ROUTES.clinicas}"));
});
