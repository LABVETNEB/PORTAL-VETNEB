import { test, type BrowserContext, type Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// E2E-GLOBAL-07 — single source of truth for E2E session setup and app origin.
//
// Every session cookie a spec sets goes through this file: the cookie names,
// the synthetic values and the origin they are scoped to live here and nowhere
// else under frontend/e2e. Guarded by
// test/architecture/e2e-session-origin-source-of-truth.test.ts.
//
// The two profiles are NOT interchangeable, which is why they stay separate:
// - `populated`: the exact values the hermetic fixture API
//   (fixtures/admin-populated-api-server.mjs, POPULATED_*_SESSION) answers with
//   its deterministic datasets.
// - `default`: a present session cookie the app's navigation proxy accepts, but
//   the fixture recognises no data for it: its data routes answer 404
//   "E2E populated session required". Specs on this profile measure the shell
//   over empty/error states or install their own `page.route` mocks.
//
// The E2E-GLOBAL-03 boundary values (e2e_boundary_*) are owned by the fixture's
// BOUNDARY_SESSIONS table and stay next to the platform/auth specs that probe
// it, as do their raw `Cookie:` header contracts.
// ─────────────────────────────────────────────────────────────────────────────

export type SessionRole = "admin" | "clinic";
export type SessionProfile = "default" | "populated";

export type AppCookie = { readonly name: string; readonly value: string };

export const SESSION_COOKIE_NAMES = Object.freeze({
  admin: "admin_session_id",
  clinic: "app_session_id",
  particular: "particular_session_id",
} as const);

const SESSION_COOKIE_VALUES: Readonly<
  Record<SessionRole, Readonly<Record<SessionProfile, string>>>
> = Object.freeze({
  admin: Object.freeze({
    default: "e2e_test_admin_session",
    populated: "e2e_populated_admin_session",
  }),
  clinic: Object.freeze({
    default: "e2e_test_clinic_session",
    populated: "e2e_populated_clinic_session",
  }),
});

// The particular portal specs intercept /api/particular/auth/* with
// page.route(), so this value is never validated: the cookie only documents the
// real transport contract (apiFetch uses credentials: "include").
const PARTICULAR_SESSION_COOKIE_VALUE = "e2e_test_particular_session";

export function sessionCookie(role: SessionRole, profile: SessionProfile): AppCookie {
  return Object.freeze({
    name: SESSION_COOKIE_NAMES[role],
    value: SESSION_COOKIE_VALUES[role][profile],
  });
}

/** `name=value`, for API requests that carry the session as a raw header. */
export function sessionCookieHeader(role: SessionRole, profile: SessionProfile): string {
  const { name, value } = sessionCookie(role, profile);
  return `${name}=${value}`;
}

/**
 * The origin every app cookie is scoped to, derived from the effective
 * `use.baseURL` of the running project (playwright.config.ts). Only callable
 * while a test or hook is running.
 */
export function resolveAppOrigin(): string {
  const { baseURL } = test.info().project.use;
  if (!baseURL) {
    throw new Error("E2E session setup requires use.baseURL in playwright.config.ts");
  }
  return new URL(baseURL).origin;
}

/** Adds app-scoped cookies (sessions and fixture opt-in cookies) in one call. */
export async function addAppCookies(
  target: Page | BrowserContext,
  cookies: readonly AppCookie[],
): Promise<void> {
  const context = "addCookies" in target ? target : target.context();
  const url = resolveAppOrigin();
  await context.addCookies(cookies.map(({ name, value }) => ({ name, value, url })));
}

export function setSession(
  target: Page | BrowserContext,
  role: SessionRole,
  profile: SessionProfile,
): Promise<void> {
  return addAppCookies(target, [sessionCookie(role, profile)]);
}

export function setAdminSession(
  target: Page | BrowserContext,
  profile: SessionProfile,
): Promise<void> {
  return setSession(target, "admin", profile);
}

export function setClinicSession(
  target: Page | BrowserContext,
  profile: SessionProfile,
): Promise<void> {
  return setSession(target, "clinic", profile);
}

export function setParticularSession(target: Page | BrowserContext): Promise<void> {
  return addAppCookies(target, [
    { name: SESSION_COOKIE_NAMES.particular, value: PARTICULAR_SESSION_COOKIE_VALUE },
  ]);
}
