import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const root = new URL("../../frontend/src/features/dashboard/presentation/filters/", import.meta.url);

test("C10: el campo se publica en filters y no posee búsquedas de dominio", () => {
  const source = readFileSync(new URL("SuperSearchField.tsx", root), "utf8");
  const barrel = readFileSync(new URL("index.ts", root), "utf8");
  assert.match(barrel, /SuperSearchField/);
  assert.match(source, /value: string/);
  assert.match(source, /onValueChange: \(value: string\) => void/);
  assert.doesNotMatch(source, /@\/lib\/api|router\.|fetch\(|setTimeout\(|debounce/i);
});
