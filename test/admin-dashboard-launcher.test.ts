import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PACKAGE_PATH = "package.json";
const ADMIN_LAUNCHER_PATH = "scripts/dev/open-admin-dashboard.ps1";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("package exposes local admin dashboard launcher", () => {
  const source = read(PACKAGE_PATH);

  assert.ok(source.includes('"admin:open": "powershell -ExecutionPolicy Bypass -File scripts/dev/open-admin-dashboard.ps1"'));
});

test("local admin dashboard launcher exists and opens admin through session cookie", () => {
  assert.equal(existsSync(resolve(process.cwd(), ADMIN_LAUNCHER_PATH)), true);

  const source = read(ADMIN_LAUNCHER_PATH);

  assert.ok(source.includes("VETNEB admin launcher"));
  assert.ok(source.includes("$BackendUrl/api/admin/auth/login"));
  assert.ok(source.includes("admin_session_id"));
  assert.ok(source.includes("Network.setCookie"));
  assert.ok(source.includes("$FrontendUrl/dashboard/admin"));
  assert.ok(source.includes("Read-Host"));
  assert.ok(source.includes("Password administrador"));
  assert.ok(source.includes("VETNEB_ADMIN_USERNAME"));
  assert.ok(source.includes("VETNEB_ADMIN_PASSWORD"));
  assert.ok(source.includes("[System.Net.WebSockets.ClientWebSocket]::new()"));
  assert.equal(source.includes("Add-Type -AssemblyName System.Net.WebSockets"), false);
});

test("local admin dashboard launcher does not hardcode admin password", () => {
  const source = read(ADMIN_LAUNCHER_PATH);

  assert.equal(source.includes("31731490Neb"), false);
  assert.equal(source.includes('"password":"'), false);
  assert.equal(source.includes("'password':'"), false);
});

test("local admin dashboard launcher configures frontend/backend cookies for cross-origin admin calls", () => {
  const source = read(ADMIN_LAUNCHER_PATH);

  const frontendCookieStart = source.indexOf("-Id 3");
  const backendCookieStart = source.indexOf("-Id 4");
  const navigateStart = source.indexOf("-Id 5");

  assert.ok(frontendCookieStart >= 0);
  assert.ok(backendCookieStart > frontendCookieStart);
  assert.ok(navigateStart > backendCookieStart);

  const frontendCookieBlock = source.slice(frontendCookieStart, backendCookieStart);
  const backendCookieBlock = source.slice(backendCookieStart, navigateStart);

  assert.ok(frontendCookieBlock.includes("url = $FrontendUrl"));
  assert.ok(frontendCookieBlock.includes('sameSite = "Lax"'));

  assert.ok(backendCookieBlock.includes("url = $BackendUrl"));
  assert.ok(backendCookieBlock.includes('sameSite = "None"'));
  assert.ok(backendCookieBlock.includes("secure = $true"));
});

test("local admin dashboard launcher never prints admin cookie value", () => {
  const source = read(ADMIN_LAUNCHER_PATH);

  const sensitiveOutputPatterns = [
    /\bWrite-Host\b[^\n]*\$adminCookie\.Value/,
    /\bWrite-Output\b[^\n]*\$adminCookie\.Value/,
    /\becho\b[^\n]*\$adminCookie\.Value/,
    /\bWrite-Verbose\b[^\n]*\$adminCookie\.Value/,
    /\bWrite-Debug\b[^\n]*\$adminCookie\.Value/,
  ];

  for (const pattern of sensitiveOutputPatterns) {
    assert.equal(pattern.test(source), false);
  }
});
