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
  assert.ok(source.includes('import { createPageMetadata } from "@/lib/seo";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Contacto — Portal VETNEB"'));
  assert.ok(source.includes('"Contacte con el equipo de Portal VETNEB.'));
  assert.ok(source.includes('"/contacto"'));
});

test("contacto public page delegates rendering to ContactoContent", () => {
  const source = read(CONTACTO_PAGE_PATH);

  assert.ok(source.includes('import { ContactoContent } from "@/components/public/ContactoContent";'));
  assert.ok(source.includes("export default function ContactoPage()"));
  assert.ok(source.includes("return <ContactoContent />;"));
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

test("contacto content keeps clinic onboarding guidance visible", () => {
  const source = read(CONTACTO_CONTENT_PATH);

  assert.ok(source.includes("¿Es una clínica veterinaria?"));
  assert.ok(source.includes("registrar su clínica en Portal VETNEB"));
  assert.ok(source.includes("configurar su acceso"));
  assert.ok(source.includes("Nombre de la clínica (opcional)"));
  assert.ok(source.includes("Describa su consulta o solicitud de acceso"));
});

test("contacto page remains public and does not expose private route literals", () => {
  const pageSource = read(CONTACTO_PAGE_PATH);
  const contentSource = read(CONTACTO_CONTENT_PATH);
  const combined = [pageSource, contentSource].join("\n");

  assert.equal(combined.includes('"/dashboard"'), false);
  assert.equal(combined.includes('"/api"'), false);
  assert.equal(combined.includes('"/login"'), false);
});
