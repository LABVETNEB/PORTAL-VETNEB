import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile } from "../helpers/tracked-source-files.ts";

const path = "frontend/src/features/dashboard/presentation/filters";
const read = (file: string) => readSourceFile(`${path}/${file}`);

function violations(component: string, barrel: string): string[] {
  const found: string[] = [];
  if (!barrel.includes("export { AdvancedFilterSheet,")) found.push("export ausente");
  if (!component.includes('from "@radix-ui/react-dialog"')) found.push("sin Dialog accesible");
  for (const contract of ["open: boolean", "onOpenChange: (open: boolean) => void", "children: ReactNode", "onApply: () => void", "onClear: () => void", "onCancel: () => void"]) {
    if (!component.includes(contract)) found.push(`contrato ausente: ${contract}`);
  }
  if (/fetch\(|router\.|useSearchParams|URLSearchParams|localStorage|setTimeout\(|useState\([^)]*filter/i.test(component)) found.push("autoridad de filtros o navegación duplicada");
  if (/createPortal|role="dialog"|onKeyDown=.*Escape/.test(component)) found.push("infraestructura modal duplicada");
  if (!component.includes("onOpenAutoFocus=") || !component.includes("onCloseAutoFocus=")) found.push("transferencia de foco ausente");
  if (!component.includes("overflow-y-auto overscroll-contain")) found.push("scroll interno ausente");
  return found;
}

test("C12: sheet controlado sobre Radix, sin autoridad de filtros", () => {
  assert.deepEqual(violations(read("AdvancedFilterSheet.tsx"), read("index.ts")), []);
});

test("C12: mutation proof del contrato de arquitectura", () => {
  const component = read("AdvancedFilterSheet.tsx");
  const barrel = read("index.ts");
  const mutations: [string, string, string][] = [
    ['from "@radix-ui/react-dialog"', 'from "./OwnDialog"', "sin Dialog accesible"],
    ["onApply: () => void", "onApply?: () => void", "contrato ausente: onApply: () => void"],
    ["export function AdvancedFilterSheet", "const leak = fetch('/api');\nexport function AdvancedFilterSheet", "autoridad de filtros o navegación duplicada"],
    ["onCloseAutoFocus=", "onNoCloseAutoFocus=", "transferencia de foco ausente"],
    ["overflow-y-auto overscroll-contain", "overflow-hidden", "scroll interno ausente"],
  ];
  for (const [before, after, expected] of mutations) {
    const changed = component.replace(before, after);
    assert.notEqual(changed, component, `mutación no aplicada: ${expected}`);
    assert.ok(violations(changed, barrel).includes(expected));
  }
  assert.ok(violations(component, barrel.replace("AdvancedFilterSheet", "RemovedSheet")).includes("export ausente"));
});
