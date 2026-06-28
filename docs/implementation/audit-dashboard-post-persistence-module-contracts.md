# audit(dashboard): post-persistence module contracts

Audit-only review of the dashboard last-active-module persistence shipped in PR #997 and locked by
PR #998. No code, tests, configuration, dependencies or backend were modified.

- Base: `main` @ `3405367 test(dashboard): lock persisted module contracts (#998)`, in sync with
  `origin/main`, no open PRs, no unmerged remote branches.
- Branch: `audit/dashboard-post-persistence-module-contracts`.

## Executive summary
**Verdict: APTO para avanzar (fit to proceed).** The persistence feature is correctly scoped,
loop-safe, role-separated, validates all restored values, and stores only a non-sensitive module id
under an audited `localStorage` allowlist. No High/Medium findings. All findings are Low/Info and
none block further work. A short acceptance-gate checklist (below) should be kept green before
larger features (FlexSearch, password change, visual redesign, navigation changes).

## Current behavior reviewed
- **Admin dashboard** — `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx`
  - State + guards: `lines 131-136` (`activeModule`, `hasRestoredLastModule` ref,
    `hasManuallyReturnedToHub`).
  - URL→state sync: `138-140`. Persist: `142-145`. Restore: `147-156`.
  - `activateModule` push: `158-164`. `backToHub` replace + manual flag: `166-170`.
- **Clinic dashboard** — `frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx`
  - Mirror of admin: state/guards `92-97`, sync `99-101`, persist `103-106`, restore `108-119`,
    `activateModule` `121-127`, `backToHub` `129-133`.
- **Storage helper** — `frontend/src/lib/dashboard-last-module.ts`
  - Role-separated keys `vetneb:dashboard:last-module:{clinic,admin}`; `read`/`write` guard
    `typeof window === "undefined"` and wrap access in `try/catch`. Dependency-free.
- **Security contract** — `test/auth-cookie-persistence-contract.test.ts`
  - Frontend `localStorage`/`sessionStorage` ban with an explicit UI-preference allowlist; the helper
    is allowlisted by its key markers and re-checked against `session/auth/cookie/token`.
- **Test coverage** — `test/frontend-dashboard-last-module.test.ts`
  - 9 tests: runtime helper behavior (SSR null, getItem-throws null, setItem-throws no-throw,
    round-trip + role isolation, exact keys), non-sensitive storage, admin/clinic navigation
    contracts (URL priority, invalid-ignore, replace-only, no-loop guard, hub accessible, no
    `localStorage` literal in controllers), and a client-side-only scope guard.

## Findings

