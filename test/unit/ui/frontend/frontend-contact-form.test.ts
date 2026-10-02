import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import { parseTsx } from "../dashboard/dashboard-source-oracle.ts";
import { functionNamed, runSource } from "../admin/source-function-runner.ts";

const CONTACT_CONTENT_PATH = "frontend/src/components/public/ContactoContent.tsx";
const API_CLIENT_PATH = "frontend/src/lib/api.ts";

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
  assert.ok(source.includes("PUBLIC_API_CONFIGURATION_ERROR_MESSAGE"));
  assert.ok(source.includes('submitContactMessage'));
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
  assert.ok(source.includes("const [warningMessage, setWarningMessage]"));
  assert.ok(source.includes("const [isSubmitting, setIsSubmitting]"));
  assert.ok(source.includes("resolveContactSubmitErrorMessage"));
  assert.ok(source.includes("normalizedMessage === PUBLIC_API_CONFIGURATION_ERROR_MESSAGE"));
  assert.ok(source.includes('"No se pudo contactar al servidor. Verifique la conexión o intente nuevamente."'));
  assert.ok(source.includes('setErrorMessage(resolveContactSubmitErrorMessage(error));'));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("disabled={isSubmitting}"));
  assert.ok(source.includes("Enviar mensaje"));
  assert.equal(source.includes("Enviar mensaje (próximamente)"), false);
  assert.equal(source.includes("Nota de desarrollo"), false);
  assert.equal(source.includes("onSubmit={(e) => e.preventDefault()}"), false);
});

test("TEST-GLOBAL-08 G06-F04 kills M-F02 by surfacing rejected submissions", async () => {
  const source = read(CONTACT_CONTENT_PATH);
  const run = async (candidate: string) => {
    const errors: unknown[] = [];
    const submit = runSource<(event: { preventDefault(): void }) => Promise<void>>(
      functionNamed(parseTsx(candidate, CONTACT_CONTENT_PATH), "handleSubmit"),
      {
        isSubmitting: false,
        clearFeedbackMessages: () => undefined,
        setIsSubmitting: () => undefined,
        nombre: "Ana", apellido: "Pérez", email: "ana@example.test", clinica: "", mensaje: "Consulta",
        submitContactMessage: async () => { throw new Error("network down"); },
        setWarningMessage: () => undefined, setSuccessMessage: () => undefined,
        setNombre: () => undefined, setApellido: () => undefined, setEmail: () => undefined,
        setClinica: () => undefined, setMensaje: () => undefined,
        setErrorMessage: (message: unknown) => errors.push(message),
        resolveContactSubmitErrorMessage: () => "No se pudo contactar al servidor.",
      },
    );
    await submit({ preventDefault: () => undefined });
    return errors;
  };
  assert.deepEqual(await run(source), ["No se pudo contactar al servidor."]);
  const mutant = source.replace(
    "setErrorMessage(resolveContactSubmitErrorMessage(error));",
    "if (false) setErrorMessage(resolveContactSubmitErrorMessage(error));",
  );
  assert.notEqual(mutant, source, "M-F02 must be applicable");
  assert.deepEqual(await run(mutant), [], "M-F02 hides the failed-submit feedback");
});
