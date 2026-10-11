import { type APIResponse, expect, test } from "@playwright/test";

import {
  ACCESS_DOCUMENT_PATHS,
  PUBLIC_DOCUMENT_PATHS,
  cachePolicyViolations,
  type ServedBy,
  type ServedResponse,
  type ServedSurface,
} from "../../helpers/http-cache-policy";

// A1-5 — what a cache may do with the documents this origin serves. A public
// document keeps its URL across deploys while the assets it names change with
// every build, so no cache may answer with a stored copy before asking the
// origin. Every assertion reads a served response, never `next.config.ts`:
// Next decides the Cache-Control of a page unless the response already carries
// one, so a rule that exists in the config proves nothing by itself.
//
// `next dev` stamps `no-cache, must-revalidate` over every application page
// and serves its chunks uncached, so two things are only decidable under the
// production runner behind e2e:ci (`next start`): that a shared cache may not
// store the entry-point documents, and that a build's chunks stay immutable.
//
// Not proven here: what a CDN does with these headers (A1-6), and that the
// assets of an earlier build stay available to an open tab (A1-7).
const isProductionRunner =
  process.env.CI === "true" && process.env.VETNEB_E2E_PRODUCTION_RUNNER === "1";
const servedBy: ServedBy = isProductionRunner ? "next-start" : "next-dev";

const FLIGHT_REQUESTS = [
  { RSC: "1" },
  { RSC: "1", "Next-Router-Prefetch": "1" },
] as const;

function served(response: APIResponse): ServedResponse {
  const headers = response.headers();

  return {
    cacheControl: headers["cache-control"],
    contentType: headers["content-type"],
    vary: headers["vary"],
    expires: headers["expires"],
    date: headers["date"],
    setCookie: headers["set-cookie"],
  };
}

function expectPolicy(surface: ServedSurface, response: APIResponse, what: string) {
  expect(
    cachePolicyViolations(surface, served(response), servedBy),
    `${what} -> Cache-Control: ${response.headers()["cache-control"] ?? "<none>"}`,
  ).toEqual([]);
}

const DOCUMENTS = [
  ...PUBLIC_DOCUMENT_PATHS.map((path) => ({ path, surface: "public-document" as const })),
  ...ACCESS_DOCUMENT_PATHS.map((path) => ({ path, surface: "access-document" as const })),
];

test.describe("documents of a stable URL", () => {
  for (const { path, surface } of DOCUMENTS) {
    test(`${path} is never reused without asking the origin`, async ({ request }) => {
      const document = await request.get(path, { maxRedirects: 0 });

      expect(document.status()).toBe(200);
      expectPolicy(surface, document, `GET ${path}`);

      // The policy belongs to the path: neither a query string nor the
      // method may select a different one.
      const underQuery = `${path}?next=%2Fdashboard&tipo=clinica&utm_source=e2e`;
      const withQuery = await request.get(underQuery, { maxRedirects: 0 });

      expect(withQuery.status()).toBe(200);
      expectPolicy(surface, withQuery, `GET ${underQuery}`);

      const head = await request.head(path, { maxRedirects: 0 });

      expect(head.status()).toBe(200);
      expect(head.headers()["cache-control"]).toBe(document.headers()["cache-control"]);

      const validator = document.headers()["etag"];

      if (isProductionRunner) {
        expect(validator, "a prerendered document carries a validator").toBeTruthy();
      }

      if (validator) {
        // A 304 renews the stored copy with the headers it carries: it must
        // not hand back the lifetime the 200 withheld.
        const unchanged = await request.get(path, {
          maxRedirects: 0,
          headers: { "If-None-Match": validator },
        });

        expect(unchanged.status()).toBe(304);
        expectPolicy("revalidated", unchanged, `304 ${path}`);

        const fromAnotherBuild = await request.get(path, {
          maxRedirects: 0,
          headers: { "If-None-Match": '"validator-of-another-build"' },
        });

        expect(fromAnotherBuild.status()).toBe(200);
        expectPolicy(surface, fromAnotherBuild, `GET ${path} with a foreign validator`);
      }
    });
  }

  for (const path of ["/servicios", "/login"] as const) {
    test(`the router payload of ${path} is not a shareable copy of the document`, async ({ request }) => {
      for (const headers of FLIGHT_REQUESTS) {
        // A payload request without the `_rsc` value the server expects is
        // redirected to the same URL carrying it.
        const payload = await request.get(path, { headers });

        expect(payload.status()).toBe(200);
        expectPolicy("flight", payload, `flight ${path} ${JSON.stringify(headers)}`);
      }
    });
  }
});

test.describe("responses that are not a stable public document", () => {
  test("a dynamic public route and an unknown route are never reused", async ({ request }) => {
    const dynamic = await request.get("/profesionales/123", { maxRedirects: 0 });

    expect(dynamic.status()).toBe(200);
    expectPolicy("revalidated", dynamic, "GET /profesionales/123");

    for (const path of ["/ruta-que-no-existe", "/servicios/ruta-que-no-existe"]) {
      const missing = await request.get(path, { maxRedirects: 0 });

      expect(missing.status()).toBe(404);
      expectPolicy("revalidated", missing, `GET ${path}`);
    }
  });

  test("a dashboard request without a session is redirected under no-store", async ({ request }) => {
    for (const path of ["/dashboard", "/dashboard/admin?module=users", "/dashboard/informes"]) {
      const redirect = await request.get(path, { maxRedirects: 0 });

      expect(redirect.status()).toBe(307);
      expect(new URL(redirect.headers()["location"] ?? "", "http://origin.invalid").pathname).toBe("/login");
      expectPolicy("private", redirect, `GET ${path}`);
    }
  });

  test("the build information endpoint does not inherit a document policy", async ({ request }) => {
    const buildInfo = await request.get("/api/build-info");

    expect(buildInfo.status()).toBe(200);
    expect(buildInfo.headers()["content-type"]).toMatch(/application\/json/);
    expectPolicy("private", buildInfo, "GET /api/build-info");
  });
});

test.describe("resources a document names", () => {
  test("content-versioned assets stay immutable and stable URLs stay revalidable", async ({ request }) => {
    const home = await (await request.get("/")).text();
    const named = (pattern: RegExp) => home.match(pattern)?.[0];

    const versioned = [
      named(/\/theme-init\.[0-9a-f]{16}\.js/),
      named(/\/fonts\/InterVariable\.[0-9a-f]{16}\.woff2/),
      ...(isProductionRunner
        ? [named(/\/_next\/static\/[^"'\s<>\\]+\.js/), named(/\/_next\/static\/[^"'\s<>\\]+\.css/)]
        : []),
    ];

    expect(versioned, "the home document names every versioned resource").not.toContain(undefined);

    for (const path of versioned as string[]) {
      const asset = await request.get(path);

      expect(asset.status(), path).toBe(200);
      expectPolicy("immutable-asset", asset, `GET ${path}`);
    }

    for (const path of [
      "/manifest.webmanifest",
      "/icons/icon-192x192.png",
      "/images/hero-microscope-vetneb.webp",
    ]) {
      const asset = await request.get(path);

      expect(asset.status(), path).toBe(200);
      expectPolicy("stable-asset", asset, `GET ${path}`);
    }
  });

  test("the offline fallback document stays precacheable by the service worker", async ({ request }) => {
    for (const path of ["/offline-fallback.html", "/offline-fallback.html?next=%2Fdashboard"]) {
      const fallback = await request.get(path, { maxRedirects: 0 });

      expect(fallback.status()).toBe(200);
      expectPolicy("offline-fallback", fallback, `GET ${path}`);
    }
  });
});
