import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile } from "../helpers/tracked-source-files.ts";

const path = "frontend/src/features/dashboard/presentation/details";
type Sources = Record<string, string>;

// The barrel is the single source of the primitive set; every module it re-exports is scanned.
const barrelModules = (barrel: string) => [...barrel.matchAll(/^export \{ [^}]+ \} from "\.\/(\w+)";$/gm)].map((match) => match[1]);
const primitiveFiles = (sources: Sources) => Object.keys(sources).filter((file) => file !== "index.ts");

const readPrimitives = (): Sources => {
  const barrel = readSourceFile(`${path}/index.ts`);
  return Object.fromEntries([["index.ts", barrel], ...barrelModules(barrel).map((name) => [`${name}.tsx`, readSourceFile(`${path}/${name}.tsx`)])]);
};

function violations(sources: Sources): string[] {
  const found: string[] = [];
  for (const name of ["DetailsPane", "DetailsHeader", "DetailsTabs", "DetailsMetadata", "DetailsEmptyState"]) {
    if (!new RegExp(`export \\{ ${name}, [^}]*\\btype ${name}Props \\} from "\\./${name}";`).test(sources["index.ts"])) found.push(`export ausente: ${name}`);
    if (sources[`${name}.tsx`] === undefined) found.push(`módulo no publicado por el barrel: ${name}`);
  }
  for (const file of primitiveFiles(sources)) {
    const source = sources[file];
    if (/fetch\(|@\/lib\/api|@\/app\/|router\.|useRouter|useSearchParams|URLSearchParams|history\.|localStorage|sessionStorage|setTimeout\(|setInterval\(/.test(source)) found.push(`dominio, red o URL en ${file}`);
    if (/useState\(|useReducer\(/.test(source)) found.push(`estado propio en ${file}`);
    if (/\boverflow-(?:auto|scroll|y-auto|y-scroll|x-auto|hidden)\b|overflow:|--dash-utility-panel-w|\bw-\[|inline-size|<aside|UtilitySidePanel|createPortal|react-dialog|resize/i.test(source)) found.push(`owner de layout o scroll en ${file}`);
    if (/\btruncate\b|line-clamp-|whitespace-nowrap|text-overflow/.test(source)) found.push(`gramática que oculta valores en ${file}`);
  }
  const tabs = sources["DetailsTabs.tsx"] ?? "";
  for (const contract of ["activeId: string", "onActiveIdChange: (id: string) => void", 'role="tablist"', 'role="tab"', 'role="tabpanel"', "aria-controls=", "aria-labelledby=", "aria-selected=", "disabled?: boolean"]) {
    if (!tabs.includes(contract)) found.push(`contrato de tabs ausente: ${contract}`);
  }
  if (!/NAVIGATION_KEYS = \["ArrowRight", "ArrowLeft", "Home", "End"\];/.test(tabs)) found.push("contrato de tabs ausente: teclas ArrowRight, ArrowLeft, Home y End");
  if (!/tabIndex=\{[^}]*\? 0 : -1\}/.test(tabs)) found.push("roving tabindex ausente");
  if (!tabs.includes("dashboard-module-tablist") || !tabs.includes("dashboard-module-tab ")) found.push("gramática de tabs existente no reutilizada");
  const metadata = sources["DetailsMetadata.tsx"] ?? "";
  if (!metadata.includes("<dl") || !metadata.includes("<dt") || !metadata.includes("<dd")) found.push("metadatos sin lista de descripción");
  if (!metadata.includes("dashboard-detail-value")) found.push("metadatos sin gramática de valor íntegro");
  if (!metadata.includes("missingLabel")) found.push("metadatos sin representación de ausencia");
  if (!(sources["DetailsEmptyState.tsx"] ?? "").includes('from "@/components/dashboard/EmptyState"')) found.push("estado vacío no reutiliza CollectionState");
  const pane = sources["DetailsPane.tsx"] ?? "";
  if (!pane.includes("<section") || !pane.includes("aria-label={label}")) found.push("panel sin nombre accesible");
  const header = sources["DetailsHeader.tsx"] ?? "";
  if (!header.includes("headingLevel") || !header.includes("dashboard-detail-value")) found.push("encabezado sin nivel controlado o sin valor íntegro");
  return found;
}

test("C13: primitivas de detalle controladas, sin dominio ni owner de layout", () => {
  assert.deepEqual(violations(readPrimitives()), []);
});

test("C13: mutation proof del contrato de arquitectura", () => {
  const sources = readPrimitives();
  const mutations: [keyof Sources, string, string, string][] = [
    ["index.ts", "export { DetailsTabs, type DetailsTab,", "export { type DetailsTab,", "export ausente: DetailsTabs"],
    ["DetailsPane.tsx", "export function DetailsPane", "const leak = () => fetch('/api');\nexport function DetailsPane", "dominio, red o URL en DetailsPane.tsx"],
    ["DetailsTabs.tsx", "export function DetailsTabs", "const [own] = useState(null);\nexport function DetailsTabs", "estado propio en DetailsTabs.tsx"],
    ["DetailsPane.tsx", 'data-details-pane="true"', 'data-details-pane="true" className="overflow-y-auto"', "owner de layout o scroll en DetailsPane.tsx"],
    ["DetailsMetadata.tsx", "dashboard-detail-value", "truncate", "metadatos sin gramática de valor íntegro"],
    ["DetailsTabs.tsx", '["ArrowRight", "ArrowLeft", "Home", "End"]', "([] as string[])", "contrato de tabs ausente: teclas ArrowRight, ArrowLeft, Home y End"],
    ["DetailsTabs.tsx", 'role="tabpanel"', 'data-role="panel"', 'contrato de tabs ausente: role="tabpanel"'],
    ["DetailsEmptyState.tsx", 'from "@/components/dashboard/EmptyState"', 'from "./OwnEmptyState"', "estado vacío no reutiliza CollectionState"],
    ["DetailsPane.tsx", "aria-label={label}", "data-label={label}", "panel sin nombre accesible"],
  ];
  for (const [file, before, after, expected] of mutations) {
    const changed = sources[file].replace(before, after);
    assert.notEqual(changed, sources[file], `mutación no aplicada: ${expected}`);
    assert.ok(violations({ ...sources, [file]: changed }).includes(expected), `mutación no detectada: ${expected}`);
  }
  const { ["DetailsMetadata.tsx"]: _unpublished, ...withoutMetadata } = sources;
  assert.ok(violations(withoutMetadata).includes("módulo no publicado por el barrel: DetailsMetadata"), "un módulo fuera del barrel debe detectarse");
  assert.deepEqual(barrelModules(sources["index.ts"]), ["DetailsPane", "DetailsHeader", "DetailsTabs", "DetailsMetadata", "DetailsEmptyState"], "el barrel publica las cinco primitivas");
});
