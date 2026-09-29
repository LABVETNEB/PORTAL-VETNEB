import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const PROFESIONALES_PAGE_PATH = "frontend/src/app/profesionales/page.tsx";
const PROFESIONALES_SEARCH_CONTENT_PATH =
  "frontend/src/components/public/ProfesionalesSearchContent.tsx";
const SERVICIOS_PAGE_PATH = "frontend/src/app/servicios/page.tsx";

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
  assert.ok(source.includes("Coordinación diagnóstica para clínicas y profesionales"));
  assert.ok(source.includes("Solicitar coordinación diagnóstica"));
  assert.ok(source.includes("Conocer solución para clínicas"));
  assert.ok(source.includes("href={ROUTES.contacto}"));
  assert.ok(source.includes("href={ROUTES.clinicas}"));
});
