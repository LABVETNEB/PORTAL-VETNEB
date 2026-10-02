import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import ts from "typescript";
import { descendants, effectiveAttribute, evaluate, jsxElements, parseTsx, tagName } from "../dashboard/dashboard-source-oracle.ts";
import { functionNamed } from "../admin/source-function-runner.ts";

const LOGIN_CONTENT_PATH = "frontend/src/components/public/LoginContent.tsx";
const API_CLIENT_PATH = "frontend/src/lib/api.ts";

function assertLoginUnifiedRateLimitImport(source: string): void {
  assert.match(
    source,
    /import\s*\{[\s\S]*\bloginUnified\b[\s\S]*\bRateLimitError\b[\s\S]*\}\s*from\s+"@\/lib\/api";?/,
  );
}

test("login public page submits clinic credentials through the API client", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import { FormEvent, useEffect, useState } from "react";'));
  assert.ok(source.includes('import { useRouter, useSearchParams } from "next/navigation";'));
  assertLoginUnifiedRateLimitImport(source);
  assert.ok(source.includes("async function handleSubmit"));
  assert.ok(source.includes("event.preventDefault();"));
  assert.ok(source.includes("const response = await loginUnified({"));
  assert.ok(source.includes("identifier: username,"));
  assert.ok(source.includes("password,"));
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
  assert.ok(source.includes("const destination ="));
  assert.ok(source.includes("response.redirectTo"));
  assert.ok(source.includes("router.replace(destination);"));
  assert.ok(source.includes("router.refresh();"));
});

test("login public page handles loading and error states", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes("const [username, setUsername]"));
  assert.ok(source.includes("const [password, setPassword]"));
  assert.ok(source.includes("const [errorMessage, setErrorMessage]"));
  assert.ok(source.includes("const [isSubmitting, setIsSubmitting]"));
  assert.ok(source.includes("const [rateLimitCooldown, setRateLimitCooldown] = useState(0)"));
  assert.ok(source.includes("if (isSubmitting || rateLimitCooldown > 0)"));
  assert.ok(source.includes("setErrorMessage(null);"));
  assert.ok(source.includes("setIsSubmitting(true);"));
  assert.ok(source.includes("setIsSubmitting(false);"));
  assert.ok(source.includes("setRateLimitCooldown(0);"));
  assert.ok(source.includes("error instanceof RateLimitError"));
  assert.ok(source.includes("setRateLimitCooldown(error.retryAfterSeconds)"));
  assert.ok(source.includes("const isBlocked = isSubmitting || rateLimitCooldown > 0"));
  assert.ok(source.includes("error instanceof Error"));
  assert.ok(source.includes("? error.message"));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("disabled={isBlocked}"));
  assert.ok(source.includes("const clinicSubmitLabel = isSubmitting"));
  assert.ok(source.includes("rateLimitCooldown > 0"));
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

test("login public page prevents mobile double submit while request is pending", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes("if (isSubmitting || rateLimitCooldown > 0)"));
  assert.ok(source.includes("return;"));
  assert.ok(source.includes("const isBlocked = isSubmitting || rateLimitCooldown > 0"));
  assert.ok(source.includes("disabled={isBlocked}"));
  assert.ok(source.includes("aria-busy={isSubmitting}"));
});

test("TEST-GLOBAL-08 G06-F08 kills M-F05 for cooldown guards and disabled controls", () => {
  const source = read(LOGIN_CONTENT_PATH);
  const blocked = (candidate: string) => {
    const handler = functionNamed(parseTsx(candidate, LOGIN_CONTENT_PATH), "handleSubmit");
    const [guard] = descendants(handler, ts.isIfStatement);
    assert.ok(guard, "handleSubmit must have its early guard");
    return evaluate(guard.expression, { isSubmitting: false, rateLimitCooldown: 4 });
  };
  const disabled = (candidate: string) => jsxElements(parseTsx(candidate, LOGIN_CONTENT_PATH))
    .filter((element) => ["Input", "button", "Button"].includes(tagName(element)))
    .map((element) => effectiveAttribute(element, "disabled"))
    .filter((value) => value.kind === "value")
    .map((value) => evaluate(value.expression, { isBlocked: true }));
  assert.equal(blocked(source), true);
  assert.ok(disabled(source).every((value) => value === true));
  const mutant = source
    .replace("if (isSubmitting || rateLimitCooldown > 0) {", "if (false) {")
    .replaceAll("disabled={isBlocked}", "disabled={isBlocked} {...{ disabled: false }}");
  assert.notEqual(mutant, source, "M-F05 must be applicable");
  assert.equal(blocked(mutant), false, "M-F05 bypasses the cooldown guard");
  assert.ok(disabled(mutant).some((value) => value === false), "M-F05 re-enables a blocked control");
});

test("API client exposes unified login contract against backend auth endpoint", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function loginUnified("));
  assert.ok(source.includes("credentials: UnifiedLoginCredentials,"));
  assert.ok(source.includes("Promise<UnifiedLoginResponse>"));
  assert.ok(source.includes('return apiFetch<UnifiedLoginResponse>("/api/auth/login", {'));
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
