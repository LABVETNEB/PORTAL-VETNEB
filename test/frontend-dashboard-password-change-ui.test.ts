import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PANEL_PATH =
  "frontend/src/components/dashboard/PasswordChangePanel.tsx";
const CLINIC_PAGE_PATH = "frontend/src/app/dashboard/page.tsx";
const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const API_CLIENT_PATH = "frontend/src/lib/api.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function countOccurrences(source: string, marker: string): number {
  return source.split(marker).length - 1;
}

function getFunctionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);

  if (start === -1) {
    return "";
  }

  const braceStart = source.indexOf("{", start);
  let depth = 0;

  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(braceStart, index + 1);
      }
    }
  }

  return source.slice(braceStart);
}

test("password change panel reuses both merged API clients mapped by variant", () => {
  const source = read(PANEL_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("changeAdminPassword,"));
  assert.ok(source.includes("changeClinicPassword,"));
  assert.ok(source.includes("type ChangePasswordInput,"));
  assert.ok(source.includes("type ChangePasswordResponse,"));
  assert.ok(source.includes('} from "@/lib/api";'));

  // Variant maps to the matching authenticated client.
  assert.ok(source.includes("clinic: changeClinicPassword,"));
  assert.ok(source.includes("admin: changeAdminPassword,"));
});

test("clinic dashboard wires the panel with the clinic variant", () => {
  const source = read(CLINIC_PAGE_PATH);

  assert.ok(
    source.includes(
      'import { PasswordChangePanel } from "@/components/dashboard/PasswordChangePanel";',
    ),
  );
  assert.ok(source.includes('<PasswordChangePanel variant="clinic" />'));
  // The existing public profile card is preserved in the same workspace.
  assert.ok(source.includes("<ClinicPublicProfileCard />"));

  // PR #1005: the security panel is surfaced above the public profile card so
  // it is visible immediately when the perfil workspace opens.
  assert.ok(
    source.indexOf('<PasswordChangePanel variant="clinic" />') <
      source.indexOf("<ClinicPublicProfileCard />"),
    "clinic password panel must render before the public profile card",
  );

  // No new "Seguridad" module/navigation is introduced; the panel stays inside
  // the existing perfil workspace.
  assert.equal(source.toLowerCase().includes('"seguridad"'), false);
});

test("admin dashboard wires the panel with the admin variant", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(
    source.includes(
      'import { PasswordChangePanel } from "@/components/dashboard/PasswordChangePanel";',
    ),
  );
  assert.ok(source.includes('<PasswordChangePanel variant="admin" />'));
  // The existing sessions card and its anchor are preserved.
  assert.ok(source.includes("<AdminSessionsReadOnlyCard />"));
  assert.ok(source.includes('id="admin-sessions"'));

  // PR #1005: the security panel is surfaced above the sessions card so it is
  // visible immediately when the admin-sessions workspace opens.
  assert.ok(
    source.indexOf('<PasswordChangePanel variant="admin" />') <
      source.indexOf("<AdminSessionsReadOnlyCard />"),
    "admin password panel must render before the sessions card",
  );

  // No new "Seguridad" admin module/navigation is introduced; the panel stays
  // inside the existing admin-sessions workspace.
  assert.equal(source.toLowerCase().includes('"seguridad"'), false);
});

test("no clinic, admin or particular password change leaks to public/particular surfaces", () => {
  const panel = read(PANEL_PATH);
  const apiClient = read(API_CLIENT_PATH);

  // No particular password-change UI surface exists.
  assert.equal(panel.toLowerCase().includes("particular"), false);
  assert.equal(panel.includes("changeParticularPassword"), false);

  // No particular password-change client exists in the API layer.
  assert.equal(apiClient.includes("changeParticularPassword"), false);
  assert.equal(
    apiClient.includes("/api/particular/auth/change-password"),
    false,
  );
});

test("password change form exposes the three required password fields", () => {
  const source = read(PANEL_PATH);

  assert.ok(source.includes("Contraseña actual"));
  assert.ok(source.includes("Nueva contraseña"));
  assert.ok(source.includes("Confirmar nueva contraseña"));

  assert.ok(source.includes('name="currentPassword"'));
  assert.ok(source.includes('name="newPassword"'));
  assert.ok(source.includes('name="confirmPassword"'));

  // Exactly three password inputs, no more.
  assert.equal(countOccurrences(source, 'type="password"'), 3);
});

test("password fields use the correct autocomplete tokens", () => {
  const source = read(PANEL_PATH);

  assert.ok(source.includes('autoComplete="current-password"'));
  // Both the new password and its confirmation use the new-password token.
  assert.equal(countOccurrences(source, 'autoComplete="new-password"'), 2);
});

