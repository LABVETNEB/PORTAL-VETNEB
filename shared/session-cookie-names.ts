// Session cookie name contract — the single source of truth for the two boundaries
// that cross the backend/proxy border.
//
// Clinic and admin are consumed by BOTH `server/lib/env.ts` and the Next proxy
// (`frontend/src/proxy.ts`), which are separately deployed services. They used to be
// declared independently — the backend resolved them from optional env vars, the proxy
// hardcoded the literals — so they agreed only because a literal happened to match a
// default. Renaming the cookie on the backend service silently broke the proxy
// boundary. For those two the name is a protocol contract between two services, not a
// per-deploy setting, so it is fixed here and owned by nobody else.
//
// The particular boundary does NOT cross this border: it is consumed only inside the
// backend and never by the proxy. It therefore stays configurable via
// PARTICULAR_COOKIE_NAME, with this module supplying only its default. Its collision
// check lives in `server/lib/session-cookie-names.ts`, next to the resolution it
// guards, so no backend-only logic ships in the proxy bundle.
//
// This module must stay dependency-free and side-effect-free: it is imported by the
// backend bundle (esbuild) and by the Next proxy. It must never reach a client bundle,
// and must never import `server/lib/env` or any node-only API.

export const CLINIC_SESSION_COOKIE_NAME = "app_session_id";
export const ADMIN_SESSION_COOKIE_NAME = "admin_session_id";

/** Default only: the effective particular name is resolved from the environment. */
export const DEFAULT_PARTICULAR_SESSION_COOKIE_NAME = "particular_session_id";

/** The two boundaries whose names are fixed by contract, in declaration order. */
export const FIXED_SESSION_COOKIE_NAMES = [
  CLINIC_SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
] as const;
