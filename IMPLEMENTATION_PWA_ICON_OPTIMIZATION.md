# PWA Icon Optimization

## Summary
- Optimized every PNG under `frontend/public/icons` with the existing `sharp` runtime.
- Reduced the four manifest installation icons from 326,906 bytes to 190,875 bytes (41.6%).
- Preserved icon dimensions, PNG compatibility, branding, standard icons, maskable icons, Apple touch support, and favicon support.

## Problem
- The 512x512 standard and maskable app icons were the largest PWA assets at 130,069 and 136,586 bytes.
- The icon set used full-color PNG encoding even though a high-quality indexed palette produces no visible change at install-icon sizes.
- Existing contracts checked asset presence but did not validate manifest paths, declared dimensions, MIME types, maskable purpose, or weight budgets.

## Scope
- Existing PWA, shortcut, Apple touch, favicon, and small static icon assets.
- Manifest icon metadata needed to make shortcut MIME types explicit.
- Static asset contracts and implementation documentation.

## Files changed
- `frontend/public/icons/*.png`
- `frontend/src/app/manifest.ts`
- `test/frontend-public-static-assets-contract.test.ts`
- `IMPLEMENTATION_PWA_ICON_OPTIMIZATION.md`

## Icon inventory before
| File | Dimensions | Bytes | Role |
|---|---:|---:|---|
| `icons/icon-16x16.png` | 16x16 | 1,022 | Small static icon |
| `icons/icon-32x32.png` | 32x32 | 2,110 | Metadata/favicon icon |
| `icons/icon-192x192.png` | 192x192 | 29,444 | Manifest standard and shortcut icon |
| `icons/icon-512x512.png` | 512x512 | 130,069 | Manifest standard install icon |
| `icons/maskable-icon-192x192.png` | 192x192 | 30,807 | Manifest maskable icon |
| `icons/maskable-icon-512x512.png` | 512x512 | 136,586 | Manifest maskable install icon |
| `icons/apple-touch-icon.png` | 180x180 | 26,610 | Apple touch icon |
| `favicon.ico` | ICO | 2,132 | Browser favicon |

## Icon inventory after
| File | Dimensions | Bytes | Delta | Role |
|---|---:|---:|---:|---|
| `icons/icon-16x16.png` | 16x16 | 671 | -351 (-34.3%) | Small static icon |
| `icons/icon-32x32.png` | 32x32 | 1,648 | -462 (-21.9%) | Metadata/favicon icon |
| `icons/icon-192x192.png` | 192x192 | 18,131 | -11,313 (-38.4%) | Manifest standard and shortcut icon |
| `icons/icon-512x512.png` | 512x512 | 75,825 | -54,244 (-41.7%) | Manifest standard install icon |
| `icons/maskable-icon-192x192.png` | 192x192 | 18,934 | -11,873 (-38.5%) | Manifest maskable icon |
| `icons/maskable-icon-512x512.png` | 512x512 | 77,985 | -58,601 (-42.9%) | Manifest maskable install icon |
| `icons/apple-touch-icon.png` | 180x180 | 15,975 | -10,635 (-40.0%) | Apple touch icon |
| `favicon.ico` | ICO | 2,132 | 0 (0%) | Browser favicon |

## Manifest compatibility
- Manifest paths and required 192x192 and 512x512 dimensions are unchanged.
- `purpose: "any"` and `purpose: "maskable"` entries are preserved.
- Shortcut icon entries now explicitly declare `type: "image/png"`.
- Apple touch metadata and `/favicon.ico` remain unchanged.
- The Next App Router manifest source remains `frontend/src/app/manifest.ts`, exposed as `/manifest.webmanifest`.

## Optimization method
- Used the repository's existing `sharp` 0.34.5 installation; no dependency was added.
- Encoded PNGs with compression level 9, adaptive filtering, a quality-100 indexed palette, effort 10, and dithering.
- Visual inspection of standard and maskable 512x512 icons showed no observable branding or layout change.
- Pixel comparison measured mean absolute channel deltas below 0.14 on a 0-255 scale.
- The source PNGs had alpha channels but no transparent pixels; optimized icons remain fully opaque, so no effective transparency was lost.

## Tests
- Manifest icon paths resolve to existing public files.
- PNG dimensions match each declared `sizes` value.
- MIME types and file extensions remain coherent.
- Standard and maskable purposes retain dedicated 192x192 and 512x512 assets.
- Apple touch, favicon, metadata icons, and the standalone 16x16 icon remain present.
- Weight budgets cover manifest, Apple touch, favicon, and small metadata icons.
- `og-vetneb.png` is explicitly excluded from the PWA icon budget.
- The Next manifest route remains wired to `/manifest.webmanifest`.

## Validation
- `pnpm test`
- `pnpm build`
- `pnpm security:public-surface`
- `pnpm --dir frontend lint`
- `pnpm --dir frontend typecheck`
- `pnpm --dir frontend build`

## Out of scope
- `frontend/public/images/og-vetneb.png` was measured at 398,916 bytes but not modified because it is the dedicated OpenGraph image from #985.
- The hero WebP, backend, dashboard, SEO/OpenGraph metadata, service worker behavior, cache strategy, copy, and visual design were not changed.
