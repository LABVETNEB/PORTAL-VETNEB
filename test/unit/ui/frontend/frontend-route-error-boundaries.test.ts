import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

// PR-NAV-01 (D-01): the App Router error boundaries. The runtime half (a
// truncated router payload recovers through "Reintentar") is
// frontend/e2e/platform/app-shell/navigation-truncated-stream-recovery.spec.ts.

const BOUNDARIES = [
  { path: "frontend/src/app/error.tsx", marker: 'data-route-error-boundary="app"' },
  { path: "frontend/src/app/dashboard/error.tsx", marker: 'data-route-error-boundary="dashboard"' },
  { path: "frontend/src/app/global-error.tsx", marker: 'data-route-error-boundary="global"' },
] as const;

test("each boundary is a client component that recovers through Next's retry()", () => {
  for (const { path, marker } of BOUNDARIES) {
    const source = read(path);

    assert.ok(source.startsWith('"use client";'), `${path}: error boundaries must be client components`);
    assert.match(source, /export default function \w+\(\{ retry \}: \{ error: Error & \{ digest\?: string \}; retry: \(\) => void \}\)/, path);
    assert.ok(source.includes("onClick={() => retry()}"), `${path}: "Reintentar" must call retry()`);
    assert.ok(source.includes("Reintentar"), path);
    assert.ok(source.includes('role="alert"'), path);
    assert.equal(source.split(marker).length - 1, 1, `${path}: exactly one ${marker}`);
  }
});

test("no boundary renders, logs or forwards the error's internal detail", () => {
  for (const { path } of BOUNDARIES) {
    const source = read(path);

    for (const leak of ["error.message", "error.digest", "error.stack", "{error}", "console.", "JSON.stringify"]) {
      assert.equal(source.includes(leak), false, `${path}: must not use ${leak}`);
    }
  }
});

test("recovery is Next's retry(), never a hand-rolled reload or navigation", () => {
  for (const { path } of BOUNDARIES) {
    const source = read(path);

    for (const forbidden of ["window.location", "location.reload", "router.refresh", "useRouter", "reset()"]) {
      assert.equal(source.includes(forbidden), false, `${path}: must not use ${forbidden}`);
    }
  }
});

test("global-error owns its document; the other boundaries replace a page and bring its <main>", () => {
  const globalError = read("frontend/src/app/global-error.tsx");
  assert.ok(globalError.includes('<html lang="es">'));
  assert.ok(globalError.includes("<body"));

  for (const path of ["frontend/src/app/error.tsx", "frontend/src/app/dashboard/error.tsx"]) {
    const source = read(path);
    assert.equal(source.includes("<html"), false, path);
    assert.equal(source.includes("<body"), false, path);
    assert.equal(source.split("<main").length - 1, 1, `${path}: the page it replaces owned <main>`);
  }
});

test("PR-NAV-01 adds no loading boundary (DT-4: it would change when the url commits)", () => {
  for (const path of ["frontend/src/app/loading.tsx", "frontend/src/app/dashboard/loading.tsx"]) {
    assert.equal(existsSync(resolve(process.cwd(), path)), false, path);
  }
});
