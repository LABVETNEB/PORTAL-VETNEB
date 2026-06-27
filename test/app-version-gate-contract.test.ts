import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("backend exposes a no-store app version endpoint", () => {
  const route = read("server/routes/app-version.fastify.ts");
  const app = read("server/fastify-app.ts");

  assert.ok(route.includes('app.get("/"'));
  assert.ok(route.includes('reply.header("cache-control", "no-store'));
  assert.ok(route.includes("appVersion"));
  assert.ok(route.includes("clientMinVersion"));
  assert.ok(route.includes("forceUpdate: true"));
  assert.ok(app.includes('prefix: "/api/app-version"'));
});

test("frontend compares compiled client version against backend version", () => {
  const helper = read("frontend/src/lib/app-version.ts");

  assert.ok(helper.includes("NEXT_PUBLIC_APP_VERSION"));
  assert.ok(helper.includes('fetch(`/api/app-version?t=${Date.now()}`'));
  assert.ok(helper.includes('cache: "no-store"'));
  assert.ok(helper.includes('"x-vetneb-client-version": CLIENT_APP_VERSION'));
  assert.ok(helper.includes("CLIENT_APP_VERSION !== snapshot.appVersion"));
});

test("root layout mounts the app version blocker globally", () => {
  const layout = read("frontend/src/app/layout.tsx");

  assert.ok(layout.includes('import { AppVersionGate } from "@/components/app-version/AppVersionGate";'));
  assert.ok(layout.includes("<AppVersionGate />"));
});

test("app version gate blocks usage and clears PWA caches before reload", () => {
  const gate = read("frontend/src/components/app-version/AppVersionGate.tsx");

  assert.ok(gate.includes('role="alertdialog"'));
  assert.ok(gate.includes('data-app-version-gate="true"'));
  assert.ok(gate.includes("Actualizar Portal VETNEB para continuar"));
  assert.ok(gate.includes('key.startsWith("portal-vetneb-")'));
  assert.ok(gate.includes("window.location.reload();"));
});

test("service worker cache namespace changes for the version gate deployment", () => {
  const sw = read("frontend/public/sw.js");

  assert.ok(sw.includes('const SW_VERSION = "2026-06-26-app-version-gate-v1"'));
  assert.ok(sw.includes('event.data?.type === "VETNEB_SKIP_WAITING"'));
  assert.ok(sw.includes('pathname.startsWith("/api/")'));
});
