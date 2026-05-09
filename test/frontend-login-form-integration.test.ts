import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const LOGIN_CONTENT_PATH = "frontend/src/components/public/LoginContent.tsx";
const API_CLIENT_PATH = "frontend/src/lib/api.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("login public page submits clinic credentials through the API client", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import { FormEvent, useState } from "react";'));
  assert.ok(source.includes('import { useRouter, useSearchParams } from "next/navigation";'));
  assert.ok(source.includes('import { loginClinic } from "@/lib/api";'));
  assert.ok(source.includes("async function handleSubmit"));
  assert.ok(source.includes("event.preventDefault();"));
  assert.ok(source.includes("await loginClinic({ username, password });"));
  assert.ok(source.includes('aria-label="Formulario de inicio de sesión"'));
  assert.ok(source.includes("onSubmit={handleSubmit}"));
});

test("login public page redirects safely after successful authentication", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes("function getSafeNextPath(nextPath: string | null): string"));
  assert.ok(source.includes('if (!nextPath?.startsWith("/dashboard"))'));
  assert.ok(source.includes("return ROUTES.dashboard;"));
  assert.ok(source.includes("return nextPath;"));
  assert.ok(source.includes('router.replace(getSafeNextPath(searchParams.get("next")))'));
  assert.ok(source.includes("router.refresh();"));
});

test("login public page handles loading and error states", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes("const [username, setUsername]"));
  assert.ok(source.includes("const [password, setPassword]"));
  assert.ok(source.includes("const [errorMessage, setErrorMessage]"));
  assert.ok(source.includes("const [isSubmitting, setIsSubmitting]"));
  assert.ok(source.includes("if (isSubmitting)"));
  assert.ok(source.includes("setErrorMessage(null);"));
  assert.ok(source.includes("setIsSubmitting(true);"));
  assert.ok(source.includes("setIsSubmitting(false);"));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("disabled={isSubmitting}"));
  assert.ok(source.includes('isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"'));
});

test("API client exposes clinic login contract against backend auth endpoint", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function loginClinic("));
  assert.ok(source.includes("credentials: LoginCredentials,"));
  assert.ok(source.includes("Promise<AuthUser>"));
  assert.ok(source.includes('return apiFetch<AuthUser>("/api/auth/login", {'));
  assert.ok(source.includes('method: "POST",'));
  assert.ok(source.includes("body: JSON.stringify(credentials),"));
});
