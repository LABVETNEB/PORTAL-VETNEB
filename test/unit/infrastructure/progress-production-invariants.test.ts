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

function assertIncludes(source: string, expected: string, context: string): void {
  assert.ok(
    source.includes(expected),
    `${context}: missing invariant marker -> ${expected}`,
  );
}

function assertNotIncludes(
  source: string,
  forbidden: string,
  context: string,
): void {
  assert.ok(
    !source.includes(forbidden),
    `${context}: forbidden marker detected -> ${forbidden}`,
  );
}

function sectionBetween(
  source: string,
  start: string,
  end: string,
  context: string,
): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `${context}: missing start marker -> ${start}`);

  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `${context}: missing end marker -> ${end}`);

  return source.slice(startIndex, endIndex);
}

function assertInputAutocompleteOff(
  source: string,
  file: string,
  inputId: string,
): void {
  const idMarker = `id="${inputId}"`;
  const index = source.indexOf(idMarker);
  assert.notEqual(index, -1, `${file}: missing sensitive input -> ${inputId}`);
  const block = source.slice(index, index + 420);
  assert.ok(
    block.includes('autoComplete="off"'),
    `${file}: input ${inputId} must keep autoComplete=\"off\"`,
  );
}

test("public pricing invariants: runtime base URL and /precios success rendering stay locked", () => {
  const apiFile = "frontend/src/lib/api.ts";
  const apiSource = read(apiFile);

  assertIncludes(
    apiSource,
    "return normalizeApiBaseUrl(nextPublicApiUrl);",
    apiFile,
  );
  assertIncludes(apiSource, "return SAME_ORIGIN_API_BASE_URL;", apiFile);

  const preciosPageFile = "frontend/src/app/precios/page.tsx";
  const preciosPageSource = read(preciosPageFile);
  const preciosContentFile = "frontend/src/components/public/PreciosContent.tsx";
  const preciosContentSource = read(preciosContentFile);

  assertIncludes(preciosPageSource, "<PreciosContent />", preciosPageFile);

  assert.match(
    preciosContentSource,
    /getPublicPricing\(\s*\{ cache: "no-store" \},\s*\{ throwOnError: true \},\s*\)/,
    `${preciosContentFile}: must fetch public pricing with throwOnError`,
  );
  assertIncludes(
    preciosContentSource,
    "if (!cachedSnapshot && pricingSnapshot.success)",
    preciosContentFile,
  );
  assertIncludes(
    preciosContentSource,
    "categories: sortPricingCategories(pricingSnapshot.categories),",
    preciosContentFile,
  );
  assertIncludes(
    preciosContentSource,
    ": hasPricingItems(pricingCategories) ? (",
    preciosContentFile,
  );
  assertIncludes(
    preciosContentSource,
    "{pricingCategories.map((category) => {",
    preciosContentFile,
  );
  assertIncludes(
    preciosContentSource,
    "{category.items.map((item, index) => (",
    preciosContentFile,
  );

  // M19 (Fase D): la construcción read-through del snapshot público se movió de
  // la ruta al servicio directo de Pricing. La ruta quedó thin (sólo HTTP). Las
  // mismas invariantes de producción del snapshot se verifican ahora sobre el
  // servicio, sin debilitar la expectativa: shape del snapshot, success:true y
  // categorías agrupadas por `groupPublicPricingItems(items)`.
  const publicPricingServiceFile =
    "server/features/pricing/public-pricing-service.ts";
  const publicPricingServiceSource = read(publicPricingServiceFile);

  assertIncludes(
    publicPricingServiceSource,
    "const snapshot: PublicPricingSnapshot = {",
    publicPricingServiceFile,
  );
  assertIncludes(
    publicPricingServiceSource,
    "success: true,",
    publicPricingServiceFile,
  );
  assertIncludes(
    publicPricingServiceSource,
    "categories: groupPublicPricingItems(items),",
    publicPricingServiceFile,
  );

  // M19: la ruta pública quedó thin y DELEGA en el servicio directo. Se ancla la
  // delegación route -> service y se prohíbe reintroducir el read-through/snapshot
  // inline o imports hacia los shims retirados. Estas anclas protegen las mismas
  // invariantes de producción: que el snapshot lo construye el servicio y que la
  // ruta sólo es un adapter HTTP.
  const publicPricingRouteFile = "server/routes/public-pricing.fastify.ts";
  const publicPricingRouteSource = read(publicPricingRouteFile);

  assertIncludes(
    publicPricingRouteSource,
    'from "../features/pricing/public-pricing-service.ts"',
    publicPricingRouteFile,
  );
  assertIncludes(
    publicPricingRouteSource,
    "readThroughPublicPricing({",
    publicPricingRouteFile,
  );

  // No reintroducir grouping/snapshot inline en la ruta.
  assertNotIncludes(
    publicPricingRouteSource,
    "const snapshot: PublicPricingSnapshot = {",
    publicPricingRouteFile,
  );
  assertNotIncludes(
    publicPricingRouteSource,
    "groupPublicPricingItems",
    publicPricingRouteFile,
  );

  // No reintroducir imports hacia los shims retirados en M19.
  assertNotIncludes(
    publicPricingRouteSource,
    "../lib/public-pricing-cache.ts",
    publicPricingRouteFile,
  );
  assertNotIncludes(
    publicPricingRouteSource,
    "../db-pricing.ts",
    publicPricingRouteFile,
  );
});

