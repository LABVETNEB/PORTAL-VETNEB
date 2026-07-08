import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const CONTACTO_PAGE_PATH = "frontend/src/app/contacto/page.tsx";
const CONTACTO_CONTENT_PATH = "frontend/src/components/public/ContactoContent.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("contacto public page defines metadata through SEO helper", () => {
  const source = read(CONTACTO_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { createPageMetadata, getContactPageJsonLd } from "@/lib/seo";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Contacto — Laboratorio Patológico Veterinario"'));
  assert.ok(source.includes('"Contacte con el equipo de Portal VETNEB.'));
  assert.ok(source.includes('"/contacto"'));
});

test("contacto public page delegates rendering to ContactoContent", () => {
  const source = read(CONTACTO_PAGE_PATH);

  assert.ok(source.includes('import { ContactoContent } from "@/components/public/ContactoContent";'));
  assert.ok(source.includes("export default function ContactoPage()"));
  assert.ok(source.includes("<ContactoContent />"));
});

test("contacto content keeps public layout and contact form landmarks", () => {
  const source = read(CONTACTO_CONTENT_PATH);

  assert.ok(source.includes('import { PublicLayout } from "@/components/layout/PublicLayout";'));
  assert.ok(source.includes("<PublicLayout>"));
  assert.ok(source.includes("Contacto"));
  assert.ok(source.includes("Envíenos un mensaje"));
  assert.ok(source.includes('aria-label="Formulario de contacto"'));
  assert.ok(source.includes("Información de contacto"));
});

test("contacto content exposes real linked contact information", () => {
  const source = read(CONTACTO_CONTENT_PATH);

  assert.ok(source.includes("lab.vetneb@gmail.com"));
  assert.ok(source.includes("mailto:lab.vetneb@gmail.com"));
  assert.ok(source.includes("3534138946"));
  assert.ok(source.includes("https://wa.me/5493534138946"));
  assert.ok(source.includes("Villa María, Córdoba, Argentina"));
  assert.ok(source.includes("hover:text-primary"));
  assert.equal(source.includes("contacto@vetneb.com"), false);
  assert.equal(source.includes("+54 11 0000-0000"), false);
  assert.equal(source.includes("Buenos Aires, Argentina"), false);
  assert.equal(source.includes("— datos de ejemplo —"), false);
});

test("contacto content keeps clinic onboarding guidance visible", () => {
  const source = read(CONTACTO_CONTENT_PATH);

  assert.ok(source.includes("¿Es una clínica veterinaria?"));
  assert.ok(source.includes("registrar su clínica en Portal VETNEB"));
  assert.ok(source.includes("configurar su acceso"));
  assert.ok(source.includes("Nombre de la clínica (opcional)"));
  assert.ok(source.includes("Describa su consulta o solicitud de acceso"));
  assert.equal(source.includes("Solicitar integración clínica"), false);
});

test("contacto content exposes the public intent router", () => {
  const source = read(CONTACTO_CONTENT_PATH);

  assert.ok(source.includes("data-contact-intent-router"));
  assert.ok(source.includes('data-contact-intent="clinic-registration"'));
  assert.ok(source.includes('data-contact-intent="sample-shipping"'));
  assert.ok(source.includes('data-contact-intent="tutor-code"'));
  assert.ok(source.includes('data-contact-intent="general-inquiry"'));
  assert.ok(source.includes("Registrar clínica / solicitar acceso"));
  assert.ok(source.includes("Coordinar envío de muestras"));
  assert.ok(source.includes("Tutor con código"));
  assert.ok(source.includes("Consulta general"));
  assert.ok(source.includes('data-contact-target="#contact-form"'));
  assert.ok(source.includes("data-contact-target={ROUTES.particulares}"));
  assert.ok(source.includes("data-contact-target={WHATSAPP_HREF}"));
});

test("contacto content keeps operational channel order", () => {
  const source = read(CONTACTO_CONTENT_PATH);
  const whatsappIndex = source.indexOf('label: "WhatsApp"');
  const emailIndex = source.indexOf('label: "Email"');
  const locationIndex = source.indexOf('label: "Ubicación"');

  assert.ok(whatsappIndex >= 0);
  assert.ok(emailIndex > whatsappIndex);
  assert.ok(locationIndex > emailIndex);
});

test("contacto content keeps form submission contract intact", () => {
  const source = read(CONTACTO_CONTENT_PATH);

  assert.ok(source.includes("submitContactMessage,"));
  assert.ok(source.includes("async function handleSubmit"));
  assert.ok(source.includes("event.preventDefault()"));
  assert.ok(source.includes("name: fullName"));
  assert.ok(source.includes("email: email.trim()"));
  assert.ok(source.includes("clinicName: clinica.trim() || null"));
  assert.ok(source.includes("message: mensaje.trim()"));
  assert.ok(source.includes('id="nombre"'));
  assert.ok(source.includes('id="apellido"'));
  assert.ok(source.includes('id="email"'));
  assert.ok(source.includes('id="clinica"'));
  assert.ok(source.includes('id="mensaje"'));
});

test("contacto content avoids prohibited public demo copy", () => {
  const source = read(CONTACTO_CONTENT_PATH);
  const forbiddenPublicCopy = [
    "MUESTRA",
    "DEMOSTRATIVO",
    "ejemplo visual",
    "sin datos reales",
    "caso demo",
    "DEMO-000",
    "DEMO-CLINICA-001",
    "paciente demostrativo",
    "clínica demostrativa",
    "preview de informe simulado",
    "panel operativo simulado",
    "dashboard ficticio",
    "informe inventado",
    "datos ficticios visibles",
  ];

  for (const forbiddenCopy of forbiddenPublicCopy) {
    assert.equal(source.includes(forbiddenCopy), false);
  }
});

test("contacto page remains public and does not expose private route literals", () => {
  const pageSource = read(CONTACTO_PAGE_PATH);
  const contentSource = read(CONTACTO_CONTENT_PATH);
  const combined = [pageSource, contentSource].join("\n");

  assert.equal(combined.includes('"/dashboard"'), false);
  assert.equal(combined.includes('"/api"'), false);
  assert.equal(combined.includes('"/login"'), false);
});
