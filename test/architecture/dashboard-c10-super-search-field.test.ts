import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile } from "../helpers/tracked-source-files.ts";

test("C10: el campo se publica en filters y no posee búsquedas de dominio", () => {
  const source = readSourceFile("frontend/src/features/dashboard/presentation/filters/SuperSearchField.tsx");
  const barrel = readSourceFile("frontend/src/features/dashboard/presentation/filters/index.ts");
  assert.match(barrel, /SuperSearchField/);
  assert.match(source, /value: string/);
  assert.match(source, /onValueChange: \(value: string\) => void/);
  assert.doesNotMatch(source, /@\/lib\/api|router\.|fetch\(|setTimeout\(|debounce/i);
});

test("V10: el campo es la píldora Drive de 48/24/16 con tokens propios y relleno #e9eef6 sólo en claro", () => {
  const source = readSourceFile("frontend/src/features/dashboard/presentation/filters/SuperSearchField.tsx");
  const tokens = readSourceFile("frontend/src/styles/dashboard/tokens.css");
  const block = tokens.slice(tokens.indexOf("dashboard-drv-v10-supersearch:start"), tokens.indexOf("dashboard-drv-v10-supersearch:end"));
  assert.match(block, /--dash-supersearch-h: 48px;/);
  assert.match(block, /--dash-supersearch-radius: 24px;/);
  assert.match(block, /--dash-supersearch-font: 16px;/);
  assert.match(block, /:root:not\(\[data-theme="dark-gray"\]\) \.dashboard-app-shell \{\s*--dash-supersearch-fill: #e9eef6;/);
  assert.match(block, /--dash-supersearch-fill: hsl\(var\(--muted\)\);/);
  assert.match(source, /h-\[var\(--dash-supersearch-h,48px\)\]/);
  assert.match(source, /rounded-\[var\(--dash-supersearch-radius,24px\)\]/);
  assert.doesNotMatch(source, /dash-drv-search/, "no acoplado al buscador del encabezado V6");
  assert.doesNotMatch(source, /h-10|rounded-\[20px\]|text-sm/);
});
