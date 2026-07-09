import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "drizzle",
  "migrations",
  "0023_pricing_items.sql",
);
const journalPath = resolve(
  process.cwd(),
  "drizzle",
  "migrations",
  "meta",
  "_journal.json",
);
const schemaPath = resolve(process.cwd(), "drizzle", "schema.ts");

function readText(path: string) {
  return readFileSync(path, "utf8");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const INITIAL_STUDIES = [
  "UNA LESIÓN (VARIOS VIDRIOS)",
  "REPETICIÓN (DENTRO DE 15 DÍAS)",
  "LESIÓN ADICIONAL (SOBRE SU VALOR)",
  "MÉDULA ÓSEA",
  "CITOLOGIA VAGINAL (PAP)",
  "ZIEHL-NEELSEN",
  "FROTIS CAPILAR",
  "PIEZAS HASTA 10 CM",
  "PIEZAS MÁS DE 10 CM",
  "DERMATOPATOLOGÍA",
  "LÍNEA MAMARIA COMPLETA",
  "PIEZAS CON HUESO",
  "PIEZA ADICIONAL (SOBRE SU VALOR)",
  "TINCIONES ESPECIALES",
  "URGENTES (ADICIONAL)",
] as const;

test("pricing_items migration exists with expected table columns index and seed", () => {
  assert.ok(existsSync(migrationPath), "missing 0023_pricing_items.sql");

  const source = readText(migrationPath);

  assert.match(source, /CREATE TABLE IF NOT EXISTS "pricing_items"/);
  assert.match(source, /"category" varchar\(80\) NOT NULL/);
  assert.match(source, /"study_name" varchar\(160\) NOT NULL/);
  assert.match(source, /"price_label" varchar\(80\)/);
  assert.match(source, /"display_order" integer NOT NULL/);
  assert.match(source, /"is_active" boolean NOT NULL DEFAULT true/);
  assert.match(source, /"updated_at" timestamp NOT NULL DEFAULT now\(\)/);
  assert.match(source, /pricing_items_active_category_display_order_idx/);

  assert.match(source, /'CITOLOGÍAS'/);
  assert.match(source, /'HISTOPATOLOGÍAS'/);

  for (const studyName of INITIAL_STUDIES) {
    assert.match(
      source,
      new RegExp(escapeRegex(`'${studyName}'`)),
      `migration must include seeded study ${studyName}`,
    );
  }
});

test("pricing_items migration is registered in drizzle journal", () => {
  const journal = JSON.parse(readText(journalPath)) as {
    entries?: Array<{ tag?: string }>;
  };
  const tags = new Set((journal.entries ?? []).map((entry) => entry.tag));

  assert.ok(tags.has("0023_pricing_items"), "journal missing 0023_pricing_items");
});

test("drizzle schema keeps pricing_items table contract", () => {
  const schemaSource = readText(schemaPath);

  assert.match(schemaSource, /pgTable\(\s*"pricing_items"/);
  assert.match(schemaSource, /studyName:\s+varchar\("study_name"/);
  assert.match(schemaSource, /priceLabel:\s+varchar\("price_label"/);
  assert.match(schemaSource, /displayOrder:\s+integer\("display_order"\)/);
  assert.match(schemaSource, /isActive:\s+boolean\("is_active"\)/);
});
