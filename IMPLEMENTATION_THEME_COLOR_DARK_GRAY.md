# Theme Color Dark Gray Alignment

## Summary
- The browser and PWA theme color now follows the active Normal or Dark Gray visual mode.
- The existing pre-paint theme initialization remains synchronous and updates both `data-theme` and the existing Next metadata tag.

## Problem
- Next emitted a fixed institutional `theme-color` even when `data-theme="dark-gray"` was active.
- Mobile browser and installed PWA chrome could therefore remain navy while the page used the dark gray surface.

## Scope
- Theme metadata.
- Pre-hydration theme initialization.
- Theme toggle synchronization.
- Focused Playwright coverage.

## Files changed
- `frontend/src/lib/theme.ts`
- `frontend/public/theme-init.js`
- `frontend/src/components/theme/ThemeModeToggle.tsx`
- `frontend/e2e/theme-mode.spec.ts`
- `IMPLEMENTATION_THEME_COLOR_DARK_GRAY.md`

## Implementation
- Theme mode and browser color constants live in `frontend/src/lib/theme.ts`.
- Next viewport metadata continues to emit the normal institutional theme color.
- `/theme-init.js` applies the persisted mode and updates that tag before hydration and first paint.
- During startup, a short-lived `MutationObserver` removes the duplicate tag that Next can insert while reconciling pre-hydration metadata; it disconnects on window load.
- `ThemeModeToggle` uses the shared client helper to update `data-theme`, update the surviving tag, and remove any duplicate before persisting the mode.
- The web app manifest keeps its existing Normal installation and launch default.

## Theme-color policy
- Normal: `#0c354e`, the existing institutional navy.
- Dark Gray: `#1c1f21`, matching the rendered `hsl(210 8% 12%)` base background.

## Tests
- Normal mode exposes exactly one theme-color tag with the institutional value.
- Enabling Dark Gray updates the tag to the dark gray value.
- Returning to Normal restores the institutional value.
- A persisted Dark Gray preference applies `data-theme` and `theme-color` before hydration without hydration errors.
- The toggle keeps its `aria-pressed` state and accessible name contract.

## Validation
- `pnpm audit --prod` - PASS, no known vulnerabilities.
- `pnpm --dir frontend e2e theme-mode.spec.ts --project=chromium` - PASS, 2/2.
- `pnpm --dir frontend e2e theme-mode.spec.ts --project=chromium --repeat-each=3` - PASS, 6/6.
- `pnpm test` - PASS, 2671/2671.
- `pnpm build` - PASS.
- `pnpm security:public-surface` - PASS.
- `pnpm --dir frontend lint` - PASS.
- `pnpm --dir frontend typecheck` - PASS.
- `pnpm --dir frontend build` - PASS, 25/25 pages generated.

## Out of scope
- General visual redesigns or dashboard changes.
- Backend, contact API, pricing, role, or authentication changes.
- Open Graph images, PWA icons, and unrelated production-readiness work.
- New dependencies.
