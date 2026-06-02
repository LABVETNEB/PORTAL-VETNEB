import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PARTICULARES_CONTENT_PATH =
  "frontend/src/components/public/ParticularesContent.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("particulares content keeps refreshSession wired to particular auth me helper", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes('import {'));
  assert.ok(source.includes("getParticularSession,"));
  assert.ok(source.includes("async function refreshSession()"));
  assert.ok(source.includes("setIsCheckingSession(true);"));
  assert.ok(source.includes("const response = await getParticularSession();"));
  assert.ok(source.includes("setSession(response?.particular ?? null);"));
});

test("particulares content surfaces refreshSession fetch failures instead of silent logout state", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes("setErrorMessage(null);"));
  assert.ok(source.includes("} catch (error) {"));
  assert.ok(source.includes("setSession(null);"));
  assert.ok(source.includes("error instanceof Error"));
  assert.ok(source.includes("? error.message"));
  assert.ok(source.includes(': "No se pudo verificar la sesión particular. Intente nuevamente.",'));
  assert.ok(source.includes("setIsCheckingSession(false);"));
  assert.ok(source.includes('role="alert"'));
});

test("particulares content keeps neutral logout control and removes resumen label", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes("Cerrar sesión particular"));
  assert.ok(source.includes("variant=\"outline\""));
  assert.ok(source.includes("className=\"public-cta-outline\""));
  assert.equal(source.includes("variant=\"secondary\""), false);
  assert.equal(source.includes("className=\"public-cta-secondary\""), false);
  assert.equal(source.includes("Resumen de caso"), false);
});

test("particulares content muestra estado y alerta desde study-tracking en sesion activa", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes("getParticularStudyTrackingCase"));
  assert.ok(source.includes("Seguimiento del estudio"));
  assert.ok(source.includes("Estado del estudio:"));
  assert.ok(source.includes("Alerta: Solicitud de tinción especial."));
  assert.ok(source.includes("trackingCase"));
});

test("particulares content integra campana token-scoped en sesion activa", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(
    source.includes(
      'import { DashboardNotificationsBell } from "@/components/dashboard/DashboardNotificationsBell";',
    ),
  );
  assert.ok(source.includes('<DashboardNotificationsBell surface="particular" />'));
});

test("particulares content muestra enlace WhatsApp y email solo bajo alerta de tincion especial", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes("Alerta: Solicitud de tinción especial."));
  assert.ok(source.includes("https://wa.me/5493534138946"));
  assert.ok(source.includes("mailto:lab.vetneb@gmail.com"));
  assert.ok(source.includes("Consultar por WhatsApp"));
  assert.ok(source.includes("Enviar email"));
  assert.ok(source.includes("trackingCase.specialStainRequired"));
  assert.ok(source.includes("SPECIAL_STAIN_WHATSAPP_HREF"));
  assert.ok(source.includes("SPECIAL_STAIN_EMAIL_HREF"));
  assert.ok(source.includes("PublicExternalControl"));
  assert.ok(source.includes('target="_blank"'));
  assert.ok(source.includes('target="_self"'));
  assert.equal(source.includes("/dashboard/admin"), false);
});

test("particulares content no expone PII en los hrefs de tincion especial", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  const waHrefMatch = source.match(/SPECIAL_STAIN_WHATSAPP_HREF\s*=\s*"([^"\n]+)"/);
  const emailHrefMatch = source.match(/SPECIAL_STAIN_EMAIL_HREF\s*=\s*"([^"\n]+)"/);

  assert.ok(waHrefMatch !== null, "SPECIAL_STAIN_WHATSAPP_HREF debe estar definida");
  assert.ok(emailHrefMatch !== null, "SPECIAL_STAIN_EMAIL_HREF debe estar definida");

  const waHref = waHrefMatch[1];
  const emailHref = emailHrefMatch[1];

  const piiKeywords = ["tutorLastName", "petName", "petSpecies", "petBreed", "extractionDate", "shippingDate"];
  for (const kw of piiKeywords) {
    assert.equal(waHref.toLowerCase().includes(kw.toLowerCase()), false, `WHATSAPP_HREF no debe contener "${kw}"`);
    assert.equal(emailHref.toLowerCase().includes(kw.toLowerCase()), false, `EMAIL_HREF no debe contener "${kw}"`);
  }

  assert.ok(waHref.startsWith("https://wa.me/5493534138946"), "WhatsApp href debe apuntar al numero oficial");
  assert.ok(emailHref.startsWith("mailto:lab.vetneb@gmail.com"), "Email href debe apuntar al correo oficial");
});
