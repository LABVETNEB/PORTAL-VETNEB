import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PUBLIC_LAYOUT_PATH = "frontend/src/components/layout/PublicLayout.tsx";
const NAVBAR_PATH = "frontend/src/components/layout/Navbar.tsx";
const NAV_LINKS_PATH = "frontend/src/components/layout/NavLinks.tsx";
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
  const navbarSource = read(NAVBAR_PATH);
  const navLinksSource = read(NAV_LINKS_PATH);

  // Navbar.tsx must stay server component — link data lives in NavLinks.tsx (client)
  assert.equal(navbarSource.includes('"use client";'), false);
  assert.ok(navbarSource.includes('import { PublicRouteControl } from "@/components/public/PublicRouteControl";'));
  assert.ok(navbarSource.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(navbarSource.includes('aria-label="Navegación principal"'));

  // Link data and ROUTES usage live in NavLinks.tsx
  assert.ok(navLinksSource.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(navLinksSource.includes('const mobileNavLinks = [{ label: "Inicio", href: ROUTES.home }, ...navLinks];'));
  assert.ok(navLinksSource.includes('{ label: "Servicios", href: ROUTES.servicios }'));
  assert.ok(navLinksSource.includes('{ label: "Profesionales", href: ROUTES.profesionales }'));
  assert.ok(navLinksSource.includes('{ label: "Clínicas", href: ROUTES.clinicas }'));
  assert.ok(navLinksSource.includes('{ label: "Particulares", href: ROUTES.particulares }'));
  assert.ok(navLinksSource.includes('{ label: "Contacto", href: ROUTES.contacto }'));
  assert.ok(navLinksSource.includes('{ label: "Precios", href: ROUTES.precios }'));
});

test("navbar keeps full navigation desktop-only and exposes mobile dropdown", () => {
  const navbarSource = read(NAVBAR_PATH);
  const navLinksSource = read(NAV_LINKS_PATH);

  assert.ok(
    navbarSource.includes(
      'className="hidden items-center gap-1 rounded-md border border-vetneb-line/80 bg-card/88 p-1 lg:flex"',
    ),
  );
  assert.equal(navbarSource.includes("p-1 md:flex"), false);
  assert.ok(navbarSource.includes('className="relative lg:hidden"'));
  assert.ok(navbarSource.includes("<details"));
  assert.ok(navbarSource.includes("<summary"));
  assert.ok(navbarSource.includes('aria-label="Navegación mobile"'));
  // Mobile links iteration is in NavLinks.tsx (MobileNavLinks component)
  assert.ok(navLinksSource.includes("{mobileNavLinks.map((link) => ("));
  assert.equal(navbarSource.includes('className="public-cta-outline lg:hidden"'), false);
  assert.equal(navbarSource.includes("<Link href={ROUTES.profesionales}>Profesionales</Link>"), false);
  assert.ok(navLinksSource.includes('{ label: "Profesionales", href: ROUTES.profesionales }'));
});

test("navbar mobile dropdown includes expected public links", () => {
  const navLinksSource = read(NAV_LINKS_PATH);

  assert.ok(navLinksSource.includes('const mobileNavLinks = [{ label: "Inicio", href: ROUTES.home }, ...navLinks];'));
  assert.ok(navLinksSource.includes('{ label: "Servicios", href: ROUTES.servicios }'));
  assert.ok(navLinksSource.includes('{ label: "Profesionales", href: ROUTES.profesionales }'));
  assert.ok(navLinksSource.includes('{ label: "Clínicas", href: ROUTES.clinicas }'));
  assert.ok(navLinksSource.includes('{ label: "Particulares", href: ROUTES.particulares }'));
  assert.ok(navLinksSource.includes('{ label: "Contacto", href: ROUTES.contacto }'));
  assert.ok(navLinksSource.includes('{ label: "Precios", href: ROUTES.precios }'));
});

test("navbar keeps expected public link order including precios", () => {
  const navLinksSource = read(NAV_LINKS_PATH);

  const serviciosIndex = navLinksSource.indexOf('{ label: "Servicios", href: ROUTES.servicios }');
  const profesionalesIndex = navLinksSource.indexOf('{ label: "Profesionales", href: ROUTES.profesionales }');
  const clinicasIndex = navLinksSource.indexOf('{ label: "Clínicas", href: ROUTES.clinicas }');
  const particularesIndex = navLinksSource.indexOf('{ label: "Particulares", href: ROUTES.particulares }');
  const contactoIndex = navLinksSource.indexOf('{ label: "Contacto", href: ROUTES.contacto }');
  const preciosIndex = navLinksSource.indexOf('{ label: "Precios", href: ROUTES.precios }');

  assert.ok(serviciosIndex < profesionalesIndex);
  assert.ok(profesionalesIndex < clinicasIndex);
  assert.ok(clinicasIndex < particularesIndex);
  assert.ok(particularesIndex < contactoIndex);
  assert.ok(contactoIndex < preciosIndex);
});

test("navbar exposes home login and access CTAs with VETNEB brand", () => {
  const source = read(NAVBAR_PATH);

  assert.ok(source.includes("href={ROUTES.home}"));
  assert.ok(source.includes('aria-label="VETNEB — Inicio"'));
  assert.ok(source.includes("rounded-md bg-primary px-3"));
  assert.ok(source.includes("font-bold text-primary-foreground"));
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

  assert.equal(source.includes('"use client";'), false);
  assert.ok(source.includes("PublicRouteControl"));
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
