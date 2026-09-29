import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as readSource } from "../../../helpers/tracked-source-files.ts";

function getExportedFunctionBody(source: string, name: string): string {
  const fnStart = source.indexOf(`export async function ${name}(`);
  assert.ok(fnStart >= 0, `${name} debe estar exportada`);

  const fnEnd = source.indexOf("\nexport ", fnStart + 1);
  return source.slice(fnStart, fnEnd === -1 ? source.length : fnEnd);
}

test("getAdminSessionWithUser devuelve sesión+usuario con JOIN admin_sessions + admin_users", () => {
  const source = readSource("server/db.ts");
  const fnBody = getExportedFunctionBody(source, "getAdminSessionWithUser");

  assert.ok(fnBody.includes(".select({"));
  assert.ok(fnBody.includes("session: {"));
  assert.ok(fnBody.includes("id: adminSessions.id"));
  assert.ok(fnBody.includes("adminUserId: adminSessions.adminUserId"));
  assert.ok(fnBody.includes("tokenHash: adminSessions.tokenHash"));
  assert.ok(fnBody.includes("lastAccess: adminSessions.lastAccess"));
  assert.ok(fnBody.includes("expiresAt: adminSessions.expiresAt"));
  assert.ok(fnBody.includes("adminUser: {"));
  assert.ok(fnBody.includes("id: adminUsers.id"));
  assert.ok(fnBody.includes("username: adminUsers.username"));
  assert.ok(fnBody.includes(".from(adminSessions)"));
  assert.ok(
    fnBody.includes(
      ".leftJoin(adminUsers, eq(adminSessions.adminUserId, adminUsers.id))",
    ),
  );
  assert.ok(fnBody.includes(".where(eq(adminSessions.tokenHash, tokenHash))"));
  assert.ok(fnBody.includes(".limit(1)"));
});

test("getAdminSessionWithUser devuelve null si no existe sesión para tokenHash", () => {
  const source = readSource("server/db.ts");
  const fnBody = getExportedFunctionBody(source, "getAdminSessionWithUser");

  assert.ok(fnBody.includes("return result[0] ?? null;"));
});
