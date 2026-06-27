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

test("backend derives a commercial displayVersion from npm_package_version, separate from the technical SHA", () => {
  const route = read("server/routes/app-version.fastify.ts");

  assert.ok(route.includes("displayVersion"));
  assert.ok(route.includes("process.env.npm_package_version"));
  assert.ok(route.includes('"Portal VETNEB v'));
});

test("frontend compares compiled client version against backend version", () => {
  const helper = read("frontend/src/lib/app-version.ts");

  assert.ok(helper.includes("NEXT_PUBLIC_APP_VERSION"));
  assert.ok(helper.includes('fetch(`/api/app-version?t=${Date.now()}`'));
  assert.ok(helper.includes('cache: "no-store"'));
  assert.ok(helper.includes('"x-vetneb-client-version": CLIENT_APP_VERSION'));
  assert.ok(helper.includes("CLIENT_APP_VERSION !== snapshot.appVersion"));
  assert.ok(helper.includes("export function toSafeDisplayVersion"));
  assert.ok(helper.includes("export function clearAppVersionLocalState"));
});

test("toSafeDisplayVersion never leaks the missing-client-version sentinel or raw commit hashes", async () => {
  const { toSafeDisplayVersion } = await import(
    "../frontend/src/lib/app-version.ts"
  );

  assert.equal(
    toSafeDisplayVersion("missing-client-version"),
    "anterior / no detectada",
  );
  assert.equal(
    toSafeDisplayVersion("f41c8005a98a9b3f24ad3f55bc608ec97464ccf3"),
    "anterior / no detectada",
  );
  assert.equal(toSafeDisplayVersion(null), "anterior / no detectada");
  assert.equal(toSafeDisplayVersion(undefined), "anterior / no detectada");
  assert.equal(toSafeDisplayVersion(""), "anterior / no detectada");
  assert.equal(toSafeDisplayVersion("2.1.0"), "Portal VETNEB v2.1.0");
  assert.equal(
    toSafeDisplayVersion("Portal VETNEB v2.1.0"),
    "Portal VETNEB v2.1.0",
  );
});

test("root layout mounts the app version blocker globally", () => {
  const layout = read("frontend/src/app/layout.tsx");

  assert.ok(layout.includes('import { AppVersionGate } from "@/components/app-version/AppVersionGate";'));
  assert.ok(layout.includes("<AppVersionGate />"));
});

test("app version gate blocks usage, unregisters service workers, clears PWA state and replaces the URL with a cache-buster", () => {
  const gate = read("frontend/src/components/app-version/AppVersionGate.tsx");

  assert.ok(gate.includes('role="alertdialog"'));
  assert.ok(gate.includes('data-app-version-gate="true"'));
  assert.ok(gate.includes("Actualizá Portal VETNEB para continuar"));
  assert.ok(gate.includes('key.startsWith("portal-vetneb-")'));
  assert.ok(gate.includes("registration.unregister()"));
  assert.ok(gate.includes("clearAppVersionLocalState()"));
  assert.ok(gate.includes('new URL("/", window.location.origin)'));
  assert.ok(gate.includes('searchParams.set("vetnebUpdate"'));
  assert.ok(gate.includes("window.location.replace("));
  assert.ok(!gate.includes("window.location.reload();"));
});

test("app version gate never renders raw technical version identifiers", () => {
  const gate = read("frontend/src/components/app-version/AppVersionGate.tsx");

  assert.ok(!gate.includes(">{CLIENT_APP_VERSION}<"));
  assert.ok(!gate.includes("{latestVersion ?? "));
  assert.ok(gate.includes("toSafeDisplayVersion(CLIENT_APP_VERSION)"));
  assert.ok(gate.includes("toSafeDisplayVersion(latestVersion)"));
  assert.ok(gate.includes("Versión instalada"));
  assert.ok(gate.includes("Versión vigente"));
  assert.ok(gate.includes("https://vetneb.com.ar"));
});

test("frontend api client sends the client version header on every request", () => {
  const api = read("frontend/src/lib/api.ts");

  assert.ok(
    api.includes(
      'import { CLIENT_APP_VERSION, CLIENT_VERSION_HEADER } from "@/lib/app-version";',
    ),
  );
  assert.ok(
    api.includes("headers.set(CLIENT_VERSION_HEADER, CLIENT_APP_VERSION);"),
  );
});

test("frontend api client publishes a blocking signal on CLIENT_VERSION_UNSUPPORTED", () => {
  const api = read("frontend/src/lib/api.ts");

  assert.ok(
    api.includes(
      'import { publishClientVersionUnsupported } from "@/lib/client-version-error";',
    ),
  );
  assert.ok(api.includes('const CLIENT_VERSION_UNSUPPORTED_CODE = "CLIENT_VERSION_UNSUPPORTED";'));
  assert.ok(api.includes("res.status === 426 &&"));
  assert.ok(api.includes("body.code === CLIENT_VERSION_UNSUPPORTED_CODE"));
  assert.ok(api.includes("publishClientVersionUnsupported({"));
});

test("app version gate blocks usage on CLIENT_VERSION_UNSUPPORTED with the required copy", () => {
  const gate = read("frontend/src/components/app-version/AppVersionGate.tsx");

  assert.ok(gate.includes('data-client-version-unsupported="true"'));
  assert.ok(gate.includes("Actualización requerida"));
  assert.ok(
    gate.includes(
      "Estás usando una versión anterior de VETNEB. Para proteger tu",
    ),
  );
  assert.ok(gate.includes("Actualizar ahora"));
  assert.ok(
    gate.includes("subscribeClientVersionUnsupported"),
  );
});

test("service worker cache namespace changes for the version gate deployment", () => {
  const sw = read("frontend/public/sw.js");

  assert.ok(sw.includes('const SW_VERSION = "2026-06-26-app-version-gate-v1"'));
  assert.ok(sw.includes('event.data?.type === "VETNEB_SKIP_WAITING"'));
  assert.ok(sw.includes('"/api/"'));
  assert.ok(sw.includes("isPrivatePath"));
});
