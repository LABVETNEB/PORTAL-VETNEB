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
  assert.ok(source.includes('import { FormEvent, useEffect, useState } from "react";'));
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
  assert.ok(source.includes("new URL(candidate, SAFE_LOGIN_REDIRECT_ORIGIN)"));
  assert.ok(source.includes("const pathname = parsedNextPath.pathname;"));
  assert.ok(source.includes("parsedNextPath.pathname === ROUTES.dashboardAdmin"));
  assert.ok(source.includes("parsedNextPath.pathname.startsWith(`${ROUTES.dashboardAdmin}/`)"));
  assert.ok(source.includes("pathname === ROUTES.dashboard"));
  assert.ok(source.includes("pathname.startsWith(`${ROUTES.dashboard}/`)"));
  assert.ok(source.includes("return `${pathname}${parsedNextPath.search}`;"));
  assert.equal(source.includes("safePath === ROUTES.dashboardAdmin"), false);
  assert.equal(source.includes("safePath.startsWith(`${ROUTES.dashboardAdmin}/`)"), false);
  assert.ok(source.includes("return ROUTES.dashboard;"));
  assert.equal(source.includes("return nextPath;"), false);
  assert.equal(source.includes("return candidate;"), false);
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
  assert.ok(source.includes("Usuario o email"));
  assert.ok(source.includes('data-auth-credential-input="true"'));
  assert.ok(source.includes('data-auth-credential-visibility-toggle="true"'));
  assert.ok(source.includes('aria-controls="password"'));
  assert.ok(
    source.includes(
      'aria-label={isPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}',
    ),
  );
  assert.ok(source.includes("aria-pressed={isPasswordVisible}"));
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
test("login public page routes particular access away from the clinic login form", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.equal(source.includes('import { loginParticular } from "@/lib/api";'), false);
  assert.equal(source.includes("await loginParticular({ token });"), false);
  assert.equal(source.includes('const [token, setToken]'), false);
  assert.ok(source.includes('const requestedSurface = searchParams.get("tipo") ?? searchParams.get("surface");'));
  assert.ok(source.includes('if (requestedSurface === "particular")'));
  assert.ok(source.includes("router.replace(ROUTES.particulares);"));
  assert.ok(source.includes("Acceda al portal privado con sus credenciales."));
  assert.equal(source.includes("Clínicas"), false);
  assert.equal(source.includes("Particulares"), false);
  assert.equal(source.includes('data-auth-particular-access-link="true"'), false);
  assert.equal(source.includes('data-auth-clinic-access-tab="true"'), false);
  assert.equal(source.includes("<Link"), false);
  assert.equal(source.includes("openParticularAccess"), false);
  assert.equal(source.includes("router.push(ROUTES.particulares);"), false);
});
