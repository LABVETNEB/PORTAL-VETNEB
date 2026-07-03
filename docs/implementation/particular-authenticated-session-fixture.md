# R-17 — Fixture e2e de sesión Particular autenticada (token-gated)

- **Rama:** `test/particular-authenticated-session-fixture`
- **Base:** `main` @ `43023d7` (feat(clinic): derive tokens fetch limit from adaptive superset, #1279)
- **Fecha:** 2026-07-03
- **Tipo:** e2e / test-only. **Visual: NO.**
- **Documento rector:** `docs/audit/final-global-vetneb-50-60-pr-roadmap.md` — FASE 3 (Particular, R-17..R-19).

## Hueco original

El rol Particular (`/particulares`) nunca tuvo un fixture e2e de sesión autenticada. El baseline previo (#1214 / `public-routes.spec.ts`, suites `PR-PUX1` y `PR-PUX4`) sólo cubre la entrada **pública no autenticada**: hero, acción primaria y ausencia de overflow horizontal antes de ingresar el token. El estado autenticado del rol —panel de sesión, seguimiento del estudio, informe— nunca había sido validado por e2e.

## Fixture creado

Dos archivos nuevos, siguiendo el patrón ya establecido para sesiones admin/clínica (`frontend/e2e/helpers/admin-mobile-contracts.ts`):

- [`frontend/e2e/helpers/particular-session-contracts.ts`](../../frontend/e2e/helpers/particular-session-contracts.ts) — helper reutilizable: cookie de sesión, mocks de los dos endpoints que `ParticularesContent` consulta al montar, datos mock tipados según los contratos de `frontend/src/types/index.ts` y `frontend/src/lib/api.ts`, y el contrato de medición no-scroll.
- [`frontend/e2e/particular-authenticated-session-fixture.spec.ts`](../../frontend/e2e/particular-authenticated-session-fixture.spec.ts) — spec dirigido con 2 tests.

## Ruta cubierta

`/particulares` (`frontend/src/app/particulares/page.tsx` → `PublicLayout` → `ParticularesContent`), en su **estado autenticado**.

## Contrato de autenticación simulado

`ParticularesContent` no usa `localStorage`. La sesión es 100% cookie-based vía `apiFetch()` (`credentials: "include"`, ver `frontend/src/lib/api.ts:250-254`); el frontend nunca lee la cookie directamente, sólo confía en que el backend la setea/valida. Al montar, el componente llama `getParticularSession()` (`GET /api/particular/auth/me`) y, si hay sesión, `getParticularStudyTrackingCase()` (`GET /api/particular/study-tracking/me`).

El fixture simula esto en dos capas, replicando el patrón admin/clínica:

1. **Cookie** `particular_session_id` (nombre real del backend: `server/lib/env.ts` → `PARTICULAR_COOKIE_NAME`, default `"particular_session_id"`) seteada vía `page.context().addCookies()`. Documenta el contrato real, aunque su valor no es validado server-side en el fixture (ver punto 2).
2. **Interceptación client-side** con `page.route()` sobre los dos endpoints anteriores, devolviendo un `ParticularAuthResponse` y un `AdminStudyTrackingCaseSummary` mock con `route.fulfill()`. Esto es lo que efectivamente "autentica" la sesión en el fixture — no depende de un servidor mock real ni de datos productivos.

No se creó backend, API, ni servidor mock nuevo (`e2e/fixtures/admin-populated-api-server.mjs` no fue tocado ni extendido).

## Endpoints interceptados

| Método | Endpoint | Respuesta mock |
|---|---|---|
| `GET` | `**/api/particular/auth/me` | `{ success: true, particular: MOCK_PARTICULAR_SESSION }` |
| `GET` | `**/api/particular/study-tracking/me` | `{ success: true, trackingCase: MOCK_PARTICULAR_TRACKING_CASE }` |

`MOCK_PARTICULAR_SESSION` incluye un informe vinculado (`report` no nulo) para ejercitar también el estado "informe disponible" (`data-particulares-report-state="available"`), y `MOCK_PARTICULAR_TRACKING_CASE.currentStage = "delivered"`. Ningún dato proviene de la base productiva; todos los IDs/textos son sintéticos.

## Viewports cubiertos

- **390×844** (`iphone-standard-390x844`) — mínimo mobile crítico exigido por R-17, único viewport cubierto.
- Tablet: **no agregado**. La suite de `/particulares` (`public-routes.spec.ts`) tampoco cubre tablet hoy; no había convención existente que extender sin inventar una nueva, así que se mantuvo fuera de scope.

## Assertions de contenido autenticado

- `[data-particular-session-panel="true"]` visible.
- Texto "Sesión particular activa" visible.
- `[data-particular-mobile-safe-summary="true"]` visible con `tutorLastName`/`petName` del mock.
- `[data-particular-mobile-flat-card="tracking"]` visible con el label de etapa ("Informe disponible / Publicado").
- `[data-particular-mobile-flat-card="report"][data-particulares-report-state="available"]` visible, con botones "Ver informe" / "Descargar".
- Botón "Cerrar sesión particular" visible.
- El formulario de token (`#particular-token`) **no** está presente (confirma que no quedó el estado no-autenticado).

## Assertions no-scroll (baseline)

Se midió el contrato no-scroll real en 390×844 con el fixture autenticado, usando Playwright headless directo (no forma parte del spec, medición exploratoria puntual):

```json
{ "html": { "scrollHeight": 3159, "clientHeight": 844 },
  "body": { "scrollHeight": 3159, "clientHeight": 3159 } }
```

El documento **sí scrollea verticalmente** (~2315px de contenido por encima del viewport): hero informativo colapsado (`hidden lg:block` cuando hay sesión) igual deja panel de sesión + tracking + informe + próximos pasos + header/footer públicos, que no fueron diseñados para caber en un viewport mobile. Ese ajuste a `100dvh` es **exactamente el objetivo declarado de R-18** ("sub-contrato F completo en `/particulares` autenticado: `100dvh` + safe-area + touch ≥44px + estados loading/empty/error estables"), no de R-17.

Por eso el contrato no-scroll que quedó en el spec (`assertParticularNoScrollContract`) sólo afirma lo que **ya es cierto hoy** y no requiere ningún fix de producción:

- `document.documentElement.scrollWidth <= clientWidth + 1px` (sin overflow horizontal).
- `document.body.scrollWidth <= clientWidth + 1px` (sin overflow horizontal).
- Ningún elemento dentro de `[data-particulares-hero="true"]` tiene `overflow-x`/`overflow-y` computado en `auto`/`scroll` (sin contenedores internos scrolleables no declarados).

No se afirma `scrollHeight <= clientHeight` (fit de página completa en un viewport) porque **no es cierto hoy** y R-17 tiene prohibido corregir UI (contrato punto 11). Afirmarlo habría producido un test frágil/rojo o forzado un fix de producción fuera de scope.

## Validaciones ejecutadas

- `git diff --check` — sin conflictos de whitespace.
- `pnpm test` — guardrails PR-N por diff.
- `pnpm typecheck:test` — OK.
- `pnpm typecheck` — OK.
- `pnpm --dir frontend lint` — OK.
- `pnpm --dir frontend build` — OK.
- `pnpm --dir frontend exec playwright test particular-authenticated-session-fixture.spec.ts --project=chromium` — **2/2 passed**.

## Confirmaciones de scope

- **Test-only.** No se modificó `frontend/src/**` (producción), backend/API/DB, CI/workflows, dependencias/lockfiles, snapshots, `globals.css`, ni superficies Admin/Clínica/Público.
- No se avanzó R-18 (polish viewport-fit) ni R-19 (timeline del caso).
- No se corrigieron los defectos visuales detectados (overflow vertical en mobile autenticado); quedan documentados arriba para R-18.

## Qué queda para R-18

- Ajustar `frontend/src/components/public/ParticularesContent.tsx` para que el estado autenticado en mobile quepa en `100dvh` (safe-area, touch ≥44px, estados loading/empty/error estables), según el sub-contrato F del roadmap.
- Una vez resuelto, extender `assertParticularNoScrollContract` (o el spec de R-17) para exigir también `scrollHeight <= clientHeight`, alineándolo con el patrón usado en los shells de Admin/Dashboard (`admin-mobile-contracts.ts`).
