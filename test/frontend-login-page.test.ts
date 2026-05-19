import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const LOGIN_PAGE_PATH = "frontend/src/app/login/page.tsx";
const LOGIN_CONTENT_PATH = "frontend/src/components/public/LoginContent.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("login page defines non-indexable metadata through SEO helper", () => {
  const source = read(LOGIN_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { createPageMetadata } from "@/lib/seo";'));
  assert.ok(source.includes("export const metadata: Metadata = {"));
  assert.ok(source.includes("...createPageMetadata("));
  assert.ok(source.includes('"Iniciar sesión — Portal VETNEB"'));
  assert.ok(source.includes('"/login"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
});

test("login page renders LoginContent behind Suspense", () => {
  const source = read(LOGIN_PAGE_PATH);

  assert.ok(source.includes('import { Suspense } from "react";'));
  assert.ok(source.includes('import { LoginContent } from "@/components/public/LoginContent";'));
  assert.ok(source.includes("export default function LoginPage()"));
  assert.ok(source.includes("<Suspense fallback={null}>"));
  assert.ok(source.includes("<LoginContent />"));
});

test("login content keeps standalone login shell and form landmarks", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import Link from "next/link";'));
  assert.ok(source.includes('import { loginClinic } from "@/lib/api";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(source.includes("min-h-screen public-page-canvas flex items-center justify-center p-4"));
  assert.equal(source.includes("bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800"), false);
  assert.ok(source.includes("PORTAL VETNEB"));
  assert.ok(source.includes('aria-label="PORTAL VETNEB — Inicio"'));
  assert.equal(source.includes(">VN<"), false);
  assert.equal(source.includes("Laboratorio veterinario digital"), false);
  assert.ok(source.includes("Iniciar sesión"));
  assert.ok(source.includes('aria-label="Formulario de inicio de sesión"'));
  assert.ok(source.includes("Usuario"));
  assert.ok(source.includes("Contraseña"));
});

test("login content keeps safe dashboard redirect and error handling", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes("function getSafeNextPath(nextPath: string | null): string"));
  assert.ok(source.includes("candidate === ROUTES.dashboard"));
  assert.ok(source.includes("candidate.startsWith(`${ROUTES.dashboard}/`)"));
  assert.ok(source.includes("candidate.startsWith(`${ROUTES.dashboard}?`)"));
  assert.ok(source.includes("candidate === ROUTES.dashboardAdmin"));
  assert.ok(source.includes("candidate.startsWith(`${ROUTES.dashboardAdmin}/`)"));
  assert.ok(source.includes("return ROUTES.dashboard;"));
  assert.ok(source.includes('router.replace(getSafeNextPath(searchParams.get("next")))'));
  assert.ok(source.includes("router.refresh();"));
  assert.ok(source.includes("setErrorMessage("));
  assert.ok(source.includes('role="alert"'));
});

test("login content exposes public navigation affordances without direct fetch", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes("href={ROUTES.home}"));
  assert.ok(source.includes('aria-label="PORTAL VETNEB — Inicio"'));
  assert.ok(source.includes("¿Su clínica no tiene acceso?"));
  assert.ok(source.includes("href={ROUTES.contacto}"));
  assert.ok(source.includes("Solicite acceso"));
  assert.ok(source.includes("← Volver al sitio público"));
  assert.equal(source.includes('"/api"'), false);
  assert.equal(source.includes("fetch("), false);
});

