import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
function readRouteSource(relativeRoutePath: string) {
  return readFileSync(resolve(process.cwd(), relativeRoutePath), "utf8");
}
test("clinic-public-profile exige management permission en mutaciones sensibles", () => {
  const source = readRouteSource("server/routes/clinic-public-profile.routes.ts");
  assert.match(source, /import \{ requireClinicManagementPermission \} from "\.\.\/middlewares\/clinic-permissions";/);
  assert.match(source, /router\.patch\(\s*"\/",\s*requireClinicManagementPermission,/s);
  assert.match(source, /router\.post\(\s*"\/avatar",\s*requireClinicManagementPermission,\s*upload\.single\("avatar"\),/s);
  assert.match(source, /router\.delete\(\s*"\/avatar",\s*requireClinicManagementPermission,/s);
});
test("particular-tokens exige management permission en create y report link", () => {
  const source = readRouteSource("server/routes/particular-tokens.routes.ts");
  assert.match(source, /import \{ requireClinicManagementPermission \} from "\.\.\/middlewares\/clinic-permissions";/);
  assert.match(source, /router\.post\(\s*"\/",\s*requireTrustedOrigin,\s*requireClinicManagementPermission,/s);
  assert.match(source, /router\.patch\(\s*"\/:tokenId\/report",\s*requireTrustedOrigin,\s*requireClinicManagementPermission,/s);
});
test("study-tracking exige management permission al crear casos", () => {
  const source = readRouteSource("server/routes/study-tracking.routes.ts");
  assert.match(source, /import \{ requireClinicManagementPermission \} from "\.\.\/middlewares\/clinic-permissions";/);
  assert.match(source, /router\.post\(\s*"\/",\s*requireTrustedOrigin,\s*requireClinicManagementPermission,/s);
});
