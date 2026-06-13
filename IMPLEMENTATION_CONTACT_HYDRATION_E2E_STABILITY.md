# Contact Hydration E2E Stability

## Summary
- Hardened the contact hydration E2E test against client hydration timing.
- Kept the assertions that the form accepts input and preserves controlled state.

## Problem
- CI reported one transient failure where `#nombre` was filled with `Ana` but later contained an empty value.
- The test started editing after `DOMContentLoaded`, while the server-rendered controls could be available before their React handlers were connected.

## Root cause hypothesis
- The contact fields are controlled by React state and are enabled in the server-rendered HTML.
- A fast E2E interaction can update the DOM before hydration connects `onChange`.
- When hydration commits the initial empty state, that early DOM-only value can be replaced.
- No loading fallback, data request, or conditional render was found around the form.
- A parallel `--repeat-each=5` run reproduced the timing window: all five form cases could click a client-only control before its React handler was connected.

## Scope
- Contact form hydration E2E behavior only.
- No production component or API behavior was changed.

## Files changed
- `frontend/e2e/contacto-hydration.spec.ts`
- `IMPLEMENTATION_CONTACT_HYDRATION_E2E_STABILITY.md`

## Test hardening implemented
- Wait for the contact heading and form to be visible.
- Retry the existing side-effect-free general inquiry action until its client-only hash navigation proves that hydration is connected.
- Locate form fields through their accessible labels.
- Require every field to be visible, enabled, editable, and initially empty.
- Assert each value immediately after filling it.
- Fill the optional clinic field as part of the controlled-state coverage.
- Recheck every value after the remaining field updates and an additional focus interaction.
- Keep the page error and hydration mismatch checks.
- Use no arbitrary sleeps or global timeout increases.

## What was not changed
- Contact form implementation, visuals, copy, and submission behavior.
- `/api/contact`, rate limiting, backend, dashboard, or unrelated public features.
- Dependencies or Playwright global configuration.

## Validation
- PASS: `pnpm --dir frontend e2e contacto-hydration.spec.ts --project=chromium` (2 tests).
- PASS: `pnpm --dir frontend e2e contacto-hydration.spec.ts --project=chromium --repeat-each=5` (10 tests).
- PASS: `pnpm --dir frontend e2e contacto-hydration.spec.ts public-navigation-footer.spec.ts visual-smoke.spec.ts --project=chromium` (19 tests).
- PASS: `pnpm test` (2671 tests).
- PASS: `pnpm build`.
- PASS: `pnpm security:public-surface`.
- PASS: `pnpm --dir frontend lint`.
- PASS: `pnpm --dir frontend typecheck`.
- PASS: `pnpm --dir frontend build`.
- PASS: `pnpm audit --prod` (no known vulnerabilities).

## Remaining risk
- The original failure is timing-dependent, so the exact CI scheduling sequence is not reproducible on demand.
- The hydration barrier relies on an existing client-only hash navigation contract that is covered by the same public contact page.

## Out of scope
- Production observability and unrelated frontend or backend work.
- Functional changes to prevent users from interacting with server-rendered controls before hydration.
