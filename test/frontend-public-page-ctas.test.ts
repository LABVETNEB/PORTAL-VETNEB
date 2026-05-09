import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PROFESIONALES_PAGE_PATH = "frontend/src/app/profesionales/page.tsx";
const SERVICIOS_PAGE_PATH = "frontend/src/app/servicios/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("profesionales public page exposes actionable CTAs", () => {
  const source = read(PROFESIONALES_PAGE_PATH);

  assert.ok(source.includes('import Link from "next/link"'));
  assert.ok(source.includes('import { Button } from "@/components/ui/button"'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes"'));
  assert.ok(source.includes("¿Querés integrar tu práctica a Portal VETNEB?"));
  assert.ok(source.includes("Contactar a VETNEB"));
  assert.ok(source.includes("Ver portal para clínicas"));
  assert.ok(source.includes("href={ROUTES.contacto}"));
  assert.ok(source.includes("href={ROUTES.clinicas}"));
});

test("servicios public page exposes conversion CTAs", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.ok(source.includes('import Link from "next/link"'));
  assert.ok(source.includes('import { Button } from "@/components/ui/button"'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes"'));
  assert.ok(source.includes("¿Necesitás digitalizar la gestión de estudios?"));
  assert.ok(source.includes("Solicitar información"));
  assert.ok(source.includes("Ver solución para clínicas"));
  assert.ok(source.includes("href={ROUTES.contacto}"));
  assert.ok(source.includes("href={ROUTES.clinicas}"));
});