test("submit sends only currentPassword and newPassword, never the confirmation", () => {
  const source = read(PANEL_PATH);
  const handlerBody = getFunctionBody(
    source,
    "async function handleSubmit(",
  );

  assert.ok(handlerBody.includes("PASSWORD_CHANGE_HANDLERS[variant]({"));
  assert.ok(
    handlerBody.includes("currentPassword: formState.currentPassword,"),
  );
  assert.ok(handlerBody.includes("newPassword: formState.newPassword,"));

  // The confirmation never leaves the component (no payload field for it).
  assert.equal(
    handlerBody.includes("confirmPassword: formState.confirmPassword"),
    false,
  );
  assert.equal(handlerBody.includes("confirmPassword:"), false);
});

test("password change enforces the required, length, match and difference rules", () => {
  const source = read(PANEL_PATH);
  const validationBody = getFunctionBody(
    source,
    "function getValidationError(",
  );

  assert.ok(validationBody.includes("!state.currentPassword"));
  assert.ok(validationBody.includes("!state.newPassword"));
  assert.ok(validationBody.includes("!state.confirmPassword"));
  assert.ok(validationBody.includes("state.newPassword.length < MIN_PASSWORD_LENGTH"));
  assert.ok(validationBody.includes("state.newPassword !== state.confirmPassword"));
  assert.ok(validationBody.includes("state.newPassword === state.currentPassword"));
  assert.ok(source.includes("const MIN_PASSWORD_LENGTH = 8;"));
});

test("success keeps the session, resets fields and shows the non-sensitive message", () => {
  const source = read(PANEL_PATH);
  const handlerBody = getFunctionBody(
    source,
    "async function handleSubmit(",
  );

  assert.ok(source.includes('"Contraseña actualizada correctamente."'));
  assert.ok(handlerBody.includes("setFormState(INITIAL_FORM_STATE);"));
  assert.ok(handlerBody.includes("setStatusMessage(SUCCESS_MESSAGE);"));

  // No logout / session teardown on success.
  assert.equal(source.includes("logout"), false);
  assert.equal(source.includes("setUser(null)"), false);
});

test("backend errors collapse to a single generic non-enumerative message", () => {
  const source = read(PANEL_PATH);
  const handlerBody = getFunctionBody(
    source,
    "async function handleSubmit(",
  );

  assert.ok(
    source.includes(
      '"No pudimos cambiar la contraseña. Verificá los datos e intentá nuevamente."',
    ),
  );
  assert.ok(handlerBody.includes("} catch {"));
  assert.ok(handlerBody.includes("setErrorMessage(GENERIC_ERROR_MESSAGE);"));

  // The catch must not branch on backend error details (no enumeration).
  assert.equal(handlerBody.includes("error.message"), false);
  assert.equal(handlerBody.includes("instanceof"), false);
});

test("success and error regions are accessible live regions", () => {
  const source = read(PANEL_PATH);

  assert.ok(source.includes('aria-live="polite"'));
  assert.ok(source.includes('role="status"'));
  assert.ok(source.includes('aria-live="assertive"'));
  assert.ok(source.includes('role="alert"'));
});

test("submit button reflects loading and disabled states", () => {
  const source = read(PANEL_PATH);

  assert.ok(source.includes('type="submit"'));
  assert.ok(source.includes("disabled={isSubmitting}"));
  assert.ok(source.includes("Actualizando..."));
  assert.ok(source.includes("Actualizar contraseña"));
});

test("password change UI never persists or logs sensitive material", () => {
  for (const path of [PANEL_PATH, CLINIC_PAGE_PATH, ADMIN_PAGE_PATH]) {
    const source = read(path);

    assert.equal(source.includes("localStorage"), false, `${path} localStorage`);
    assert.equal(
      source.includes("sessionStorage"),
      false,
      `${path} sessionStorage`,
    );
    assert.equal(
      source.includes("document.cookie"),
      false,
      `${path} document.cookie`,
    );
    assert.equal(
      /console\.(log|warn|error|info)/.test(source),
      false,
      `${path} console logging`,
    );
  }
});

test("password change UI stays frontend-only with no backend or dependency reach", () => {
  const panel = read(PANEL_PATH);

  for (const forbidden of ["server/", "/api/auth", "/api/admin", "fetch("]) {
    assert.equal(
      panel.includes(forbidden),
      false,
      `panel must not reach ${forbidden} directly`,
    );
  }
});
