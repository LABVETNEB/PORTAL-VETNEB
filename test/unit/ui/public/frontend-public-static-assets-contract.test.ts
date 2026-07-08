import assert from "node:assert/strict";
import { existsSync, statSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import test from "node:test";

const MANIFEST_PATH = "frontend/src/app/manifest.ts";
const SEO_PATH = "frontend/src/lib/seo.ts";

type IconReference = {
  src: string;
  width: number;
  height: number;
  type: string;
  purpose?: string;
};

function assetPath(relativePath: string): string {
  return resolve(process.cwd(), relativePath);
}

function readSource(relativePath: string): string {
  return readFileSync(assetPath(relativePath), "utf8").replace(/\r\n/g, "\n");
}

function readPngDimensions(relativePath: string): {
  width: number;
  height: number;
} {
  const bytes = readFileSync(assetPath(relativePath));

  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    `${relativePath} debe ser un PNG válido`,
  );

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function extractManifestIconReferences(): IconReference[] {
  const source = readSource(MANIFEST_PATH);
  const matches = source.matchAll(
    /\{\s*src:\s*"([^"]+)",\s*sizes:\s*"(\d+)x(\d+)",\s*type:\s*"([^"]+)"(?:,\s*purpose:\s*"([^"]+)")?,?\s*\}/g,
  );

  return [...matches].map((match) => ({
    src: match[1],
    width: Number(match[2]),
    height: Number(match[3]),
    type: match[4],
    purpose: match[5],
  }));
}

function extractSeoIconReferences(): IconReference[] {
  const source = readSource(SEO_PATH);
  const matches = source.matchAll(
    /\{\s*url:\s*"([^"]+)",\s*sizes:\s*"(\d+)x(\d+)",\s*type:\s*"([^"]+)"\s*\}/g,
  );

  return [...matches].map((match) => ({
    src: match[1],
    width: Number(match[2]),
    height: Number(match[3]),
    type: match[4],
  }));
}

function iconWeightLimit(reference: IconReference): number {
  if (reference.src.endsWith("/apple-touch-icon.png")) {
    return 120_000;
  }

  const largestDimension = Math.max(reference.width, reference.height);
  if (largestDimension <= 32) return 40_000;
  if (largestDimension <= 192) return 80_000;
  return 180_000;
}

function assertValidPngReference(reference: IconReference): void {
  assert.ok(reference.src.startsWith("/icons/"), `${reference.src} debe vivir bajo /icons/`);
  assert.equal(reference.type, "image/png", `${reference.src} debe declarar image/png`);
  assert.equal(extname(reference.src), ".png", `${reference.src} debe usar extensión .png`);

  const relativePath = `frontend/public${reference.src}`;
  assert.ok(existsSync(assetPath(relativePath)), `${relativePath} debe existir`);

  const dimensions = readPngDimensions(relativePath);
  assert.deepEqual(
    dimensions,
    { width: reference.width, height: reference.height },
    `${reference.src} debe coincidir con sizes`,
  );
  assert.ok(
    statSync(assetPath(relativePath)).size <= iconWeightLimit(reference),
    `${reference.src} supera el presupuesto de peso`,
  );
}

// ─── PR #908: favicon.ico — evitar 404 en /favicon.ico ───────────────────────

test("frontend/public/favicon.ico exists and is non-empty", () => {
  const p = assetPath("frontend/public/favicon.ico");

  assert.ok(existsSync(p), "favicon.ico debe existir en frontend/public/");
  assert.ok(statSync(p).size > 0, "favicon.ico no debe estar vacío");
  assert.ok(statSync(p).size <= 40_000, "favicon.ico debe pesar como máximo 40 KB");
});

test("frontend/public/favicon.ico has valid ICO magic bytes", () => {
  const p = assetPath("frontend/public/favicon.ico");
  const bytes = readFileSync(p);

  assert.equal(bytes[0], 0x00, "byte 0 debe ser 0x00 (ICO reserved)");
  assert.equal(bytes[1], 0x00, "byte 1 debe ser 0x00 (ICO reserved)");
  assert.equal(bytes[2], 0x01, "byte 2 debe ser 0x01 (ICO type)");
  assert.equal(bytes[3], 0x00, "byte 3 debe ser 0x00 (ICO type hi)");
});

test("manifest icon references exist with coherent dimensions, MIME types, and weights", () => {
  const references = extractManifestIconReferences();

  assert.equal(references.length, 7, "manifest debe declarar cuatro iconos de instalación y tres de atajos");
  for (const reference of references) {
    assertValidPngReference(reference);
  }
});

test("manifest preserves standard and maskable installation icons", () => {
  const installationIcons = extractManifestIconReferences().filter(
    (reference) => reference.purpose !== undefined,
  );
  const standardIcons = installationIcons.filter(
    (reference) => reference.purpose === "any",
  );
  const maskableIcons = installationIcons.filter(
    (reference) => reference.purpose === "maskable",
  );

  assert.equal(installationIcons.length, 4);
  assert.deepEqual(
    standardIcons.map(({ width, height }) => `${width}x${height}`).sort(),
    ["192x192", "512x512"],
  );
  assert.deepEqual(
    maskableIcons.map(({ width, height }) => `${width}x${height}`).sort(),
    ["192x192", "512x512"],
  );
  assert.ok(
    maskableIcons.every((reference) => reference.src.includes("/maskable-icon-")),
    "los iconos maskable deben conservar assets dedicados",
  );
});

test("SEO app icons and Apple touch icon remain valid and lightweight", () => {
  const references = extractSeoIconReferences();

  assert.equal(references.length, 4);
  for (const reference of references) {
    assertValidPngReference(reference);
  }

  assert.deepEqual(
    references.map(({ src, width, height }) => `${src}:${width}x${height}`),
    [
      "/icons/icon-32x32.png:32x32",
      "/icons/icon-192x192.png:192x192",
      "/icons/icon-512x512.png:512x512",
      "/icons/apple-touch-icon.png:180x180",
    ],
  );
});

test("small standalone icon remains valid and lightweight", () => {
  const relativePath = "frontend/public/icons/icon-16x16.png";

  assert.ok(existsSync(assetPath(relativePath)));
  assert.deepEqual(readPngDimensions(relativePath), { width: 16, height: 16 });
  assert.ok(statSync(assetPath(relativePath)).size <= 40_000);
});

test("Next manifest route remains wired to /manifest.webmanifest", () => {
  const manifestSource = readSource(MANIFEST_PATH);
  const seoSource = readSource(SEO_PATH);

  assert.ok(
    manifestSource.includes(
      "export default function manifest(): MetadataRoute.Manifest",
    ),
  );
  assert.ok(seoSource.includes('manifest: "/manifest.webmanifest"'));
});

test("PWA icon budget explicitly excludes the dedicated OpenGraph image", () => {
  const iconPaths = new Set([
    ...extractManifestIconReferences().map((reference) => reference.src),
    ...extractSeoIconReferences().map((reference) => reference.src),
  ]);

  assert.equal(iconPaths.has("/images/og-vetneb.png"), false);
  assert.ok(existsSync(assetPath("frontend/public/images/og-vetneb.png")));
});

test("dedicated OpenGraph source is a reasonably sized 1200x630 PNG", () => {
  const p = assetPath("frontend/public/images/og-vetneb.png");

  assert.ok(existsSync(p), "debe existir el asset OpenGraph dedicado");

  const stats = statSync(p);
  const bytes = readFileSync(p);

  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    "el asset OpenGraph debe ser un PNG válido",
  );
  assert.equal(bytes.readUInt32BE(16), 1200, "el ancho debe ser 1200 px");
  assert.equal(bytes.readUInt32BE(20), 630, "el alto debe ser 630 px");
  assert.ok(stats.size > 50_000, "el asset no debe estar vacío o degradado");
  assert.ok(stats.size < 750_000, "el asset debe conservar un peso razonable");
});
