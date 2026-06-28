# feat(auth): add dashboard password change UI

## Summary
- Added dashboard UI for clinic password change.
- Added dashboard UI for admin password change.
- Reused the frontend API clients merged in PR #1003
  (`changeClinicPassword` / `changeAdminPassword`).
- Single reusable client component selected by a serializable `variant` prop, so
  the server pages stay free of function props and direct `fetch`.

## Scope
Files changed:
- `frontend/src/components/dashboard/PasswordChangePanel.tsx` (new) — reusable
  "Seguridad" card with the password-change form and all client state.
- `frontend/src/app/dashboard/page.tsx` — renders `<PasswordChangePanel
  variant="clinic" />` inside the existing `perfil` (account) workspace, next to
  the public-profile card. No new module/navigation added.
- `frontend/src/app/dashboard/admin/page.tsx` — renders `<PasswordChangePanel
  variant="admin" />` inside the existing `admin-sessions` (access) workspace,
  next to the sessions card.
- `test/frontend-dashboard-password-change-ui.test.ts` (new) — static contract
  tests for both surfaces.
- `IMPLEMENTATION_NOTES/feat-auth-dashboard-password-change-ui.md` (new) — this
  note.

Out of scope (intentionally untouched):
- Backend endpoints / `server/**` (endpoints exist since PR #1002).
- Reset password / email-password recovery.
- Particular auth (token-backed, no password-change contract).
- Dependencies / `package.json` / `pnpm-lock.yaml`.
- Broad dashboard redesign, new navigation, new modules, layout changes.
- PWA / service worker / FlexSearch / public pages / GitHub workflows.

## Placement decision
The dashboard uses a module/workspace hub. Rather than adding a new module
(which would mean new navigation across controllers, hubs and sidebars), the
security card is embedded in the most natural existing workspace per role:
- clinic → `perfil` (the account/profile area),
- admin → `admin-sessions` (the access/security area).
The clinic `<ClinicPublicProfileCard />` and admin `<AdminSessionsReadOnlyCard />`
and `id="admin-sessions"` anchor are preserved, so existing dashboard contracts
remain green.

## UX
- "Seguridad" card titled per the suggested copy, subtitle "Actualizá tu
  contraseña de acceso sin cerrar tu sesión actual."
- Three labelled password fields: current, new, confirmation.
- States: idle, submitting ("Actualizando..."), success, validation error,
  generic server error.
- Submit button "Actualizar contraseña", disabled while submitting.
- Success keeps the current session active (no logout) and clears the fields.
- Success/error are exposed through accessible live regions
  (`aria-live="polite"` + `role="status"` for success; `aria-live="assertive"` +
  `role="alert"` for errors).

## Validation rules (client-side, aligned to backend)
- Required: current, new and confirmation must be present.
- New password minimum 8 characters (backend minimum).
- Confirmation must match the new password.
- New password must differ from the current one.
- Only `{ currentPassword, newPassword }` is sent; `confirmPassword` never leaves
  the component.

## Security
- No `localStorage` / `sessionStorage` / `document.cookie`; passwords live only in
  component state during interaction.
- No password logging (no `console.*` in the component or touched pages).
- No password in query params or URLs; submission goes through the shared
  `apiFetch` POST body via the existing clients.
- Backend failures collapse to one generic, non-enumerative message; the catch
  does not branch on backend error details.
- No tokens/hashes exposed; particular auth remains excluded (no UI, no client).

## Validation
Commands run on branch `feat/auth-dashboard-password-change-ui` (results):
- `pnpm --dir frontend lint` -> PASS (exit 0)
- `pnpm --dir frontend typecheck` -> PASS (exit 0)
- `pnpm --dir frontend build` -> PASS (exit 0)
- `pnpm test` -> PASS (2749 passed, 0 failed)
- `pnpm typecheck:test` -> PASS (exit 0)
- `pnpm security:public-surface` -> PASS (no public devtools exposure findings;
  only pre-existing `server-only` markers in `frontend/src/proxy.ts`)
- `git diff --check` -> clean (exit 0)

## Risk
Low/medium. UI only, using existing API clients. No backend, schema, dependency
or navigation changes.

## Rollback
Revert this PR.

## CI follow-up
- Investigated the Frontend CI failure in `frontend/e2e/public-routes.spec.ts`
  ("unknown route renders the branded not-found page ..."), which is unrelated to
  the password-change scope (the PR diff does not touch the not-found page or any
  public navigation).
- Root cause: the branded not-found CTAs navigate via an `onClick` handler
  (`PublicRouteControl` → `router.push`), which only runs after React hydrates.
  The test clicked "Contactar"/"Volver al inicio" immediately after a
  `domcontentloaded` navigation, so the click raced hydration and was lost
  (URL stayed on the unknown route). "Ver servicios" passed only because many
  awaited assertions preceded it, giving hydration time.
- The repo intentionally forbids `next/link` and `<a>` in frontend source
  (public navigation hardening contract), so the product stays on the
  button + `router.push` pattern. Fix is test-only: wrap the not-found CTA
  navigations in the suite's established hydration-safe `toPass` retry
  (mirrors `frontend/e2e/contacto-hydration.spec.ts`).
- No backend, dependency, product or password-flow scope changes.

### CI follow-up validation
- `pnpm --dir frontend lint` -> PASS
- `pnpm --dir frontend typecheck` -> PASS
- `pnpm --dir frontend build` -> PASS
- `pnpm --dir frontend exec playwright test e2e/public-routes.spec.ts
  --project=chromium` -> PASS (9/9, including the previously failing not-found
  test)
- `pnpm test` -> PASS (2749 passed, 0 failed; navigation-hardening contracts
  stay green)
- `pnpm typecheck:test` -> PASS
- `pnpm security:public-surface` -> PASS
