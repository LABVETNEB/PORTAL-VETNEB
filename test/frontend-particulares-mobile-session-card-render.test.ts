import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PARTICULARES_CONTENT_PATH =
  "frontend/src/components/public/ParticularesContent.tsx";
const GLOBALS_CSS_PATH = "frontend/src/app/globals.css";
const PUBLIC_SURFACE_AUDIT_SCRIPT_PATH =
  "scripts/security/audit-public-devtools-surface.mjs";

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

test("particulares active session exposes stable mobile render selectors", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(
    source.includes('data-particular-session-panel={session ? "true" : undefined}'),
    "active particular session panel must expose a scoped data selector",
  );
  assert.ok(
    source.includes('data-particular-session-summary="true"'),
    "case summary must expose a stable data selector",
  );

  const fieldSelectorCount = (
    source.match(/data-particular-session-field="true"/g) ?? []
  ).length;

  assert.equal(
    fieldSelectorCount,
    6,
    "case summary must expose one stable data selector per visible field card",
  );

  assert.ok(
    source.includes('className="particular-notifications-bell-layer shrink-0"'),
    "particular notifications bell must sit in a stable mobile layer",
  );
  assert.ok(
    source.includes("particular-notifications-bell-placeholder"),
    "particular notifications bell placeholder must be targetable by the mobile render fix",
  );
});

test("particulares active session keeps visible case fields and notification anchors", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  for (const label of [
    "Tutor",
    "Mascota",
    "Especie",
    "Raza",
    "Extracción",
    "Envío",
  ]) {
    assert.ok(source.includes(label), `must keep visible field: ${label}`);
  }

  assert.ok(
    source.includes('id="particular-study-tracking"'),
    "study tracking anchor must remain available for notifications",
  );
  assert.ok(
    source.includes('id="particular-report"'),
    "linked report anchor must remain available for notifications",
  );
});

test("globals css contains mobile-only render fix for particular session selectors", () => {
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
  assert.ok(block.includes('[data-particular-session-panel="true"]'));
  assert.ok(block.includes('[data-particular-session-summary="true"]'));
  assert.ok(block.includes('[data-particular-session-field="true"]'));

  for (const declaration of [
    "backdrop-filter: none !important;",
    "-webkit-backdrop-filter: none !important;",
    "filter: none !important;",
    "transform: none !important;",
    "will-change: auto !important;",
    "backface-visibility: visible;",
    "perspective: none;",
    "mix-blend-mode: normal;",
    "text-shadow: none;",
  ]) {
    assert.ok(
      block.includes(declaration),
      `mobile particular render fix must include: ${declaration}`,
    );
  }

  const panelRule = extractCssRule(
    block,
    '[data-particular-session-panel="true"]',
  );
  const summaryRule = extractCssRule(
    block,
    '[data-particular-session-summary="true"]',
  );
  const fieldRule = extractCssRule(
    block,
    '[data-particular-session-field="true"]',
  );

  assert.ok(panelRule.includes("contain: layout;"));
  assert.ok(panelRule.includes("background: hsl(var(--card)) !important;"));
  assert.ok(panelRule.includes("background-image: none !important;"));
  assert.ok(summaryRule.includes("contain: layout paint;"));
  assert.ok(summaryRule.includes("background: hsl(var(--card)) !important;"));
  assert.ok(summaryRule.includes("background-image: none !important;"));
  assert.ok(fieldRule.includes("contain: layout paint;"));
  assert.ok(
    fieldRule.includes("background: hsl(var(--vetneb-surface-raised)) !important;"),
    "field cards should use an opaque raised surface on mobile",
  );
  assert.ok(fieldRule.includes("background-image: none !important;"));
});

test("globals css keeps particular session fix scoped and avoids global surface-soft override", () => {
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
    /\[data-particular-session-(?:panel|summary|field)="true"\]/g,
  )) {
    const index = match.index ?? -1;

    assert.ok(
      index >= blockStart && index < blockEnd,
      "particular session CSS selectors must stay inside the mobile-only block",
    );
  }
});

test("public surface auditor allowlists only the required particular presentation attributes", () => {
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
