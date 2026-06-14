import assert from "node:assert/strict";
import { existsSync, statSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function assetPath(relativePath: string): string {
  return resolve(process.cwd(), relativePath);
}

// ─── PR #908: favicon.ico — evitar 404 en /favicon.ico ───────────────────────

test("frontend/public/favicon.ico exists and is non-empty", () => {
  const p = assetPath("frontend/public/favicon.ico");

  assert.ok(existsSync(p), "favicon.ico debe existir en frontend/public/");
  assert.ok(statSync(p).size > 0, "favicon.ico no debe estar vacío");
});

test("frontend/public/favicon.ico has valid ICO magic bytes", () => {
  const p = assetPath("frontend/public/favicon.ico");
  const bytes = readFileSync(p);

  assert.equal(bytes[0], 0x00, "byte 0 debe ser 0x00 (ICO reserved)");
  assert.equal(bytes[1], 0x00, "byte 1 debe ser 0x00 (ICO reserved)");
  assert.equal(bytes[2], 0x01, "byte 2 debe ser 0x01 (ICO type)");
  assert.equal(bytes[3], 0x00, "byte 3 debe ser 0x00 (ICO type hi)");
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
