import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const FRONTEND_SRC_ROOT = "frontend/src";
const FRONTEND_APP_ROOT = "frontend/src/app";
const FRONTEND_COMPONENTS_ROOT = "frontend/src/components";
const NAVBAR_PATH = "frontend/src/components/layout/Navbar.tsx";
const HOME_PATH = "frontend/src/app/page.tsx";
const FOOTER_PATH = "frontend/src/components/layout/Footer.tsx";
const CONTACTO_PATH = "frontend/src/components/public/ContactoContent.tsx";
const PROFESIONALES_PATH =
  "frontend/src/components/public/ProfesionalesSearchContent.tsx";
const PUBLIC_ACTION_PATH = "frontend/src/components/public/PublicAction.tsx";
const PUBLIC_ROUTE_CONTROL_PATH =
  "frontend/src/components/public/PublicRouteControl.tsx";
const RENDER_PRIMITIVES_PATH = "frontend/src/components/public/RenderPrimitives.tsx";
const OFFLINE_ACTIONS_PATH = "frontend/src/components/pwa/OfflineActions.tsx";
const DASHBOARD_SIDEBAR_PATH =
  "frontend/src/components/dashboard/DashboardSidebarFrame.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function collectFiles(relativeRoot: string, extensions: string[]): string[] {
  const absoluteRoot = resolve(process.cwd(), relativeRoot);
  const files: string[] = [];
  const rootPrefix = resolve(process.cwd(), "").replace(/\\/g, "/") + "/";

  function walk(currentPath: string) {
    for (const entry of readdirSync(currentPath)) {
      const fullPath = `${currentPath}/${entry}`;
      const info = statSync(fullPath);

      if (info.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (extensions.some((extension) => entry.endsWith(extension))) {
        files.push(fullPath.replace(rootPrefix, ""));
      }
    }
  }

  walk(absoluteRoot.replace(/\\/g, "/"));

  return files;
}

const appAndComponentFiles = [
  ...collectFiles(FRONTEND_APP_ROOT, [".ts", ".tsx"]),
  ...collectFiles(FRONTEND_COMPONENTS_ROOT, [".ts", ".tsx"]),
];

const frontendSourceFiles = collectFiles(FRONTEND_SRC_ROOT, [
  ".ts",
  ".tsx",
  ".css",
]);

