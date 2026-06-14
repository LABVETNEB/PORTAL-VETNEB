# Dashboard 401 Login Redirect

## Summary
- Dashboard Server Components now redirect to `/login` when a backend read returns HTTP 401.
- HTTP 403, 404, network failures, and 5xx responses keep their existing controlled error behavior.
- Missing clinic or admin session cookies are redirected by the existing dashboard proxy.

## Problem
- The proxy validated only whether the expected cookie was present.
- Expired, revoked, or invalid cookies reached server-rendered dashboard pages.
- API errors lost their HTTP status and were caught as generic load failures, leaving partial or error-state dashboard content visible.

## Scope
- Clinic dashboard, reports, logistics hub, logistics visits, logistics routes, and logistics metrics Server Components.
- Admin dashboard server reads.
- Shared frontend API error metadata and dashboard server auth handling.
- Existing dashboard proxy behavior for absent session cookies.
- Focused contract and Playwright coverage.

## Files changed
- `frontend/src/lib/api-error.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/dashboard-server-auth.ts`
- `frontend/src/proxy.ts`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/dashboard/admin/page.tsx`
- `frontend/src/app/dashboard/informes/page.tsx`
- `frontend/src/app/dashboard/logistica/page.tsx`
- `frontend/src/app/dashboard/logistica/visitas/page.tsx`
- `frontend/src/app/dashboard/logistica/rutas/page.tsx`
- `frontend/src/app/dashboard/logistica/metricas/page.tsx`
- `test/frontend-api-client-request.test.ts`
- `test/frontend-dashboard-middleware.test.ts`
- `test/frontend-dashboard-server-401-redirect.test.ts`
- `test/frontend-extreme-speed-guardrails.test.ts`
- `test/frontend-middleware.test.ts`
- `test/frontend-next-config-security-headers.test.ts`
- `test/global-auth-boundary-contract.test.ts`
- `frontend/e2e/dashboard-auth-redirect.spec.ts`

## Current behavior
- Missing clinic cookies redirected to login with a safe `next` path.
- Missing admin cookies returned 404.
- Present but invalid or expired cookies passed the proxy.
- Server-side API reads converted non-success responses to generic `Error` values.
- Dashboard pages caught those errors and rendered partial data or controlled load-error states, including for 401.

## New behavior
- API response errors retain their HTTP status in `ApiResponseError`.
- Dashboard Server Components call a server-only unauthorized handler before rendering fallback UI.
- A classified HTTP 401 redirects to the fixed `/login` route.
- Missing admin and clinic cookies follow the existing proxy login redirect.

## 401 handling
- Missing cookie: the dashboard proxy redirects to `/login?next=<requested-dashboard-path>`.
- Invalid, expired, or revoked cookie: the backend returns 401, the API client preserves status 401, and the Server Component redirects to `/login`.
- Backend error text is not rendered during this redirect flow.

## 403 / 500 behavior
- HTTP 403 is not classified as an authentication failure and does not redirect to login.
- HTTP 404 is not classified as an authentication failure.
- HTTP 5xx and network failures do not redirect to login.
- Existing controlled page error states remain responsible for non-401 failures.
- Report foreign-access behavior is unchanged.

## Loop prevention
- The proxy matcher remains limited to `/dashboard/:path*`; `/login` is not matched.
- Server-side redirects use the fixed `ROUTES.login` value and do not accept user-provided destinations.
- Proxy `next` values are derived from the requested same-origin dashboard URL.
- Login already validates `next` against internal clinic dashboard routes and rejects external or admin destinations for clinic sessions.

## Tests
- API error classification covers 401, 403, 500, and generic errors.
- Static contracts verify all server-rendered dashboard pages invoke the 401 handler.
- Proxy contracts verify clinic/admin missing-cookie redirects and absence of a login loop.
- Login contracts verify the existing open-redirect boundary.
- Focused Playwright coverage verifies unauthenticated `/dashboard` and `/dashboard/admin` reach a stable, normally rendered login page without technical 401 text.

## Validation
- `pnpm audit --prod`
- `pnpm test`
- `pnpm build`
- `pnpm security:public-surface`
- `pnpm --dir frontend lint`
- `pnpm --dir frontend typecheck`
- `pnpm --dir frontend build`
- `pnpm --dir frontend e2e dashboard-auth-redirect.spec.ts --project=chromium --workers=1`
- `pnpm --dir frontend e2e visual-smoke.spec.ts --project=chromium --workers=1`

## Out of scope
- Dashboard visual redesign.
- Role or permission changes.
- Backend authentication changes.
- Report foreign-access 404 behavior.
- SEO, PWA, pricing, contact, cookies, secrets, or dependencies.
- A new global authentication strategy or new middleware.
