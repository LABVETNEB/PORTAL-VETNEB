# Branded Not Found and OpenGraph Imagery

## Summary
- Added an institutional App Router not-found page for unknown public routes.
- Added a dedicated 1200x630 OpenGraph image and connected it to OpenGraph and Twitter metadata.
- Added contract and E2E coverage for the 404 experience, social metadata, asset response, responsive layout, and dark gray mode.

## Problem
- Unknown routes previously fell back to the framework not-found surface without VETNEB branding or useful public navigation.
- Social previews reused the homepage hero asset, which was not composed or dimensioned specifically for OpenGraph and Twitter cards.

## Scope
- Next App Router not-found page.
- Public layout reuse with the FAQ omitted only on the not-found page.
- Global OpenGraph and Twitter image metadata.
- Static social preview asset, focused tests, and implementation documentation.

## Files changed
- `frontend/src/app/not-found.tsx`
- `frontend/src/components/layout/PublicLayout.tsx`
- `frontend/src/lib/seo.ts`
- `frontend/public/images/og-vetneb.png`
- `frontend/e2e/public-routes.spec.ts`
- `test/frontend-public-not-found.test.ts`
- `test/frontend-public-static-assets-contract.test.ts`
- `test/frontend-seo-metadata.test.ts`
- `IMPLEMENTATION_BRANDED_NOT_FOUND_AND_OG.md`

## Not-found page
- Uses the global App Router `not-found.tsx` convention.
- Reuses the public navbar, theme control, skip control, and footer.
- Keeps one visible H1, institutional VETNEB identity, plain-language guidance, and CTAs to home, services, and contact.
- Relies on the App Router not-found behavior to emit an automatic `noindex` directive and does not call private APIs or expose internal details.

## OpenGraph imagery
- Asset: `/images/og-vetneb.png`
- Dimensions: 1200x630
- Format: optimized PNG
- Metadata: the shared SEO helper provides the URL, width, height, MIME type, and descriptive alt text.
- Twitter card: `summary_large_image` uses the same dedicated asset.

## Accessibility
- One H1 identifies the page.
- The existing main, banner, navigation, and contentinfo landmarks remain intact.
- CTAs have visible accessible names and keyboard focus treatment.
- Decorative layers and icons are hidden from assistive technology where appropriate.

## SEO / preview behavior
- Global OpenGraph and Twitter metadata point to the dedicated absolute image URL.
- Existing `metadataBase`, canonical helpers, robots policy, sitemap, and JSON-LD remain unchanged.
- Unknown routes are explicitly non-indexable.

## Tests
- Contract test for not-found structure, CTAs, branding, noindex metadata, and prohibited content.
- PNG contract for signature, dimensions, and file-size bounds.
- SEO metadata contract for dedicated image path, dimensions, MIME type, OpenGraph, and Twitter wiring.
- Playwright coverage for HTTP 404 status, H1, branding, CTAs, dark gray mode, mobile overflow, navigation, metadata uniqueness, and static asset response.

## Validation
- `pnpm test`: PASS, 2675/2675
- `pnpm --dir frontend e2e public-routes.spec.ts visual-smoke.spec.ts --project=chromium`
- `pnpm test`
- `pnpm build`
- `pnpm security:public-surface`
- `pnpm --dir frontend lint`
- `pnpm --dir frontend typecheck`
- `pnpm --dir frontend build`

Historical dashboard scope guardrails were updated with an exact exception for `frontend/src/lib/seo.ts`, because this PR intentionally changes public SEO/OpenGraph metadata and does not touch dashboard behavior.

## Out of scope
- Dashboard, backend, authentication, pricing, reports, contact API, PWA icon optimization, production observability, and broad public-page redesigns.
- New runtime or development dependencies.
