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
const PROFESIONAL_DETAIL_PATH =
  "frontend/src/components/public/ProfesionalDetailContent.tsx";
const PUBLIC_ACTION_PATH = "frontend/src/components/public/PublicAction.tsx";
const PUBLIC_ROUTE_CONTROL_PATH =
  "frontend/src/components/public/PublicRouteControl.tsx";
const RENDER_PRIMITIVES_PATH = "frontend/src/components/public/RenderPrimitives.tsx";
const OFFLINE_ACTIONS_PATH = "frontend/src/components/pwa/OfflineActions.tsx";

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

  // PR-10 — action tiles reemplazan los CTAs button-style del hero
  assert.equal(source.includes("<Link"), false);
  assert.ok(source.includes("<PublicRouteControl"));
  assert.ok(source.includes("Acceder al portal"));
  assert.ok(source.includes("Seguir con código"));
  assert.ok(source.includes("href={ROUTES.login}"));
  assert.ok(source.includes("href={ROUTES.particulares}"));
  assert.ok(source.includes("public-hero-action-tile"));
});

test("PublicExternalControl covers WhatsApp, mailto and external map surfaces", () => {
  const home = read(HOME_PATH);
  const footer = read(FOOTER_PATH);
  const contacto = read(CONTACTO_PATH);
  const profesionales = read(PROFESIONALES_PATH);
  const profesionalDetail = read(PROFESIONAL_DETAIL_PATH);

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

  assert.equal(profesionales.includes("<PublicExternalControl"), false);

  assert.ok(profesionalDetail.includes("<PublicExternalControl"));
  assert.ok(profesionalDetail.includes("href={`mailto:${professional.email}`}"));
  assert.ok(
    profesionalDetail.includes("href={buildWhatsAppHref(professional.phone)}"),
  );
  assert.ok(profesionalDetail.includes("href={professional.mapLink}"));
  assert.ok(profesionalDetail.includes('target="_blank"'));
  assert.equal(/<a\b/.test(profesionalDetail), false);
});

test("Public contact surfaces keep explicit safe navigation targets", () => {
  const profesionalDetail = read(PROFESIONAL_DETAIL_PATH);
  const particulares = read("frontend/src/components/public/ParticularesContent.tsx");

  assert.ok(profesionalDetail.includes("<PublicExternalControl"));
  assert.ok(profesionalDetail.includes("href={`mailto:${professional.email}`}"));
  assert.ok(profesionalDetail.includes('target="_self"'));
  assert.ok(
    profesionalDetail.includes("href={buildWhatsAppHref(professional.phone)}"),
  );
  assert.ok(profesionalDetail.includes('target="_blank"'));
  assert.ok(profesionalDetail.includes("href={professional.mapLink}"));
  assert.ok(
    profesionalDetail.includes(
      'aria-label={`Abrir mapa de ${professional.displayName}`}',
    ),
  );

  assert.ok(particulares.includes("href={buildSpecialStainWhatsAppHref(trackingCase, session)}"));
  assert.ok(particulares.includes('aria-label="Consultar por WhatsApp sobre tinción especial"'));
  assert.ok(particulares.includes('<MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />'));
  assert.ok(particulares.includes("href={buildSpecialStainEmailHref(trackingCase, session)}"));
  assert.ok(particulares.includes('aria-label="Enviar email a VETNEB sobre tinción especial"'));
  assert.ok(particulares.includes('<Mail className="h-4 w-4 shrink-0" aria-hidden="true" />'));
});

test("PublicExternalControl keeps safe external navigation contract", () => {
  const source = read(PUBLIC_ROUTE_CONTROL_PATH);

  assert.ok(source.includes('target = "_blank"'));
  assert.ok(source.includes("if (event.defaultPrevented || disabled)"));
  assert.ok(source.includes('if (target === "_self")'));
  assert.ok(source.includes("window.location.assign(href);"));
  assert.ok(source.includes('window.open(href, target, "noopener,noreferrer");'));
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

test("footer map iframe is hermetic under CI E2E flag and keeps the external control unconditional", () => {
  const footer = read(FOOTER_PATH);

  assert.ok(
    footer.includes(
      'process.env.VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS === "1"',
    ),
    "must gate on the server-only E2E embed flag",
  );
  assert.ok(
    footer.includes('process.env.CI === "true" &&'),
    "must require CI in addition to the embed flag (double-key, not flag-only)",
  );
  assert.equal(
    footer.includes("NEXT_PUBLIC_"),
    false,
    "must never use a NEXT_PUBLIC_* var for this server-only condition",
  );

  const conditionIndex = footer.indexOf("disableExternalEmbedsForE2e =");
  assert.ok(conditionIndex >= 0, "must define the disableExternalEmbedsForE2e condition");

  // Exactly one <iframe> in source, always (other frozen contracts pin this
  // count independently). Non-NEXT_PUBLIC_ env vars are only inlined for
  // server bundles — any client-bundled re-execution of this module (e.g.
  // reached through a "use client" ancestor) sees them as unset — so the
  // element TYPE must never branch on the flag (that would be a hard
  // hydration mismatch); only the `src` VALUE bound to the `mapsEmbedUrl`
  // identifier may differ, via shadowing a renamed module-level constant.
  const iframeMatches = footer.match(/<iframe\b/g);
  assert.equal(iframeMatches?.length, 1, "must render exactly one <iframe>, unconditionally");

  assert.ok(
    footer.includes("const PUBLIC_MAPS_EMBED_SRC ="),
    "the always-on embed URL must live in a renamed module-level constant",
  );
  assert.ok(
    footer.includes(
      "const mapsEmbedUrl = disableExternalEmbedsForE2e\n    ? undefined\n    : PUBLIC_MAPS_EMBED_SRC;",
    ),
    "must shadow `mapsEmbedUrl` locally so the JSX keeps its ordinary src={mapsEmbedUrl} shape",
  );
  assert.ok(footer.includes("src={mapsEmbedUrl}"));
  assert.ok(
    footer.includes(
      'data-e2e-external-embed-disabled={\n                  disableExternalEmbedsForE2e ? "true" : undefined\n                }',
    ),
    "must mark the disabled state via an attribute, not via a different element",
  );

  // The external "Ver ubicación en Maps" control must stay outside the
  // conditional that hides the iframe — it never depends on the E2E flag.
  const controlBlockStart = footer.indexOf(
    "<PublicExternalControl\n                href={mapsLocationUrl}",
  );
  assert.ok(controlBlockStart > 0, "must find the maps external control block");
  const controlBlockEnd = footer.indexOf(
    "</PublicExternalControl>",
    controlBlockStart,
  );
  const controlBlock = footer.slice(controlBlockStart, controlBlockEnd);
  assert.equal(
    controlBlock.includes("disableExternalEmbedsForE2e"),
    false,
    "the external Maps link control must not be conditioned on the E2E embed flag",
  );
  assert.ok(controlBlock.includes("Ver ubicación en Maps"));
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
