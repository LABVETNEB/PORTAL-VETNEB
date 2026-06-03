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

test("admin clinics route is registered below admin namespace", () => {
  const source = read("server/fastify-app.ts");

  assert.ok(source.includes("adminClinicsNativeRoutes"));
  assert.ok(source.includes('prefix: "/api/admin/clinics"'));
});

test("admin clinics route authenticates through request-scoped admin auth helper", () => {
  const routeSource = read("server/routes/admin-clinics.fastify.ts");
  const adapterSource = read("server/lib/fastify-admin-auth.ts");

  assert.ok(routeSource.includes("authenticateFastifyAdmin(request, reply"));
  assert.ok(adapterSource.includes("getRequestAdminAuthContext"));
  assert.ok(adapterSource.includes("REQUEST_ADMIN_AUTH_CONTEXT_KEY"));
  assert.ok(adapterSource.includes("ENV.adminCookieName"));
  assert.ok(adapterSource.includes("getAdminSessionWithUser"));
});

test("admin users credentials route keeps admin auth before mutation", () => {
  const source = read("server/routes/admin-users-roles.fastify.ts");
  const routeIndex = source.indexOf('"/clinic/:clinicUserId/credentials"');
  const authIndex = source.indexOf("authenticateAdminUser(request, reply, deps, now)", routeIndex);
  const updateIndex = source.indexOf("updateAdminClinicUserCredentials", authIndex);

  assert.ok(routeIndex >= 0);
  assert.ok(authIndex > routeIndex);
  assert.ok(updateIndex > authIndex);
});