test("email invariants: branded HTML CTA remains safe and HTML transport stays enabled", () => {
  const emailFile = "server/lib/email.ts";
  const emailSource = read(emailFile);

  assertIncludes(
    emailSource,
    "Content-Type: multipart/alternative; boundary",
    emailFile,
  );
  assertIncludes(emailSource, "html: input.html,", emailFile);
  assertIncludes(
    emailSource,
    "...(input.html ? { html: input.html } : {}),",
    emailFile,
  );
  assertIncludes(emailSource, "Abrir Portal VETNEB", emailFile);

  const particularHtmlSection = sectionBetween(
    emailSource,
    "function buildParticularTokenHtml(",
    "function buildContactMessageHtml(",
    "buildParticularTokenHtml section",
  );

  assertIncludes(
    particularHtmlSection,
    'href="${escapeHtml(safePortalUrl)}"',
    "buildParticularTokenHtml",
  );
  assertIncludes(
    particularHtmlSection,
    "${escapeHtml(input.token)}",
    "buildParticularTokenHtml",
  );
  assertNotIncludes(
    particularHtmlSection,
    "javascript:",
    "buildParticularTokenHtml",
  );
  assertNotIncludes(particularHtmlSection, "onclick", "buildParticularTokenHtml");
  assertNotIncludes(particularHtmlSection, "<script", "buildParticularTokenHtml");
  assertNotIncludes(particularHtmlSection, "?token=", "buildParticularTokenHtml");

  const hrefValues = [...particularHtmlSection.matchAll(/href="([^"]*)"/g)].map(
    (match) => match[1],
  );
  assert.ok(hrefValues.length > 0, "buildParticularTokenHtml: expected href markers");

  for (const href of hrefValues) {
    assert.equal(
      href.includes("${escapeHtml(input.token)}"),
      false,
      `token must not be embedded in href -> ${href}`,
    );
    assert.equal(
      href.includes("token="),
      false,
      `token query must not exist in href -> ${href}`,
    );
  }
});

test("auth session invariants: persistent Max-Age on login and explicit Max-Age=0 on logout", () => {
  const authRouteContracts = [
    {
      file: "server/routes/auth.fastify.ts",
      clearFn: "buildClearSessionCookie",
    },
    {
      file: "server/routes/admin-auth.fastify.ts",
      clearFn: "buildClearAdminSessionCookie",
    },
    {
      file: "server/routes/particular-auth.fastify.ts",
      clearFn: "buildClearParticularSessionCookie",
    },
  ] as const;

  for (const contract of authRouteContracts) {
    const source = read(contract.file);

    assertIncludes(
      source,
      "maxAgeSeconds: ENV.sessionTtlHours * 60 * 60",
      contract.file,
    );
    assertIncludes(source, "function serializeCookie(input:", contract.file);
    assertIncludes(source, "Max-Age=${input.maxAgeSeconds}", contract.file);
    assertIncludes(source, `function ${contract.clearFn}()`, contract.file);

    const clearSection = sectionBetween(
      source,
      `function ${contract.clearFn}() {`,
      "function setLoginRateLimitHeaders(",
      `${contract.file}:${contract.clearFn}`,
    );
    assertIncludes(clearSection, "maxAgeSeconds: 0", contract.file);
    assertIncludes(
      clearSection,
      'expires: "Thu, 01 Jan 1970 00:00:00 GMT"',
      contract.file,
    );
  }
});

