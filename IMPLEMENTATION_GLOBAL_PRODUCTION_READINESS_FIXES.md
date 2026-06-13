# Global Production Readiness Fixes

## Scope

Fixes seguros derivados de la auditoría global (`AUDIT_GLOBAL_PRODUCTION_READINESS.md`).
Rama: `audit/global-production-readiness` (base `a9041ac`).
Se implementa **solo** el defecto de alto impacto verificado (H1) más su guardrail; el resto se documenta como backlog diferido para no mezclar cambios de mayor riesgo.

## Files changed

- `frontend/src/components/layout/Navbar.tsx` — breakpoint del navbar desktop `lg` → `xl`.
- `test/frontend-public-layout-navigation.test.ts` — contrato alineado al diseño corregido (`xl`) + guard anti-regresión `p-1 lg:flex === false`.
- `frontend/e2e/public-navigation-footer.spec.ts` — guardrail e2e de overflow a 1024/1180px + verificación de nav desktop a 1280px.

## Fixes implemented

### H1 — Overflow horizontal en rutas públicas (1024–1279px)

**Causa raíz:** el navbar activa el layout desktop completo (logo + tagline + pill de 6 enlaces + theme toggle + 2 CTAs ≈ 1147px) en el breakpoint `lg` (1024px), pero el `container` de Tailwind queda topado en `max-width:1024px` hasta `xl` (1280px). La fila del navbar excede el contenedor en ~123px. El `overflow-x: clip` del `.public-perspective-stage` solo envuelve `<main>`, no el `<header>` (hermano), por lo que el overflow llega al documento.

**Fix:** desplazar las tres clases estructurales del navbar de `lg` a `xl`:
- wrapper del menú mobile: `relative lg:hidden` → `relative xl:hidden`
- cluster del logo: `… lg:flex` → `… xl:flex`
- tagline "Patología veterinaria": `lg:inline` → `xl:inline`
- pill de navegación: `… p-1 lg:flex` → `… p-1 xl:flex`

Entre 1024–1279px se reutiliza el menú hamburguesa ya existente y testeado (mismo layout que a 768px); a ≥1280px (`xl`, donde el contenido entra) se muestra el navbar desktop completo.

**Evidencia (Playwright, Chromium):**

| Viewport | Antes (`docOverflow`) | Después |
|---|---|---|
| 375 / 768 | 0 | 0 |
| 1024 | **123** | **0** |
| 1180 | **45** | **0** |
| 1280 / 1440 | 0 | 0 |

(5 rutas: `/`, `/servicios`, `/precios`, `/clinicas`, `/contacto`.)

### M2 — Guardrail de regresión

Añadido a `public-navigation-footer.spec.ts`:
- `public routes have no horizontal overflow at 1024px / 1180px` (4 rutas) — falla si reaparece el overflow.
- `desktop navbar pill becomes visible at xl width` — asegura que el navbar desktop sigue apareciendo a ≥1280px.

## Why these fixes were safe

- **Sin lógica de negocio ni datos:** solo clases responsive en un componente de layout.
- **Reusa UI ya validada:** el menú hamburguesa para 1024–1279 ya estaba testeado (e2e a 375/768).
- **No rompe tests existentes:** `visual-smoke` usa 1440/390 (fuera del rango); el e2e desktop de nav corre a 1280 (=`xl`, nav visible); el contrato se alineó al nuevo breakpoint (precedente de alineación de guards en-PR, #958).
- **Fuera de paths bloqueados:** `components/layout/Navbar.tsx` no está en las listas de los tripwires legacy de scope (que bloquean `app/login`, `app/contacto`, `server/`, `next-env.d.ts`, etc.).
- **Sin dependencias nuevas, sin migraciones, sin tocar auth/cookies/middleware/producción.**
- **`next-env.d.ts` revertido** tras el e2e (el dev server lo regenera) → working tree limpio.

## Validation

| Comando | Resultado |
|---|---|
| `pnpm audit --prod` | PASS (sin vulnerabilidades) |
| `pnpm test` | PASS — 2657/2657 |
| `pnpm build` | PASS |
| `pnpm security:public-surface` | PASS |
| `pnpm --dir frontend lint` | PASS |
| `pnpm --dir frontend typecheck` | PASS |
| `pnpm --dir frontend build` | PASS |
| e2e `public-navigation-footer.spec.ts` (incl. guardrails 1024/1180/1280) | PASS |
| Probe multi-viewport (375–1440 × 5 rutas) | `docOverflow=0` en todos |

> La tabla refleja la **validación final** ejecutada tras los cambios (ver sección de cierre del reporte). 

## Out of scope

- Sin rediseño grande (solo cambio de breakpoint del navbar).
- Sin cambios de negocio ni de pricing.
- Sin cambios de auth/sesiones/cookies/middleware.
- Sin migraciones ni cambios de DB.
- Sin nuevas dependencias.
- Skip link (M1), `theme_color` dark (M3), 404 con marca (L1), robots/sitemap (L2), gating de warnings (L3), perspective scroll (PR-26): **diferidos** como PRs propios (ver backlog en la auditoría).

## Git

No se ejecutó `git add`, `git commit`, `git push`, `gh pr create`, `gh pr checks --watch` ni merge. El cierre manual (stage/commit/push/PR) queda para Nico según protocolo.
