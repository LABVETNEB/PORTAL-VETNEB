import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  ApiResponseError,
  getAdminAccessErrorState,
} from "../frontend/src/lib/api-error.ts";

const API_PATH = "frontend/src/lib/api.ts";
const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const ADMIN_CONTROLLER_PATH =
  "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx";
const ADMIN_ACCESS_STATE_PATH =
  "frontend/src/app/dashboard/admin/AdminAccessErrorState.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("admin access policy classifies only typed HTTP 401 and 403 errors", () => {
  assert.deepEqual(
    getAdminAccessErrorState(new ApiResponseError(401, "raw unauthorized")),
    {
      status: 401,
      title: "Sesión expirada",
      message:
        "Tu sesión de Administración expiró. Volvé a iniciar sesión para continuar.",
    },
  );
  assert.deepEqual(
    getAdminAccessErrorState(new ApiResponseError(403, "raw forbidden")),
    {
      status: 403,
      title: "Acceso restringido",
      message: "No tenés permisos suficientes para acceder a este módulo.",
      supportText: "Contactá a Administración si necesitás acceso.",
    },
  );
  assert.equal(
    getAdminAccessErrorState(new ApiResponseError(500, "backend unavailable")),
    null,
  );
  assert.equal(getAdminAccessErrorState(new Error("HTTP 401")), null);
  assert.equal(getAdminAccessErrorState({ status: 403 }), null);
});

test("admin 401 and 403 copy is uniform and excludes sensitive or technical detail", () => {
  const copy = [401, 403]
    .map((status) => {
      const state = getAdminAccessErrorState(
        new ApiResponseError(status, "cookie token stack Supabase JWT role_id permission_id"),
      );
      assert.ok(state);
      return [state.title, state.message, state.supportText].filter(Boolean).join(" ");
    })
    .join(" ");

  assert.doesNotMatch(
    copy,
    /cookie|token|stack|supabase|jwt|role_id|permission_id/i,
  );
  assert.doesNotMatch(copy, /HTTP\s*(401|403)|Unauthorized|Forbidden/i);
});

test("admin API normalizes 401 and 403 before reading backend error copy", () => {
  const source = read(API_PATH);
  const authGuardIndex = source.indexOf(
    "isAdminApiPath(path) && isAdminAccessErrorStatus(res.status)",
  );
  const backendBodyIndex = source.indexOf(
    "const body = (await res.json().catch(() => ({})))",
  );

  assert.ok(authGuardIndex >= 0);
  assert.ok(backendBodyIndex > authGuardIndex);
  assert.ok(source.includes("publishAdminAccessErrorStatus(res.status);"));
  assert.ok(source.includes("throw new ApiResponseError(res.status, accessState.message);"));
  assert.equal(
    source.includes("ADMIN_SCHEMA_HEALTH_UNAUTHORIZED_MESSAGE"),
    false,
  );
});

test("admin access state replaces the workspace instead of rendering an empty state", () => {
  const controllerSource = read(ADMIN_CONTROLLER_PATH);
  const stateSource = read(ADMIN_ACCESS_STATE_PATH);
  const pageSource = read(ADMIN_PAGE_PATH);

  assert.ok(controllerSource.includes("useSyncExternalStore"));
  assert.ok(controllerSource.includes("initialAccessErrorStatus"));
  assert.ok(
    controllerSource.includes(
      "accessErrorStatus ? (\n            <AdminAccessErrorState status={accessErrorStatus} />\n          ) : (\n            workspaces[activeModule]\n          )",
    ),
  );
  assert.ok(stateSource.includes('role="alert"'));
  assert.ok(stateSource.includes("ROUTES.login"));
  assert.equal(stateSource.includes("EmptyState"), false);
  assert.equal(stateSource.includes("error.message"), false);
  assert.ok(pageSource.includes("getAdminAccessErrorStatus(error)"));
  assert.ok(pageSource.includes("initialAccessErrorStatus={initialAccessErrorStatus}"));
});

test("server-side 401 redirect remains in force while 403 reaches the Admin state", () => {
  const pageSource = read(ADMIN_PAGE_PATH);

  assert.ok(pageSource.includes("redirectToLoginOnUnauthorized(error);"));
  assert.ok(pageSource.includes("accessErrorStatus: getAdminAccessErrorStatus(error)"));
  assert.ok(pageSource.includes("loadAdminSystemHealth(requestOptions)"));
});