test("particular token invariants: hard delete, legacy revoke hard-delete, cascade invalidation and safe UI", () => {
  const dbParticularFile =
    "server/features/particular-access/infrastructure/particular-access-repository.ts";
  const dbParticularSource = read(dbParticularFile);

  const deleteFnSection = sectionBetween(
    dbParticularSource,
    "export async function deleteParticularToken(id: number) {",
    "export async function updateParticularTokenLastLogin(",
    dbParticularFile,
  );
  assertIncludes(deleteFnSection, ".delete(particularTokens)", dbParticularFile);
  assertNotIncludes(deleteFnSection, ".update(particularTokens)", dbParticularFile);

  const adminTokenRouteFile = "server/routes/admin-particular-tokens.fastify.ts";
  const adminTokenRouteSource = read(adminTokenRouteFile);
  const adminTokenApplicationFile =
    "server/features/particular-access/application/admin-particular-access-operations.ts";
  const adminTokenApplicationSource = read(adminTokenApplicationFile);
  assertIncludes(
    adminTokenApplicationSource,
    "const deleted = await deps.deleteParticularToken(tokenId);",
    adminTokenApplicationFile,
  );

  const deleteRouteSection = sectionBetween(
    adminTokenRouteSource,
    "app.delete<{",
    "app.patch<{",
    `${adminTokenRouteFile}:DELETE`,
  );
  assertIncludes(
    deleteRouteSection,
    "const result = await adminOperations.deleteToken(tokenId);",
    `${adminTokenRouteFile}:DELETE`,
  );
  assertIncludes(
    deleteRouteSection,
    "deletedTokenId: result.deletedTokenId,",
    `${adminTokenRouteFile}:DELETE`,
  );
  assertNotIncludes(deleteRouteSection, "tokenHash", `${adminTokenRouteFile}:DELETE`);
  assertNotIncludes(deleteRouteSection, "tokenLast4", `${adminTokenRouteFile}:DELETE`);

  const revokeRouteSection = sectionBetween(
    adminTokenRouteSource,
    '}>("/:tokenId/revoke", async (request, reply) => {',
    "\n  });\n};",
    `${adminTokenRouteFile}:PATCH /revoke`,
  );
  assertIncludes(
    revokeRouteSection,
    "const result = await adminOperations.deleteToken(tokenId);",
    `${adminTokenRouteFile}:PATCH /revoke`,
  );
  assertIncludes(
    revokeRouteSection,
    "deletedTokenId: result.deletedTokenId,",
    `${adminTokenRouteFile}:PATCH /revoke`,
  );
  assertNotIncludes(
    revokeRouteSection,
    "tokenHash",
    `${adminTokenRouteFile}:PATCH /revoke`,
  );
  assertNotIncludes(
    revokeRouteSection,
    "tokenLast4",
    `${adminTokenRouteFile}:PATCH /revoke`,
  );

  const schemaFile = "drizzle/schema.ts";
  const schemaSource = read(schemaFile);
  const particularSessionsSection = sectionBetween(
    schemaSource,
    "export const particularSessions = pgTable(",
    "export type Clinic = InferSelectModel<typeof clinics>;",
    schemaFile,
  );
  assertIncludes(
    particularSessionsSection,
    '.references(() => particularTokens.id, { onDelete: "cascade" }),',
    schemaFile,
  );

  const adminCardFile = "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx";
  const adminCardSource = read(adminCardFile);

  assertIncludes(adminCardSource, "Eliminar token", adminCardFile);
  assertNotIncludes(adminCardSource, "Token inactivo", adminCardFile);
  assertNotIncludes(adminCardSource, "Revocar token", adminCardFile);
  assertIncludes(
    adminCardSource,
    '<form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">',
    adminCardFile,
  );
  assertNotIncludes(adminCardSource, 'autoComplete="on"', adminCardFile);

  assertInputAutocompleteOff(
    adminCardSource,
    adminCardFile,
    "admin-token-particular-email",
  );
  assertInputAutocompleteOff(
    adminCardSource,
    adminCardFile,
    "admin-token-tutor-last-name",
  );
  assertInputAutocompleteOff(
    adminCardSource,
    adminCardFile,
    "admin-token-pet-name",
  );

  const clinicCardFile = "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx";
  const clinicCardSource = read(clinicCardFile);

  assertIncludes(
    clinicCardSource,
    '<form\n          className="flex min-h-0 flex-col gap-4"',
    clinicCardFile,
  );
  assertNotIncludes(clinicCardSource, 'autoComplete="on"', clinicCardFile);

  assertInputAutocompleteOff(
    clinicCardSource,
    clinicCardFile,
    "clinic-token-particular-email",
  );
  assertInputAutocompleteOff(
    clinicCardSource,
    clinicCardFile,
    "clinic-token-tutor-last-name",
  );
  assertInputAutocompleteOff(
    clinicCardSource,
    clinicCardFile,
    "clinic-token-pet-name",
  );
  assertInputAutocompleteOff(
    clinicCardSource,
    clinicCardFile,
    "clinic-token-report-id",
  );
});