| ID | Severity | Area | Finding | Evidence | Recommendation | Suggested PR |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Info | Navigation loops | Restore is idempotent and loop-safe: `hasRestoredLastModule` ref + early-return when a `module` param is already present; uses `router.replace`, not `push`. After restore, `searchParams` carries `module`, so the effect no-ops. | Admin `147-156`; Clinic `108-119` | None — keep as-is. | — |
| A2 | Low | URL priority / query params | The restore target is built as `?module=<id>` only, overwriting any other query params present on a no-module entry (e.g. a hand-typed `/dashboard/admin?event=x` with no module). In-app audit links always include `module=audit-log`, so real-world impact is negligible. | Admin `155`; Clinic `116-118`; `page.tsx buildAdminAuditFilterHref` always sets `module` | If future no-module deep-links can carry meaningful params, merge them into the restore URL instead of replacing. | Only if such links appear |
| A3 | Low | Auth/session lifecycle | Last-module keys are not cleared on logout (explicit deferral in #997). A later same-role login on the same browser restores the previous session's last module. The stored value is a non-sensitive id and module content remains server-authorized, so this is a minor UX/privacy nuance, not a data exposure. | Helper keys; `feat-dashboard-persist-last-module.md` ("Logout no necesita borrar storage") | Optional: clear both keys from a centralized logout hook if/when one exists. | Low-priority follow-up |
| A4 | Info | Hub accessibility | A cold visit with a stored module always restores it; the hub is reached only via explicit "Volver a módulos" (sets manual flag + replace to base). There is no guaranteed clean-hub landing on cold load when a last module exists — by design (friction reduction). | Admin `148, 166-170`; Clinic `109, 129-133` | If a future feature needs a guaranteed hub landing, add an explicit bypass (e.g. `?hub=1`) rather than changing the default. | Gate item |
| A5 | Info | localStorage security | Only a validated module id is stored. Tampered/unknown values are rejected by `parseModuleFromUrl` before being placed in the URL, so a poisoned `localStorage` cannot inject arbitrary URLs / open redirects. Keys are role-separated and allowlisted. | Admin `150-153`; Clinic `111-114`; `auth-cookie-persistence-contract.test.ts` allowlist | None. | — |
| A6 | Info | UX (cold load) | Brief hub flash before the client-side restore (SSR renders hub; the effect then `router.replace`s to the module). | Restore runs in `useEffect` (client only) | Acceptable. Do NOT move the storage read into render (hydration mismatch risk). | — |
| A7 | Info | PWA / cache | No service worker or cache-policy change; `/dashboard/*` stay `ƒ Dynamic` and uncached; `localStorage` is outside SW cache scope. | No SW/manifest files touched by #997/#998 | None. | — |

## Risk analysis
- **Navigation loops** — None. Double guard (ref + module-present) + `replace` makes restore a
  single, idempotent transition (A1).
- **Hub accessibility** — Preserved via explicit return; only nuance is no clean-hub cold landing
  by design (A4).
- **URL priority** — Correct: any `module` param (even invalid) suppresses restore; valid URL wins
  over storage. Minor sibling-param overwrite edge (A2).
- **Invalid storage** — Fully handled: unknown/tampered values rejected by `parseModuleFromUrl`;
  missing/disabled storage returns `null` and shows the hub.
- **Role separation** — Enforced by distinct keys and asserted cross-absence in tests; clinic users
  cannot reach `/dashboard/admin` anyway (middleware/cookies).
- **Browser history** — Healthy: restore and `backToHub` use `replace` (no extra entries, no back
  trap); `activateModule` uses `push` so card clicks are individually back-navigable.
- **localStorage security** — Non-sensitive payload, validated on read, allowlisted (A5).
- **Auth/cookie/session invariants** — Untouched: no session logic, no `redirectToLoginOnUnauthorized`
  change, no cookie/middleware change. Logout-clear deferred (A3).
- **PWA/cache** — No impact (A7).

## Acceptance gates before larger features
Keep all green before FlexSearch, password change, visual redesign or navigation changes:
- [ ] `localStorage`/`sessionStorage` ban + UI-preference allowlist still enforced
      (`auth-cookie-persistence-contract.test.ts`); any new client preference must be allowlisted with
      its own key markers and pass the `session/auth/cookie/token` guard.
- [ ] All `localStorage` access stays centralized in `dashboard-last-module.ts` (controllers contain
      no `localStorage` literal).
- [ ] Restore stays `replace`-only and guarded (no `push`, no loops); URL `?module=` keeps priority.
- [ ] Admin/clinic keys remain separate; only validated module ids are persisted.
- [ ] `/dashboard/*` remain `ƒ Dynamic` and uncached; no service worker change.
- [ ] `pnpm test`, `pnpm typecheck:test`, `pnpm --dir frontend {lint,typecheck,build}`,
      `pnpm security:public-surface` all green.

## Recommended next PRs (by value / risk)
1. **(Optional, Low) Clear last-module keys on logout** — only if a centralized logout hook exists;
   addresses A3. Test-light, low risk.
2. **(Optional, Low) Preserve sibling query params on restore** — only if a real no-module deep-link
   with params emerges; addresses A2.
3. **Larger features (FlexSearch / password change / visual redesign)** — each in its own scoped PR,
   gated by the checklist above. These remain out of scope here and were explicitly excluded in the
   prior PR series.

## Out of scope
This PR is **audit-only**. No source, tests, `package.json`, `pnpm-lock.yaml`, backend, server,
database, APIs, public routes, CSS or configuration were modified. The only artifact is this
implementation note.

## Validation
- `git diff --stat` → only this note (no tracked-file changes).
- `git diff --check` → OK.
- `git status --short --untracked-files=all` → single untracked note file.
(No lint/build/test run needed: audit-only, zero code/test changes.)

## Final verdict
**APTO para avanzar.** The post-persistence module contracts are correct, secure and well-tested.
Proceed with the optional Low follow-ups (A2/A3) opportunistically and keep the acceptance-gate
checklist green when introducing larger features.
