import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const CONTACTO_CONTENT_PATH = "frontend/src/components/public/ContactoContent.tsx";
const API_CLIENT_PATH = "frontend/src/lib/api.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("contact public page submits messages through the API client", () => {
  const source = read(CONTACTO_CONTENT_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import { submitContactMessage } from "@/lib/api";'));
  assert.ok(source.includes("async function handleSubmit"));
  assert.ok(source.includes("event.preventDefault();"));
  assert.ok(source.includes("await submitContactMessage({"));
  assert.ok(source.includes("name: fullName,"));
  assert.ok(source.includes("email: email.trim(),"));
  assert.ok(source.includes("clinicName: clinica.trim() || null,"));
  assert.ok(source.includes("message: mensaje.trim(),"));
  assert.ok(source.includes('aria-label="Formulario de contacto"'));
  assert.ok(source.includes("onSubmit={handleSubmit}"));
});

test("contact public page handles loading, feedback cleanup and conditional reset states", () => {
  const source = read(CONTACTO_CONTENT_PATH);

  assert.ok(source.includes("const [errorMessage, setErrorMessage]"));
  assert.ok(source.includes("const [successMessage, setSuccessMessage]"));
  assert.ok(source.includes("const [warningMessage, setWarningMessage]"));
  assert.ok(source.includes("const [isSubmitting, setIsSubmitting]"));
  assert.ok(source.includes("function clearFeedbackMessages()"));
  assert.ok(source.includes("function resolveContactSubmitErrorMessage(error: unknown)"));
  assert.ok(source.includes('"No se pudo contactar al servidor. Verifique la conexión o intente nuevamente."'));
  assert.ok(source.includes('normalizedMessageLower === "failed to fetch"'));
  assert.ok(source.includes('normalizedMessageLower === "fetch failed"'));
  assert.ok(source.includes("setErrorMessage(null);"));
  assert.ok(source.includes("setSuccessMessage(null);"));
  assert.ok(source.includes("if (isSubmitting)"));
  assert.ok(source.includes("clearFeedbackMessages();"));
  assert.ok(source.includes("setIsSubmitting(true);"));
  assert.ok(source.includes('response.reason === "smtp_disabled"'));
  assert.ok(source.includes("setWarningMessage(response.message);"));
  assert.ok(source.includes("setSuccessMessage(response.message);"));
  assert.ok(source.includes("clinical-alert-warning"));
  assert.ok(
    /onChange=\{\(event\) => \{\s*clearFeedbackMessages\(\);\s*setNombre\(event\.target\.value\);\s*\}\}/.test(
      source,
    ),
  );
  assert.ok(
    /onChange=\{\(event\) => \{\s*clearFeedbackMessages\(\);\s*setApellido\(event\.target\.value\);\s*\}\}/.test(
      source,
    ),
  );
  assert.ok(
    /onChange=\{\(event\) => \{\s*clearFeedbackMessages\(\);\s*setEmail\(event\.target\.value\);\s*\}\}/.test(
      source,
    ),
  );
  assert.ok(
    /onChange=\{\(event\) => \{\s*clearFeedbackMessages\(\);\s*setClinica\(event\.target\.value\);\s*\}\}/.test(
      source,
    ),
  );
  assert.ok(
    /onChange=\{\(event\) => \{\s*clearFeedbackMessages\(\);\s*setMensaje\(event\.target\.value\);\s*\}\}/.test(
      source,
    ),
  );

  const warningBranchMatch = source.match(
    /if \(response\.sent === false \|\| response\.reason === "smtp_disabled"\) \{([\s\S]*?)\}\s*else if \(response\.sent === true\)/,
  );
  assert.ok(warningBranchMatch);
  assert.ok(warningBranchMatch[1]?.includes("setWarningMessage(response.message);"));
  assert.equal(
    /setNombre\(""\)|setApellido\(""\)|setEmail\(""\)|setClinica\(""\)|setMensaje\(""\)/.test(
      warningBranchMatch[1] ?? "",
    ),
    false,
  );

  const successBranchMatch = source.match(
    /else if \(response\.sent === true\) \{([\s\S]*?)\n\s*\}/,
  );
  assert.ok(successBranchMatch);
  assert.ok(successBranchMatch[1]?.includes("setSuccessMessage(response.message);"));
  assert.ok(successBranchMatch[1]?.includes('setNombre("");'));
  assert.ok(successBranchMatch[1]?.includes('setApellido("");'));
  assert.ok(successBranchMatch[1]?.includes('setEmail("");'));
  assert.ok(successBranchMatch[1]?.includes('setClinica("");'));
  assert.ok(successBranchMatch[1]?.includes('setMensaje("");'));
  const catchBranchMatch = source.match(
    /catch \(error\) \{([\s\S]*?)\}\s*finally \{/,
  );
  assert.ok(catchBranchMatch);
  assert.ok(
    catchBranchMatch[1]?.includes(
      "setErrorMessage(resolveContactSubmitErrorMessage(error));",
    ),
  );
  assert.equal(
    /setNombre\(""\)|setApellido\(""\)|setEmail\(""\)|setClinica\(""\)|setMensaje\(""\)/.test(
      catchBranchMatch[1] ?? "",
    ),
    false,
  );
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("disabled={isSubmitting}"));
  assert.ok(source.includes('isSubmitting ? "Enviando mensaje..." : "Enviar mensaje"'));
});

test("API client exposes contact message contract against backend contact endpoint", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export type ContactMessagePayload = {"));
  assert.ok(source.includes("name: string;"));
  assert.ok(source.includes("email: string;"));
  assert.ok(source.includes("clinicName?: string | null;"));
  assert.ok(source.includes("message: string;"));
  assert.ok(source.includes("export type ContactMessageResponse = {"));
  assert.ok(source.includes("success: true;"));
  assert.ok(source.includes("sent: boolean;"));
  assert.ok(source.includes('reason?: "smtp_disabled";'));
  assert.ok(source.includes("export async function submitContactMessage("));
  assert.ok(source.includes('return apiFetch<ContactMessageResponse>("/api/contact", {'));
  assert.ok(source.includes('method: "POST",'));
  assert.ok(source.includes("body: JSON.stringify(payload),"));
});