test("frontend source keeps NEXT_LINK_IMPORTS=0, LINK_TAGS=0, ANCHOR_HITS=0 and IFRAME_HITS=1 (footer map only)", () => {
  const nextLinkImports = frontendSourceFiles.filter((file) =>
    /from\s+["']next\/link["']/.test(read(file)),
  );
  const linkTags = frontendSourceFiles.filter((file) => /<Link\b/.test(read(file)));
  const anchors = frontendSourceFiles.filter((file) => /<a\b/.test(read(file)));
  const iframes = frontendSourceFiles.filter((file) => /<iframe\b/.test(read(file)));

  assert.equal(
    nextLinkImports.length,
    0,
    `NEXT_LINK_IMPORTS should be 0, got ${nextLinkImports.length}: ${nextLinkImports.join(", ")}`,
  );
  assert.equal(
    linkTags.length,
    0,
    `LINK_TAGS should be 0, got ${linkTags.length}: ${linkTags.join(", ")}`,
  );
  assert.equal(
    anchors.length,
    0,
    `ANCHOR_HITS should be 0, got ${anchors.length}: ${anchors.join(", ")}`,
  );
  assert.equal(
    iframes.length,
    1,
    `IFRAME_HITS should be 1, got ${iframes.length}: ${iframes.join(", ")}`,
  );
  assert.deepEqual(
    iframes,
    [FOOTER_PATH],
    `IFRAME_HITS can only come from ${FOOTER_PATH}, got: ${iframes.join(", ")}`,
  );
});

test("no internal visual navigation uses Button asChild + Link", () => {
  for (const file of appAndComponentFiles) {
    const source = read(file);

    if (file.endsWith("frontend/src/components/ui/button.tsx")) {
      continue;
    }

    assert.equal(
      source.includes("Button asChild"),
      false,
      `${file} should not use Button asChild for navigation`,
    );
    assert.equal(source.includes("<Link"), false, `${file} should not render <Link>`);
  }
});

test("home hero CTAs use PublicRouteControl with explicit visible text class", () => {
  const source = read(HOME_PATH);

  assert.equal(source.includes("<Link"), false);
  assert.ok(source.includes("<PublicRouteControl"));
  assert.ok(source.includes("Acceder a informes y trazabilidad"));
  assert.ok(source.includes("Consultar informes 24 hs"));
  assert.ok(source.includes("href={ROUTES.login}"));
  assert.ok(source.includes("href={ROUTES.particulares}"));
  assert.ok(
    source.includes(
      'className="public-cta-on-hero w-full text-vetneb-navy hover:text-vetneb-navy active:text-vetneb-navy focus-visible:text-vetneb-navy sm:w-auto"',
    ),
  );
});

test("PublicExternalControl covers WhatsApp, mailto and external map surfaces", () => {
  const home = read(HOME_PATH);
  const footer = read(FOOTER_PATH);
  const contacto = read(CONTACTO_PATH);
  const profesionales = read(PROFESIONALES_PATH);

  assert.ok(home.includes("<PublicExternalControl"));
  assert.ok(home.includes('href="https://wa.me/5493534138946"'));
  assert.ok(home.includes('target="_blank"'));

  assert.ok(footer.includes("<PublicExternalControl"));
  assert.ok(footer.includes('href="https://wa.me/5493534138946"'));
  assert.ok(footer.includes('href="mailto:lab.vetneb@gmail.com"'));
  assert.ok(footer.includes("href={mapsLocationUrl}"));
  assert.ok(footer.includes("Ver ubicación en Maps"));

  assert.ok(contacto.includes("<PublicExternalControl"));
  assert.ok(contacto.includes("href={info.href}"));
  assert.ok(
    contacto.includes('target={info.href.startsWith("http") ? "_blank" : "_self"}'),
  );

  assert.ok(profesionales.includes("<PublicExternalControl"));
  assert.ok(profesionales.includes("href={`mailto:${professional.email}`}"));
  assert.ok(
    profesionales.includes(
      "href={`https://wa.me/549${professional.phone.replace(/\\D/g, \"\")}`}",
    ),
  );
  assert.ok(profesionales.includes("href={professional.mapLink}"));
  assert.ok(profesionales.includes('target="_blank"'));
});

test("footer map surface uses a single non-interactive iframe and keeps external map control", () => {
  const footer = read(FOOTER_PATH);

  assert.ok(footer.includes("<iframe"));
  assert.ok(footer.includes("mapsEmbedUrl"));
  assert.ok(footer.includes("https://www.google.com/maps?output=embed&q="));
  assert.ok(footer.includes('title="Mapa de ubicación de Servicio Patológico VETNEB"'));
  assert.ok(footer.includes("src={mapsEmbedUrl}"));
  assert.ok(footer.includes('loading="lazy"'));
  assert.ok(footer.includes('referrerPolicy="no-referrer-when-downgrade"'));
  assert.ok(footer.includes('aria-hidden="true"'));
  assert.ok(footer.includes("tabIndex={-1}"));
  assert.ok(footer.includes("pointer-events-none"));
  assert.ok(footer.includes("mapsLocationUrl"));
  assert.ok(footer.includes("<PublicExternalControl"));
  assert.ok(footer.includes("href={mapsLocationUrl}"));
  assert.ok(footer.includes('target="_blank"'));
  assert.ok(footer.includes("Ver ubicación en Maps"));
  assert.equal(/<a\b/.test(footer), false);
  assert.equal(/<Link\b/.test(footer), false);
});

test("navigation controls avoid anti-preview hacks", () => {
  const guardedFiles = [
    PUBLIC_ROUTE_CONTROL_PATH,
    PUBLIC_ACTION_PATH,
    RENDER_PRIMITIVES_PATH,
    NAVBAR_PATH,
    FOOTER_PATH,
    HOME_PATH,
    OFFLINE_ACTIONS_PATH,
    DASHBOARD_SIDEBAR_PATH,
  ];

  const forbiddenPatterns = [
    "preventDefault",
    "onPointerDown",
    "onTouchStart",
    "-webkit-touch-callout",
    "user-select: none",
  ];

  for (const file of guardedFiles) {
    const source = read(file);

    for (const pattern of forbiddenPatterns) {
      assert.equal(
        source.includes(pattern),
        false,
        `${file} should not contain ${pattern}`,
      );
    }
  }
});
