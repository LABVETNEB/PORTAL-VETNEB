import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
function readRouteSource(relativeRoutePath: string) {
  return readFileSync(resolve(process.cwd(), relativeRoutePath), "utf8");
}

function routeExists(relativeRoutePath: string) {
  return existsSync(resolve(process.cwd(), relativeRoutePath));
}
test("clinic-public-profile exige management permission en mutaciones sensibles", () => {
  const source = readRouteSource("server/routes/clinic-public-profile.routes.ts");
  assert.match(source, /import \{ requireClinicManagementPermission \} from "\.\.\/middlewares\/clinic-permissions";/);
  assert.match(source, /router\.patch\(\s*"\/",\s*requireClinicManagementPermission,/s);
  assert.match(source, /router\.post\(\s*"\/avatar",\s*requireClinicManagementPermission,\s*upload\.single\("avatar"\),/s);
  assert.match(source, /router\.delete\(\s*"\/avatar",\s*requireClinicManagementPermission,/s);
});
test("particular-tokens exige management permission nativa en create y report link", () => {
  const source = readRouteSource("server/routes/particular-tokens.fastify.ts");

  assert.equal(
    routeExists("server/routes/particular-tokens.routes.ts"),
    false,
    "server/routes/particular-tokens.routes.ts ya no debe existir",
  );

  assert.match(
    source,
    /function requireParticularTokenManagementPermission\(/,
  );
  assert.match(
    source,
    /if \(auth\.canManageClinicUsers\) \{\s*return true;/s,
  );
  assert.match(
    source,
    /error: "No autorizado para administrar recursos de la clinica"/,
  );

  assert.match(
    source,
    /app\.post<[\s\S]*?>\(\s*"\/"[\s\S]*?enforceTrustedOrigin\(request, reply, allowedOrigins\)[\s\S]*?requireParticularTokenManagementPermission\(auth, reply\)/s,
  );
  assert.match(
    source,
    /app\.patch<[\s\S]*?>\(\s*"\/:tokenId\/report"[\s\S]*?enforceTrustedOrigin\(request, reply, allowedOrigins\)[\s\S]*?requireParticularTokenManagementPermission\(auth, reply\)/s,
  );
});
test("study-tracking exige management permission nativa al crear casos", () => {
  const source = readRouteSource("server/routes/study-tracking.fastify.ts");

  assert.equal(
    routeExists("server/routes/study-tracking.routes.ts"),
    false,
    "server/routes/study-tracking.routes.ts ya no debe existir",
  );

  assert.match(
    source,
    /function requireStudyTrackingManagementPermission\(/,
  );
  assert.match(
    source,
    /if \(auth\.canManageClinicUsers\) \{\s*return true;/s,
  );
  assert.match(
    source,
    /error: "No autorizado para administrar recursos de la clinica"/,
  );

  assert.match(
    source,
    /app\.post<[\s\S]*?>\(\s*"\/"[\s\S]*?enforceTrustedOrigin\(request, reply, allowedOrigins\)[\s\S]*?requireStudyTrackingManagementPermission\(auth, reply\)/s,
  );
});
