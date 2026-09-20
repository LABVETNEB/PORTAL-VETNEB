import { expect, test } from "@playwright/test";

// LIMPIEZA E2E §6.2/§21 — the PWA surface a browser can actually observe under
// the required harness: /offline as a public page, and the manifest and the
// service worker script as served responses carrying their real headers. The
// header assertions read the response, never `next.config.ts`.
//
// Deliberately NOT proven here: register -> install -> activate -> precache ->
// offline navigation fallback. `PwaServiceWorkerRegistrar` gates registration
// on `window.location.protocol === "https:"`, and the required runner serves
// the app over plain HTTP on loopback, so the product never registers the
// worker in this harness. Calling `navigator.serviceWorker.register()` from
// the test would exercise `sw.js` while proving nothing about the product
// wiring, so it is not done. That lifecycle is an accepted DEFER whose owner
// is the Frontend / QA owner; the privacy and cache invariants of `sw.js`
// stay covered fail-closed by the static contracts in `pnpm test`.

const OFFLINE_PATH = "/offline";
const MANIFEST_PATH = "/manifest.webmanifest";
const SERVICE_WORKER_PATH = "/sw.js";
const SERVICE_WORKER_CACHE_DIRECTIVES = ["no-cache", "no-store", "must-revalidate"] as const;

type ManifestIcon = { readonly purpose?: unknown };
type WebManifest = {
  readonly start_url?: unknown;
  readonly scope?: unknown;
  readonly display?: unknown;
  readonly icons?: readonly ManifestIcon[];
};

test.describe("offline public page", () => {
  test("resolves as a usable public page", async ({ page }) => {
    const response = await page.goto(OFFLINE_PATH);

    expect(response?.ok(), `${OFFLINE_PATH} should return a successful response`).toBeTruthy();

    const heading = page.locator("h1#offline-heading");
    await expect(heading).toBeVisible();
    await expect(heading).not.toBeEmpty();
    await expect(page.locator('section[aria-labelledby="offline-heading"]')).toBeVisible();

    const retry = page.getByRole("button", { name: /reintentar/i });
    const home = page.getByRole("button", { name: /volver al inicio/i });

    await expect(retry).toBeVisible();
    await expect(retry).toBeEnabled();
    await expect(home).toBeVisible();

    // Both controls live in the same OfflineActions client commit, so the ref
    // marker the route control sets when React adopts its own node is also the
    // point where the retry handler is attached. Gating on it is what keeps the
    // clicks below from being swallowed pre-hydration.
    await expect(home).toHaveAttribute("data-public-route-control-hydrated", "true");

    // Retry calls window.location.reload(), so the proof it is wired is a new
    // document navigation to /offline, not the URL: the URL is already /offline
    // and would still match if the click did nothing.
    const retryNavigation = page.waitForResponse(
      (candidate) =>
        candidate.request().isNavigationRequest() &&
        new URL(candidate.url()).pathname === OFFLINE_PATH,
    );

    await retry.click();

    const retryResponse = await retryNavigation;
    expect(retryResponse.ok(), "the retry control must reload /offline").toBeTruthy();
    await expect(heading).toBeVisible();

    // The home control pushes through the router, which is a soft navigation:
    // no document response to await, so the settled pathname is the signal.
    await expect(home).toBeEnabled();
    await expect(home).toHaveAttribute("data-public-route-control-hydrated", "true");
    await home.click();
    await expect(page).toHaveURL((url) => url.pathname === "/");
  });

  test("is excluded from search indexing", async ({ page }) => {
    await page.goto(OFFLINE_PATH);

    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveCount(1);

    const directives = (await robots.getAttribute("content")) ?? "";
    expect(directives).toMatch(/noindex/i);
    expect(directives).toMatch(/nofollow/i);
  });
});

test.describe("served PWA surface", () => {
  test("serves an installable web app manifest", async ({ request }) => {
    const response = await request.get(MANIFEST_PATH);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/manifest\+json|application\/json/);

    const manifest = (await response.json()) as WebManifest;

    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");

    // Presence only: dimensions, MIME types and byte weights stay owned by
    // test/unit/ui/public/frontend-public-static-assets-contract.test.ts.
    const purposes = new Set((manifest.icons ?? []).map((icon) => icon.purpose));
    expect(manifest.icons?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(purposes.has("any")).toBe(true);
    expect(purposes.has("maskable")).toBe(true);
  });

  test("serves the service worker script with its registration headers", async ({ request }) => {
    const response = await request.get(SERVICE_WORKER_PATH);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/javascript/);

    const cacheControl = response.headers()["cache-control"] ?? "";
    for (const directive of SERVICE_WORKER_CACHE_DIRECTIVES) {
      expect(cacheControl, `sw.js Cache-Control must contain ${directive}`).toContain(directive);
    }

    expect(response.headers()["service-worker-allowed"]).toBe("/");
  });
});
