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

test("footer unifies laboratory info navigation access and non-interactive real map card", () => {
  const source = read(FOOTER_PATH);

  assert.ok(source.includes("Servicio Patológico VETNEB"));
  assert.ok(source.includes("Blvd. Italia 274 - Villa María - Córdoba"));
  assert.ok(source.includes("Lunes a viernes de 8 a 17hs"));
  assert.ok(source.includes("3534138946"));
  assert.ok(source.includes("lab.vetneb@gmail.com"));
  assert.ok(source.includes('aria-label="Navegación secundaria"'));
  assert.ok(source.includes("Navegación"));
  assert.ok(source.includes("Acceso"));
  assert.ok(source.includes("footerLinks.map((link) =>"));
  assert.ok(source.includes("lg:grid-cols-[1.35fr_0.75fr_0.75fr_1.15fr]"));
  assert.ok(source.includes("https://www.google.com/maps?q="));
  assert.ok(source.includes("https://www.google.com/maps?output=embed&q="));
  assert.ok(source.includes("mapsEmbedUrl"));
  assert.ok(source.includes("mapsLocationUrl"));
  assert.ok(source.includes("<iframe"));
  assert.ok(source.includes('title="Mapa de ubicación de Servicio Patológico VETNEB"'));
  assert.ok(source.includes("src={mapsEmbedUrl}"));
  assert.ok(source.includes('loading="lazy"'));
  assert.ok(source.includes('referrerPolicy="no-referrer-when-downgrade"'));
  assert.ok(source.includes('aria-hidden="true"'));
  assert.ok(source.includes("tabIndex={-1}"));
  assert.ok(source.includes("pointer-events-none"));
  assert.ok(source.includes("Blvd. Italia 274, Villa María"));
  assert.ok(source.includes("Córdoba, Argentina"));
  assert.ok(source.includes("Ver ubicación en Maps"));
  assert.ok(source.includes("Ver ubicación del laboratorio en Google Maps"));
  assert.equal(/<a\b/.test(source), false);
  assert.equal(/<Link\b/.test(source), false);
});

test("footer removes redundant brand block and keeps public routes safe", () => {
  const source = read(FOOTER_PATH);

  assert.equal(source.includes("Laboratorio veterinario digital. Informes, estudios y gestión"), false);
  assert.equal(source.includes("rounded-md bg-primary px-3"), false);
  assert.ok(source.includes("ROUTES.servicios"));
  assert.ok(source.includes("ROUTES.profesionales"));
  assert.ok(source.includes("ROUTES.clinicas"));
  assert.ok(source.includes("ROUTES.particulares"));
  assert.ok(source.includes("ROUTES.contacto"));
  assert.ok(source.includes("ROUTES.login"));
  assert.equal(source.includes('"/dashboard"'), false);
  assert.equal(source.includes("admin_session_id"), false);
});
