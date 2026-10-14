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
