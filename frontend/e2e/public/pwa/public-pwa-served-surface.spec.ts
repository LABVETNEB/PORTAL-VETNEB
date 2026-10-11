import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// LIMPIEZA E2E §6.2/§21 — the PWA surface a browser can actually observe under
// the required harness: /offline as a public page, the offline fallback
// document the service worker precaches, and the manifest and the service
// worker script as served responses carrying their real headers. The header
// assertions read the response, never `next.config.ts`.
//
// The fallback document is held to what it needs when the worker answers a
// navigation with it and the origin is gone: it is loaded with JavaScript
// disabled and must ask the network for nothing but itself. That proves the
// document is autonomous; it does not prove that the worker delivers it.
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
const OFFLINE_FALLBACK_PATH = "/offline-fallback.html";
// The one resource the fallback names: an icon the service worker precaches.
const OFFLINE_FALLBACK_ICON_PATH = "/icons/icon-192x192.png";
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

test.describe("offline fallback document", () => {
  test("is served as a public HTML document the service worker can precache", async ({ request }) => {
    const response = await request.get(OFFLINE_FALLBACK_PATH, { maxRedirects: 0 });

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^text\/html/);
    // sw.js installs only with a clean public copy, and must get the bytes of
    // the build that published it: the URL is stable, so it is never pinned.
    expect(response.headers()["cache-control"] ?? "").not.toMatch(/no-store|private|immutable/);
    expect(response.headers()["set-cookie"]).toBeUndefined();
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
  });

  test("is excluded from search indexing and has no axe violations", async ({ page }) => {
    await page.goto(OFFLINE_FALLBACK_PATH);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(
        results.violations.map((violation) => `${violation.id}: ${violation.help}`),
        `axe at ${viewport.width}px`,
      ).toEqual([]);
    }
  });

  test.describe("with JavaScript disabled", () => {
    test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 640 } });

    test("needs no other request and stays whole, styled and operable by keyboard", async ({ page }) => {
      const requested: string[] = [];

      page.on("request", (request) => {
        requested.push(new URL(request.url()).pathname);
      });

      const response = await page.goto(OFFLINE_FALLBACK_PATH, { waitUntil: "load" });

      expect(response?.status()).toBe(200);

      const heading = page.locator("h1#offline-heading");
      await expect(heading).toBeVisible();
      await expect(heading).toHaveText("Portal VETNEB no puede conectarse en este momento");
      await expect(page.locator("html")).toHaveAttribute("lang", "es");
      await expect(page).toHaveTitle("Sin conexión — Portal VETNEB");

      // What `load` shows is final: the document carries no script, none could
      // run, and no client boundary exists to take the content over.
      await expect(page.locator("script")).toHaveCount(0);
      await expect(page.locator("[data-route-error-boundary]")).toHaveCount(0);

      const main = page.locator("main");
      for (const required of ["conexión a internet", "informes", "sesiones clínicas", "administración"]) {
        await expect(main).toContainText(required);
      }

      const retry = page.getByRole("link", { name: "Reintentar conexión" });
      const home = page.getByRole("link", { name: "Ir al inicio" });

      await expect(retry).toHaveAttribute("href", "");
      await expect(home).toHaveAttribute("href", "/");

      // The styles travel inside the document: an unstyled link is underlined
      // and has no background.
      await expect(retry).toHaveCSS("text-decoration-line", "none");
      await expect(retry).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

      await page.keyboard.press("Tab");
      await expect(retry).toBeFocused();
      await expect(retry).not.toHaveCSS("outline-style", "none");
      await page.keyboard.press("Tab");
      await expect(home).toBeFocused();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, "no horizontal overflow at 320px").toBeLessThanOrEqual(0);

      // With the origin gone only the worker can answer, and it holds this
      // document and that icon: any other request would be one that fails.
      expect(
        requested.filter((pathname) => pathname !== OFFLINE_FALLBACK_ICON_PATH),
        "the document must ask for nothing but itself and its precached icon",
      ).toEqual([OFFLINE_FALLBACK_PATH]);
    });

    test("its native links leave the fallback once the network answers", async ({ page }) => {
      await page.goto(OFFLINE_FALLBACK_PATH);

      // An empty href is the current URL: retry asks again for the page the
      // visitor was on, which here is the fallback's own path.
      const retryNavigation = page.waitForResponse(
        (candidate) =>
          candidate.request().isNavigationRequest() &&
          new URL(candidate.url()).pathname === OFFLINE_FALLBACK_PATH,
      );

      await page.getByRole("link", { name: "Reintentar conexión" }).click();
      expect((await retryNavigation).ok(), "the retry link must reload the current page").toBeTruthy();
      await expect(page.locator("h1#offline-heading")).toBeVisible();

      const homeNavigation = page.waitForResponse(
        (candidate) => candidate.request().isNavigationRequest() && new URL(candidate.url()).pathname === "/",
      );

      await page.getByRole("link", { name: "Ir al inicio" }).click();
      expect((await homeNavigation).ok(), "the home link must load the public home").toBeTruthy();
      await expect(page).toHaveURL((url) => url.pathname === "/");
      await expect(page.locator("h1#offline-heading")).toHaveCount(0);
    });
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
