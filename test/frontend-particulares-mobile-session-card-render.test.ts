import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const PARTICULARES_CONTENT_PATH =
  "frontend/src/components/public/ParticularesContent.tsx";
const GLOBALS_CSS_PATH = "frontend/src/app/globals.css";
const PUBLIC_SURFACE_AUDIT_SCRIPT_PATH =
  "scripts/security/audit-public-devtools-surface.mjs";
const NAVBAR_PATH = "frontend/src/components/layout/Navbar.tsx";
const FOOTER_PATH = "frontend/src/components/layout/Footer.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function extractMarkedBlock(
  source: string,
  startMarker: string,
  endMarker: string,
): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);

  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  assert.ok(end > start, "marked CSS block must close after it opens");

  return source.slice(start, end + endMarker.length);
}

function extractCssRule(source: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)\\s*${escapedSelector}\\s*\\{`).exec(
    source,
  );
  const start = match?.index ?? -1;

  assert.notEqual(start, -1, `missing CSS rule: ${selector}`);

  const end = source.indexOf("}", start);
  assert.notEqual(end, -1, `missing CSS rule close: ${selector}`);

  return source.slice(start, end + 1);
}

function extractMobileSafeSummary(source: string): string {
  const attributeIndex = source.indexOf(
    'data-particular-mobile-safe-summary="true"',
  );
  assert.notEqual(attributeIndex, -1, "missing mobile-safe summary attribute");

  const start = source.lastIndexOf("<div", attributeIndex);
  const desktopAttributeIndex = source.indexOf(
    'data-particular-session-summary="true"',
    attributeIndex,
  );
  assert.notEqual(
    desktopAttributeIndex,
    -1,
    "missing desktop session summary attribute",
  );

  const end = source.lastIndexOf("<div", desktopAttributeIndex);
  assert.ok(start > -1 && end > start, "mobile-safe summary block bounds");

  return source.slice(start, end);
}

function extractDesktopSummary(source: string): string {
  const attributeIndex = source.indexOf(
    'data-particular-session-summary="true"',
  );
  assert.notEqual(attributeIndex, -1, "missing desktop session summary");

  const start = source.lastIndexOf("<div", attributeIndex);
  const end = source.indexOf('id="particular-study-tracking"', attributeIndex);
  assert.ok(start > -1 && end > start, "desktop summary block bounds");

  return source.slice(start, end);
}

function listFiles(relativeRoot: string): string[] {
  const absoluteRoot = resolve(process.cwd(), relativeRoot);
  const files: string[] = [];

  function walk(absolutePath: string) {
    for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
      const child = join(absolutePath, entry.name);
      if (entry.isDirectory()) {
        walk(child);
        continue;
      }

      if (statSync(child).isFile()) {
        files.push(child);
      }
    }
  }

  walk(absoluteRoot);
  return files;
}

test("particulares active session renders a single mobile-safe case summary", () => {
  const source = read(PARTICULARES_CONTENT_PATH);
  const mobileSummary = extractMobileSafeSummary(source);

  assert.ok(
    mobileSummary.includes('data-particular-mobile-safe-summary="true"'),
    "mobile case summary must expose the requested stable data selector",
  );
  assert.match(
    mobileSummary,
    /className="[^"]*\bsm:hidden\b[^"]*"/,
    "mobile-safe summary must be the only summary visible below sm",
  );

  const fieldSelectorCount = (
    mobileSummary.match(/data-particular-mobile-safe-field="true"/g) ?? []
  ).length;

  assert.equal(
    fieldSelectorCount,
    6,
    "mobile-safe case summary must expose one field per visible data point",
  );

  for (const label of [
    "Tutor",
    "Mascota",
    "Especie",
    "Raza",
    "Extracción",
    "Envío",
  ]) {
    assert.ok(mobileSummary.includes(label), `must keep mobile field: ${label}`);
  }
});

test("mobile-safe summary avoids GPU-heavy presentation primitives", () => {
  const source = read(PARTICULARES_CONTENT_PATH);
  const mobileSummary = extractMobileSafeSummary(source);

  for (const forbidden of [
    "PremiumPanel",
    "VisualIcon",
    "render-gpu-soft",
    "surface-soft",
    "backdrop-blur",
    "transform-gpu",
    "bg-card/",
  ]) {
    assert.equal(
      mobileSummary.includes(forbidden),
      false,
      `mobile-safe summary must not contain ${forbidden}`,
    );
  }
});

test("desktop summary remains available from sm and is hidden on mobile", () => {
  const source = read(PARTICULARES_CONTENT_PATH);
  const desktopSummary = extractDesktopSummary(source);

  assert.match(
    desktopSummary,
    /className="[^"]*\bhidden\b[^"]*\bsm:block\b[^"]*"/,
    "desktop summary must use display hiding on mobile, not opacity hiding",
  );
  assert.equal(
    /opacity-0|opacity:\s*0/.test(desktopSummary),
    false,
    "desktop summary must not rely on opacity to hide from mobile",
  );

  const desktopFieldSelectorCount = (
    desktopSummary.match(/data-particular-session-field="true"/g) ?? []
  ).length;

  assert.equal(
    desktopFieldSelectorCount,
    6,
    "desktop summary must keep the existing six visible field cards",
  );
});

test("particulares active session keeps tracking, report, notification and logout flows", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  for (const marker of [
    'className="particular-notifications-bell-layer shrink-0"',
    "particular-notifications-bell-placeholder",
    'id="particular-study-tracking"',
    'id="particular-report"',
    "Consultar por WhatsApp",
    "Enviar email",
    "Ver informe",
    "Descargar",
    "Cerrar sesión particular",
  ]) {
    assert.ok(source.includes(marker), `must keep active-session flow: ${marker}`);
  }
});

test("globals css contains mobile-only rules for mobile-safe summary selectors", () => {
  const source = read(GLOBALS_CSS_PATH);
  const block = extractMarkedBlock(
    source,
    "/* particular-session-mobile-render-fix:start */",
    "/* particular-session-mobile-render-fix:end */",
  );

  assert.ok(
    block.includes("@media (max-width: 639px)"),
    "particular session render fix must be mobile-only",
  );
  assert.ok(block.includes('[data-particular-mobile-safe-summary="true"]'));
  assert.ok(block.includes('[data-particular-mobile-safe-field="true"]'));

  const summaryRule = extractCssRule(
    block,
    '[data-particular-mobile-safe-summary="true"]',
  );
  const fieldRule = extractCssRule(
    block,
    '[data-particular-mobile-safe-field="true"]',
  );

  for (const rule of [summaryRule, fieldRule]) {
    for (const declaration of [
      "display: block !important;",
      "position: relative;",
      "z-index: 1;",
      "contain: layout paint style;",
      "isolation: isolate;",
      "overflow: hidden;",
      "background: hsl(var(--card)) !important;",
      "background-image: none !important;",
      "opacity: 1 !important;",
      "filter: none !important;",
      "backdrop-filter: none !important;",
      "-webkit-backdrop-filter: none !important;",
      "transform: none !important;",
      "will-change: auto !important;",
      "mix-blend-mode: normal;",
      "text-shadow: none;",
    ]) {
      assert.ok(
        rule.includes(declaration),
        `mobile-safe CSS rule must include: ${declaration}`,
      );
    }

    assert.doesNotMatch(
      rule,
      /background:\s*hsl\(var\(--card\)\s*\//,
      "mobile-safe backgrounds must stay opaque",
    );
  }

  assert.ok(summaryRule.includes("box-shadow: 0 1px 2px"));
  assert.ok(fieldRule.includes("box-shadow: none !important;"));
});

test("particular mobile render CSS stays scoped and avoids global surface-soft changes", () => {
  const source = read(GLOBALS_CSS_PATH);
  const startMarker = "/* particular-session-mobile-render-fix:start */";
  const endMarker = "/* particular-session-mobile-render-fix:end */";
  const block = extractMarkedBlock(source, startMarker, endMarker);
  const blockStart = source.indexOf(startMarker);
  const blockEnd = source.indexOf(endMarker) + endMarker.length;

  assert.equal(
    /(?:^|\n)\s*\.surface-soft\b/.test(block),
    false,
    "mobile fix must not redefine .surface-soft globally",
  );

  for (const match of source.matchAll(
    /\[data-particular-mobile-safe-(?:summary|field)="true"\]/g,
  )) {
    const index = match.index ?? -1;

    assert.ok(
      index >= blockStart && index < blockEnd,
      "mobile-safe CSS selectors must stay inside the mobile-only block",
    );
  }
});

test("mobile-safe feature markers stay out of Navbar, Footer and backend surfaces", () => {
  const forbiddenMarkers = [
    "data-particular-mobile-safe-summary",
    "data-particular-mobile-safe-field",
    "particular-mobile-safe-summary",
    "particular-mobile-safe-field",
  ];

  for (const filePath of [NAVBAR_PATH, FOOTER_PATH]) {
    const source = read(filePath);
    for (const marker of forbiddenMarkers) {
      assert.equal(
        source.includes(marker),
        false,
        `${filePath} must not include ${marker}`,
      );
    }
  }

  for (const directory of ["server", "drizzle", "shared"]) {
    for (const absolutePath of listFiles(directory)) {
      const source = readFileSync(absolutePath, "utf8");
      for (const marker of forbiddenMarkers) {
        assert.equal(
          source.includes(marker),
          false,
          `${directory} surface must not include ${marker}`,
        );
      }
    }
  }
});

test("public surface auditor keeps exact allowlist for legacy session selectors", () => {
  const source = read(PUBLIC_SURFACE_AUDIT_SCRIPT_PATH);

  assert.ok(
    source.includes("PUBLIC_PRESENTATION_DATA_ATTRIBUTES"),
    "public surface auditor must keep an explicit presentation data attribute allowlist",
  );

  for (const attributeName of [
    "particular-session-panel",
    "particular-session-summary",
    "particular-session-field",
  ]) {
    assert.ok(
      source.includes(`"${attributeName}"`),
      `auditor allowlist must include ${attributeName}`,
    );
  }

  assert.equal(
    source.includes('"particular-session"'),
    false,
    "auditor must not allowlist broad particular session patterns",
  );
});
