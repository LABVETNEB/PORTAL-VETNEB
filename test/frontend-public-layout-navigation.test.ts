import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PUBLIC_LAYOUT_PATH = "frontend/src/components/layout/PublicLayout.tsx";
const NAVBAR_PATH = "frontend/src/components/layout/Navbar.tsx";
const FOOTER_PATH = "frontend/src/components/layout/Footer.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("public layout wraps pages with navbar main landmark and footer", () => {
  const source = read(PUBLIC_LAYOUT_PATH);

  assert.ok(source.includes('import { Navbar } from "./Navbar";'));
  assert.ok(source.includes('import { Footer } from "./Footer";'));
  assert.ok(source.includes("interface PublicLayoutProps"));
  assert.ok(source.includes("children: React.ReactNode;"));
  assert.ok(source.includes("<Navbar />"));
  assert.ok(source.includes('<main className="public-page-canvas flex-1" id="main-content">'));
  assert.ok(source.includes("{children}"));
  assert.ok(source.includes("<Footer />"));
});

test("navbar uses centralized public routes for primary navigation", () => {
  const source = read(NAVBAR_PATH);

  assert.ok(source.includes('import Link from "next/link";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(source.includes('{ label: "Servicios", href: ROUTES.servicios }'));
  assert.ok(source.includes('{ label: "Profesionales", href: ROUTES.profesionales }'));
  assert.ok(source.includes('{ label: "Clínicas", href: ROUTES.clinicas }'));
  assert.ok(source.includes('{ label: "Contacto", href: ROUTES.contacto }'));
  assert.ok(source.includes('aria-label="Navegación principal"'));
});

test("navbar exposes home login and access CTAs with VETNEB brand", () => {
  const source = read(NAVBAR_PATH);

  assert.ok(source.includes("href={ROUTES.home}"));
  assert.ok(source.includes('aria-label="VETNEB — Inicio"'));
  assert.ok(source.includes("rounded-md bg-primary px-3"));
  assert.ok(source.includes("font-bold tracking-wide text-white"));
  assert.ok(source.includes("VETNEB"));
  assert.equal(source.includes(">VN<"), false);
  assert.equal(source.includes("Portal VETNEB"), false);
  assert.ok(source.includes("href={ROUTES.login}"));
  assert.ok(source.includes("Iniciar sesión"));
  assert.ok(source.includes("href={ROUTES.contacto}"));
  assert.ok(source.includes("Solicitar acceso"));
});

test("footer uses centralized public routes and contentinfo landmark", () => {
  const source = read(FOOTER_PATH);

  assert.ok(source.includes('import Link from "next/link";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(source.includes('role="contentinfo"'));
  assert.ok(source.includes('const footerLinks = ['));
  assert.ok(source.includes('{ label: "Servicios", href: ROUTES.servicios }'));
  assert.ok(source.includes('{ label: "Profesionales", href: ROUTES.profesionales }'));
  assert.ok(source.includes('{ label: "Clínicas", href: ROUTES.clinicas }'));
  assert.ok(source.includes('{ label: "Contacto", href: ROUTES.contacto }'));
  assert.ok(source.includes("footerLinks.map((link) =>"));
});

test("footer exposes access links and legal copy without redundant brand block", () => {
  const source = read(FOOTER_PATH);

  assert.ok(source.includes("href={ROUTES.login}"));
  assert.ok(source.includes("Iniciar sesión"));
  assert.ok(source.includes("href={ROUTES.contacto}"));
  assert.ok(source.includes("Solicitar acceso"));
  assert.ok(source.includes("Todos los derechos reservados"));
  assert.equal(source.includes("Laboratorio veterinario digital — Argentina"), false);
  assert.equal(source.includes("Laboratorio veterinario digital. Informes, estudios y gestión"), false);
  assert.equal(source.includes("rounded-md bg-primary px-3"), false);
});


