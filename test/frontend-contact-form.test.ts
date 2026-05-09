import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const CONTACT_CONTENT_PATH = "frontend/src/components/public/ContactoContent.tsx";
const API_CLIENT_PATH = "frontend/src/lib/api.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend contact api client posts to public contact endpoint", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export type ContactMessagePayload"));
  assert.ok(source.includes("export type ContactMessageResponse"));
  assert.ok(source.includes("export async function submitContactMessage"));
  assert.ok(source.includes('apiFetch<ContactMessageResponse>("/api/contact"'));
  assert.ok(source.includes('method: "POST"'));
  assert.ok(source.includes("body: JSON.stringify(payload)"));
});

test("frontend contact form submits public contact payload", () => {
  const source = read(CONTACT_CONTENT_PATH);

  assert.ok(source.includes('"use client"'));
  assert.ok(source.includes('import { FormEvent, useState } from "react"'));
  assert.ok(source.includes('import { submitContactMessage } from "@/lib/api"'));
  assert.ok(source.includes("async function handleSubmit"));
  assert.ok(source.includes("event.preventDefault()"));
  assert.ok(source.includes("await submitContactMessage({"));
  assert.ok(source.includes("name: fullName"));
  assert.ok(source.includes("email: email.trim()"));
  assert.ok(source.includes("clinicName: clinica.trim() || null"));
  assert.ok(source.includes("message: mensaje.trim()"));
  assert.ok(source.includes("onSubmit={handleSubmit}"));
});

test("frontend contact form exposes feedback and no longer blocks submit", () => {
  const source = read(CONTACT_CONTENT_PATH);

  assert.ok(source.includes("const [errorMessage, setErrorMessage]"));
  assert.ok(source.includes("const [successMessage, setSuccessMessage]"));
  assert.ok(source.includes("const [isSubmitting, setIsSubmitting]"));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("disabled={isSubmitting}"));
  assert.ok(source.includes("Enviar mensaje"));
  assert.equal(source.includes("Enviar mensaje (próximamente)"), false);
  assert.equal(source.includes("Nota de desarrollo"), false);
  assert.equal(source.includes("onSubmit={(e) => e.preventDefault()}"), false);
});
