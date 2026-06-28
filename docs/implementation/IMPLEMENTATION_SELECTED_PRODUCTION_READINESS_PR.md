# Selected Production Readiness Implementation

## Implemented PR

`fix(a11y): add skip to main content link`

## Why this PR

This change adds the WCAG 2.4.1 bypass mechanism to every public page that uses
`PublicLayout`. It is narrowly scoped, additive, and compatible with the
project's public-navigation contract.

## Modified files

- `frontend/src/components/public/SkipToContent.tsx`
- `frontend/src/components/layout/PublicLayout.tsx`
- `frontend/src/app/globals.css`
- `test/frontend-public-skip-link-contract.test.ts`
- `frontend/e2e/public-navigation-footer.spec.ts`
- `AUDIT_PRODUCTION_READINESS_PR_BACKLOG.md`
- `IMPLEMENTATION_SELECTED_PRODUCTION_READINESS_PR.md`

## Safety

- The control is a client-side `<button type="button">`, not a raw anchor or
  `next/link`.
- Activation temporarily adds `tabindex="-1"` to `#main-content`, moves focus,
  scrolls the landmark into view, and removes the temporary attribute on blur.
- The server-rendered layout does not retain a permanent `tabIndex`.
- The component reads the DOM only from its activation handler, avoiding SSR
  and hydration differences.
- Styling uses existing theme tokens, has no transition, remains offscreen
  until focus, and is constrained to the viewport width.
- The change adds no dependencies and does not alter institutional copy,
  private layouts, navbar behavior, or footer behavior.

## Why the other backlog PRs were not implemented

The requested scope selects only the skip-to-content change. Rate limiting,
theme color, branded 404, OpenGraph assets, PWA icon optimization, dashboard
session handling, report authorization semantics, production observability,
contact hydration hardening, and visual redesign remain separate backlog work
to avoid mixing unrelated behavior and risk.

## Validation

- `pnpm audit --prod`: passed, no known vulnerabilities.
- Focused skip-link contract: 5/5 passed.
- Public devtools exposure contract: 9/9 passed.
- `pnpm --dir frontend lint`: passed.
- `pnpm --dir frontend typecheck`: passed.
- Focused `public-navigation-footer.spec.ts` Chromium run: 7/7 passed.
- `pnpm test`: 2663/2663 passed.
- `pnpm build`: passed.
- `pnpm security:public-surface`: passed with no public exposure findings.
- `pnpm --dir frontend build`: passed.
- Relevant Chromium run for navigation, visual smoke, and theme mode: 19/19
  passed.
- `git diff --check`: passed.

The first full root test run observed `frontend/next-env.d.ts` rewritten by the
preceding Next development server to `.next/dev/types/routes.d.ts`. The
protocol-required artifact restoration returned it to the tracked production
path, after which all 2663 tests passed.

## Remaining risks

The implementation is limited to pages using `PublicLayout`. Private dashboard
layouts are intentionally unchanged. Browser-level keyboard behavior is
covered in Chromium; the native button activation model supplies equivalent
Enter and Space semantics in other modern browsers.
