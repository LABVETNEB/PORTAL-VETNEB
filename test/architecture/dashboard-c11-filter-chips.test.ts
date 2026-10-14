import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile } from "../helpers/tracked-source-files.ts";

const DIR = "frontend/src/features/dashboard/presentation/filters";
const FILES = ["FilterChip.tsx", "FilterOverflow.tsx", "ActiveFilterChips.tsx", "index.ts"] as const;
type Sources = Record<(typeof FILES)[number], string>;

function violations(source: Sources): string[] {
  const found: string[] = [];
  const primitives = source["FilterChip.tsx"] + source["FilterOverflow.tsx"] + source["ActiveFilterChips.tsx"];
  for (const name of ["FilterChip", "FilterOverflow", "ActiveFilterChips", "type ActiveFilter"]) {
    if (!source["index.ts"].includes(name)) found.push(`barrel sin ${name}`);
  }
  if (/@\/lib\/api|router\.|fetch\(|useSearchParams|URLSearchParams|setTimeout\(|debounce|localStorage/i.test(primitives)) found.push("dominio, URL o temporizador en la presentación");
  if (!/import \{[^}]*\bActionMenu\b[^}]*\} from "\.\.\/surfaces\/ActionMenu"/.test(source["FilterOverflow.tsx"])) found.push("overflow fuera del owner C08");
  if (/createPortal|role="menu"|role="menuitem"/.test(primitives)) found.push("segunda superficie de menú");
  if (/useState(<[^>]*>)?\(\s*(props\.)?filters\b/.test(primitives)) found.push("copia del estado de filtros");
  const chip = source["FilterChip.tsx"];
  for (const token of ["h-11 md:h-8", "min-w-24", "max-w-40", "px-3", "rounded-lg", "border-input", "font-medium", "text-[0.8125rem]"]) {
    if (!chip.includes(token)) found.push(`chip sin ${token} (§46)`);
  }
  if (/shadow-(?!none)/.test(chip)) found.push("chip con sombra");
  if (!/onRemove\?: \(\) => void/.test(chip) || !/onClearAll\?: \(\) => void/.test(source["ActiveFilterChips.tsx"])) found.push("callbacks no tipados u obligatorios");
  return found;
}

const current = Object.fromEntries(FILES.map((file) => [file, readSourceFile(`${DIR}/${file}`)])) as Sources;

test("C11: primitivas de filtro presentacionales sobre el owner C08", () => {
  assert.deepEqual(violations(current), []);
});

test("C11: el guard detecta cada regresión causal (mutation proof)", () => {
  const mutations: [keyof Sources, string | RegExp, string, string][] = [
    ["index.ts", /^export \{ FilterOverflow\b.*\n/m, "", "barrel sin FilterOverflow"],
    ["FilterOverflow.tsx", '"../surfaces/ActionMenu"', '"./OwnMenu"', "overflow fuera del owner C08"],
    ["ActiveFilterChips.tsx", "export function", 'const leak = useSearchParams();\nexport function', "dominio, URL o temporizador en la presentación"],
    ["FilterOverflow.tsx", "export function", 'const s = <div role="menu" />;\nexport function', "segunda superficie de menú"],
    ["ActiveFilterChips.tsx", "export function", "const copy = useState(filters);\nexport function", "copia del estado de filtros"],
    ["FilterChip.tsx", "rounded-lg", "rounded-full", "chip sin rounded-lg (§46)"],
    ["FilterChip.tsx", "max-w-40", "max-w-40 shadow-md", "chip con sombra"],
  ];
  for (const [file, from, to, expected] of mutations) {
    const mutated = { ...current, [file]: current[file].replace(from, to) };
    assert.notEqual(mutated[file], current[file], `la mutación ${expected} debe aplicar`);
    assert.ok(violations(mutated).includes(expected), expected);
  }
});
