import {
  ADMIN_SESSION_COOKIE_NAME,
  CLINIC_SESSION_COOKIE_NAME,
  DEFAULT_PARTICULAR_SESSION_COOKIE_NAME,
} from "../../shared/session-cookie-names.ts";

// Particular session cookie resolution.
//
// Unlike clinic and admin, this boundary never crosses into the Next proxy, so it stays
// configurable through PARTICULAR_COOKIE_NAME and existing deployments keep working. The
// risk that configurability reintroduces is a collision: pointing particular at the
// clinic or admin cookie would let one boundary clobber another. That is rejected here,
// at resolution time, so an invalid configuration fails the process at startup instead
// of degrading a session boundary at runtime.
//
// Kept as a pure function in its own module — not inside `env.ts` — so the contract can
// be tested directly without executing the full environment schema or mutating
// process.env across tests.

/** Matches the `emptyToUndefined` preprocessing applied by the environment schema. */
function normalizeOverride(rawValue: string | undefined): string | undefined {
  if (typeof rawValue !== "string") {
    return undefined;
  }

  const trimmed = rawValue.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * Resolve the particular session cookie name, rejecting any value that collides with a
 * fixed boundary. Throws on collision; returns the default when unset or blank.
 */
export function resolveParticularSessionCookieName(
  rawValue: string | undefined,
): string {
  const resolved =
    normalizeOverride(rawValue) ?? DEFAULT_PARTICULAR_SESSION_COOKIE_NAME;

  for (const [boundary, fixedName] of [
    ["clinic", CLINIC_SESSION_COOKIE_NAME],
    ["admin", ADMIN_SESSION_COOKIE_NAME],
  ] as const) {
    if (resolved === fixedName) {
      throw new Error(
        `PARTICULAR_COOKIE_NAME no puede ser "${resolved}": ese nombre pertenece a la sesión de ${boundary}. ` +
          "Cada frontera de sesión debe usar una cookie distinta.",
      );
    }
  }

  return resolved;
}
