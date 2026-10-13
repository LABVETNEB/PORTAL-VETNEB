import assert from "node:assert/strict";
import test from "node:test";
import { listTrackedFiles, readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

// PR-NAV-01 (D-01): the App Router error boundaries. The runtime half (a
// truncated router payload recovers through "Reintentar") is
// frontend/e2e/platform/app-shell/navigation-truncated-stream-recovery.spec.ts.

const BOUNDARIES = [
  { path: "frontend/src/app/error.tsx", marker: 'data-route-error-boundary="app"' },
  { path: "frontend/src/app/dashboard/error.tsx", marker: 'data-route-error-boundary="dashboard"' },
  { path: "frontend/src/app/global-error.tsx", marker: 'data-route-error-boundary="global"' },
] as const;

const DASHBOARD_BOUNDARY = "frontend/src/app/dashboard/error.tsx";

// PR-NAV-03 (hoja de ruta FSM §12.1, C-6): the dashboard boundary is the only
// producer of NAV_FAILED and RESET. FAILED lasts exactly as long as it is
// mounted, because Next also drops it without retry() when the pathname changes.
test("the dashboard boundary reports its mount and its exit to the navigation owner", () => {
  const source = read(DASHBOARD_BOUNDARY);

  assert.ok(source.includes("const navigation = useDashboardNavigationBoundary();"));
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*if \(navigation === null\) return undefined;\s*navigation\.failed\(\);\s*return \(\) => navigation\.left\(\);\s*\}, \[navigation\]\);/,
    "NAV_FAILED on mount and RESET on cleanup, in a passive effect, and nothing without an owner",
  );
  assert.equal(source.includes("useLayoutEffect"), false, "the boundary's events are dispatched in passive effects");

  const provider = read("frontend/src/components/dashboard/DashboardNavigationProvider.tsx");
  assert.ok(provider.includes('failed: () => store.dispatch({ type: "NAV_FAILED", reason: "unknown" }),'));
  assert.ok(
    provider.includes('left: () => store.dispatch({ type: "RESET", location: store.getSnapshot().delivered }),'),
    "RESET carries the committed location as the provider last delivered it",
  );
  const signals = provider.slice(provider.indexOf("export function useDashboardNavigationBoundary("));
  assert.match(
    signals,
    /const store = source\?\.store \?\? null;\s*return useMemo\(\s*\(\) =>\s*store === null\s*\? null/,
    "no owner outside /dashboard/admin: the shared boundary dispatches nothing from a clinic route",
  );
  assert.ok(
    provider.includes("const slot = isAdmin ? (held ?? createAdminStoreSlot()) : null;") &&
      provider.includes("slot === null ? null : { store: slot.resolve(router, location, explicit), location }"),
    "a store exists on the admin route only",
  );
  assert.ok(signals.includes("[store],"), "the signals are stable per owner: the boundary's effect runs once per mount");
});

test("each boundary is a client component that recovers through Next's retry()", () => {
  for (const { path, marker } of BOUNDARIES) {
    const source = read(path);

    assert.ok(source.startsWith('"use client";'), `${path}: error boundaries must be client components`);
    assert.match(source, /export default function \w+\(\{ retry \}: \{ error: Error & \{ digest\?: string \}; retry: \(\) => void \}\)/, path);
    if (path === DASHBOARD_BOUNDARY) {
      // PR-NAV-03: the navigation owner is told the boundary is leaving, and
      // only then does Next retry. Recovery is still retry() and nothing else.
      assert.match(
        source,
        /onClick=\{\(\) => \{\s*navigation\?\.left\(\);\s*retry\(\);\s*\}\}/,
        `${path}: "Reintentar" must tell the navigation owner and then call retry()`,
      );
      assert.equal(source.split("retry();").length - 1, 1, `${path}: retry() is called from "Reintentar" only`);
    } else {
      assert.ok(source.includes("onClick={() => retry()}"), `${path}: "Reintentar" must call retry()`);
    }
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
  const tracked = listTrackedFiles();
  for (const path of ["frontend/src/app/loading.tsx", "frontend/src/app/dashboard/loading.tsx"]) {
    assert.equal(tracked.includes(path), false, path);
  }
});
