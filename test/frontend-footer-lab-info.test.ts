import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const FOOTER_PATH = "frontend/src/components/layout/Footer.tsx";
const PUBLIC_LAYOUT_PATH = "frontend/src/components/layout/PublicLayout.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("public layout renders footer after main content", () => {
  const source = read(PUBLIC_LAYOUT_PATH);

  assert.ok(source.includes('import { Footer } from "./Footer";'));
  assert.ok(source.includes("<Footer />"));
  assert.ok(source.indexOf("<main") < source.indexOf("<Footer />"));
});

test("footer includes public FAQ content in the lower frontend area", () => {
  const source = read(FOOTER_PATH);

  assert.ok(source.includes("Preguntas frecuentes:"));
  assert.ok(source.includes("¿Cuánto tiempo se realiza la fijación en formol?"));
  assert.ok(source.includes("48-72 horas"));
  assert.ok(source.includes("¿Cómo se envía la muestra?"));
  assert.ok(source.includes("bolsa tipo ziploc"));
  assert.ok(source.includes("¿Dónde debo enviar la muestra?"));
  assert.ok(source.includes("WhatsApp"));
  assert.ok(source.includes("¿Cuánto tiempo lleva realizar el estudio hasta el informe?"));
  assert.ok(source.includes("15 días hábiles"));
  assert.ok(source.includes("¿Cuál es el costo de estudio?"));
  assert.ok(source.includes("tinciones especiales"));
});

test("footer includes laboratory contact information and Google Maps embed", () => {
  const source = read(FOOTER_PATH);

  assert.ok(source.includes("Servicio Patológico VETNEB"));
  assert.ok(source.includes("Blvd. Italia 274 - Villa María - Córdoba"));
  assert.ok(source.includes("Lunes a viernes de 8 a 17hs"));
  assert.ok(source.includes("3534138946"));
  assert.ok(source.includes("lab.vetneb@gmail.com"));
  assert.ok(source.includes("https://www.google.com/maps?q="));
  assert.ok(source.includes("output=embed"));
  assert.ok(source.includes("Ubicación de Servicio Patológico VETNEB en Google Maps"));
});

test("footer keeps public navigation and does not expose private dashboard content", () => {
  const source = read(FOOTER_PATH);

  assert.ok(source.includes("Portal VETNEB"));
  assert.ok(source.includes("ROUTES.servicios"));
  assert.ok(source.includes("ROUTES.profesionales"));
  assert.ok(source.includes("ROUTES.clinicas"));
  assert.ok(source.includes("ROUTES.contacto"));
  assert.equal(source.includes('"/dashboard"'), false);
  assert.equal(source.includes("admin_session_id"), false);
});