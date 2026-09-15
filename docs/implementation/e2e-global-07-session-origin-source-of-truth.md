# E2E-GLOBAL-07 — Fuente única del setup de sesión y del origen

Fase `E2E-GLOBAL-07` del programa `LIMPIEZA E2E` (`docs/audit/LIMPIEZA E2E.md` §24). Problemas
P2-1 / P2-5, riesgos R-11 / R-17. Cambio test-only, mecánico, sin cambio observable de
comportamiento; criterio de aceptación: mismo conjunto de tests descubiertos antes y después.

## Estado base

| Ítem | Valor |
|---|---|
| Rama | `test/e2e-global-07-session-origin-source-of-truth` |
| HEAD base | `886f19eea376c88e33286776ad29ee235be3b1d1` (`test(e2e): close P1 execution gap (#1725)`) |
| Working tree inicial | limpio |
| Clasificación | R1 (edición local test-only in-scope) |
| Scope primario (`pr-governance`) | `frontend` (`frontend/e2e/**`); `test/**` y `docs/**` son categorías de soporte → sin mixed-scope |

## Scope

Incluido: `frontend/e2e/helpers/session.ts` (nuevo), migración de specs/helpers de `frontend/e2e/**`,
guard `test/architecture/e2e-session-origin-source-of-truth.test.ts` (nuevo), este documento.

Excluido (deliberadamente): `frontend/src/**`, `server/**`, DB, `package.json`, `pnpm-lock.yaml`,
workflows, snapshots, `frontend/e2e/suites/catalog.ts`, el fixture
`frontend/e2e/fixtures/admin-populated-api-server.mjs` (semántica intacta), los literales del origen del
fixture API `127.0.0.1:3107` (no derivan de `use.baseURL`), `GLOBAL-08+`.

## Baseline recalculado (HEAD `886f19ee`)

Las cifras históricas del roadmap (92 `addCookies`, 88 literales, 67 archivos) no se reutilizaron; se
recontaron con `git grep` sobre `frontend/e2e`:

| Métrica | Histórico | HEAD `886f19ee` |
|---|---:|---:|
| `addCookies` (líneas / archivos) | 92 / 67 | 94 / 73 |
| `http://127.0.0.1:3000` (líneas / archivos) | 88 / ~67 | 92 / 75 |
| `admin_session_id` (líneas / archivos) | — | 48 / 40 |
| `app_session_id` (líneas / archivos) | — | 64 / 51 |
| `particular_session_id` (líneas / archivos) | — | 2 / 1 |
| `e2e_test_*` (líneas / archivos) | 35 | 43 / 30 |
| `e2e_populated_*` (líneas / archivos) | 32 | 52 / 40 |
| Specs físicos / catálogo | 95 | 98 / 98 |
| Tests descubiertos (`playwright test --list`) | 1.322 | 1.334 en 98 archivos |

Clasificación de los 92 literales de origen: 74 `url: "http://127.0.0.1:3000"` de setup de cookies,
15 constantes `APP_ORIGIN`/`ORIGIN` usadas sólo como `url` de cookies (y un `new URL(route, APP_ORIGIN).pathname`
en A03), 1 payload del fixture (`cors_origins`), 1 payload mockeado de health en
`visual-regression-stress`, 1 URL del servidor en `scripts/visual-production-candidate.config.mjs`.

Implementaciones duplicadas de setup: ~55 funciones locales por spec más
`admin-mobile-contracts.ts` (`setAdminSessionCookie`/`setTestAdminSession`/`setPopulatedAdminSession`),
`particular-session-contracts.ts` (`setParticularSessionCookie`), `mobile-parity-matrix.ts`
(`PARITY_SESSION_COOKIE`/`setParitySession`), `dashboard-geometry-matrix.ts`
(`DASHBOARD_GEOMETRY_SESSION_COOKIE`) y `dashboard-adaptive-limit-matrix.ts` (`A03_*_SESSION_COOKIE`).

## Mapeo semántico de perfiles

Seguido hasta el fixture (`admin-populated-api-server.mjs`) y el producto:

- `e2e_populated_admin_session` / `e2e_populated_clinic_session`: únicos valores con dataset poblado
  (`isPopulatedAdminRequest` / `isPopulatedClinicRequest` comparan el literal exacto).
- `e2e_test_*`: el proxy de navegación acepta la cookie por presencia; el fixture no reconoce datos para
  el valor y responde `404 "E2E populated session required"`. Specs como
  `dashboard-clinic-module-state-parity` **dependen** de ese estado (asertan estados de error).
- `e2e_boundary_*`: tabla `BOUNDARY_SESSIONS` del fixture (401/403); pertenece a los specs de
  `platform/auth`.
- `frontend/src/**` no lee el valor de ninguna cookie (sólo presencia de nombre).

Conclusión: `default` y `populated` son **semánticamente distintos** y se preservan como perfiles
separados. La fuente única define cada perfil una vez; no se unificaron valores.

Única normalización de valor: `admin-clinic-edit-drawer.spec.ts` usaba `admin_session_id=e2e_test_session`
(variante sin rol). Pertenece al perfil `default` de admin: el fixture sólo distingue los literales
`POPULATED_*`/`BOUNDARY_*` y el spec mockea sus endpoints con `page.route`, así que `e2e_test_session` y
`e2e_test_admin_session` recorren la misma rama (404) y el mismo gate de proxy. Pasa a
`setAdminSession(page, "default")`; sus 12 tests pasan en la muestra runtime.

## Diseño de `frontend/e2e/helpers/session.ts`

```ts
type SessionRole = "admin" | "clinic";
type SessionProfile = "default" | "populated";

SESSION_COOKIE_NAMES                       // admin_session_id | app_session_id | particular_session_id
sessionCookie(role, profile)               // { name, value }
sessionCookieHeader(role, profile)         // "name=value" para requests API con header crudo
resolveAppOrigin()                         // new URL(test.info().project.use.baseURL).origin
addAppCookies(pageOrContext, cookies)      // única llamada a addCookies() bajo frontend/e2e
setSession(pageOrContext, role, profile)
setAdminSession(pageOrContext, profile)
setClinicSession(pageOrContext, profile)
setParticularSession(pageOrContext)
```

- El perfil es obligatorio en cada llamada: ningún spec hereda un perfil implícito.
- Acepta `Page` o `BrowserContext` (los specs B04/B05/B06/B08/CMP-12 crean contextos con
  `browser.newContext()`).
- `addAppCookies` mantiene cookies de opt-in del fixture en la **misma** llamada que la sesión
  (`e2e_a03_adaptive_pagination`, long-text), preservando orden y atomicidad.

### Origen

`resolveAppOrigin()` usa `test.info().project.use.baseURL` (tipado en Playwright 1.63.0:
`TestInfo.project: FullProject`, `FullProject.use: UseOptions<PlaywrightTestOptions…>` con
`baseURL?: string`). Falla cerrado si falta `baseURL`. `new URL(baseURL).origin` produce exactamente
`http://127.0.0.1:3000`, el mismo `url` que antes recibía `addCookies`. No se creó ninguna constante
nueva con el literal. Limitación conocida: no refleja un `test.use({ baseURL })` por spec; hoy no existe
ninguno bajo `frontend/e2e`.

### Registros existentes que se conservan

`DASHBOARD_GEOMETRY_SESSION_COOKIE` (A02) y `A03_ADMIN/CLINIC_SESSION_COOKIE` (A03) siguen exportados
(sus consumidores los usan como registro por rol), pero sus valores se derivan de
`sessionCookie(role, "populated")`.

`mobile-parity-matrix.ts` **no** puede importar `./session`: `test/architecture/clinic-mobile-admin-parity-census.test.ts`
lo importa a nivel node (`--experimental-strip-types`) y node no resuelve imports TS sin extensión.
Por eso `PARITY_SESSION_COOKIE`/`setParitySession` se retiraron (único consumidor migrado a
`setSession(page, role, "populated")`).

## Excepciones deliberadas

| Archivo | Qué conserva | Motivo |
|---|---|---|
| `platform/auth/session-boundary-forbidden-role.spec.ts` | Sin cambios: 8 headers `Cookie:` crudos, `e2e_test_clinic_session` como sesión no reconocida, `BOUNDARY_*` | La vinculación nombre↔valor de cookie **es** el contrato de seguridad; ocultarla en un helper reduciría claridad |
| `platform/auth/dashboard-session-boundary-unauthorized.spec.ts` | Header crudo `app_session_id=${BOUNDARY_EXPIRED_CLINIC_SESSION}` y la constante `BOUNDARY_*` | Probe de expiración a nivel fixture; el setup de navegación sí pasa a `addAppCookies` |
| `fixtures/admin-populated-api-server.mjs` | Nombres, `POPULATED_*`, `BOUNDARY_*`, `cors_origins` | Extremo servidor del mismo contrato; semántica del fixture fuera de scope. El guard verifica que `session.ts` y `POPULATED_*` coinciden |
| `regression/visual/visual-regression-stress.spec.ts` | 1 literal `127.0.0.1:3000` | Dato del payload mockeado de system-health renderizado en el baseline |
| `scripts/visual-production-candidate.config.mjs` | 1 literal `127.0.0.1:3000` | Config del runner (URL del servidor de aplicación), no setup de sesión |
| `admin/users/*-fixture-pagination`, `platform/auth/*`, A03 | `127.0.0.1:3107` | Origen del fixture API, no del `baseURL`; fuera de GLOBAL-07 |

## Guard

`test/architecture/e2e-session-origin-source-of-truth.test.ts` (corre en `pnpm test` / `backend-ci`, que
se dispara con cualquier cambio no-docs). Recorre el filesystem de `frontend/e2e` (no `git ls-files`,
para detectar specs aún no stageados) y exige:

1. `addCookies(` sólo en `helpers/session.ts` (exactamente 1).
2. `127.0.0.1:3000`/`localhost:3000` sólo en las 2 excepciones de datos/config (1 cada una).
3. Valores `e2e_(test|populated|boundary)_*session` sólo en `session.ts` (5) y en los 2 specs de contrato
   crudo (5 y 1).
4. Nombres `admin_session_id|app_session_id|particular_session_id` sólo en `session.ts` (3) y en los 2
   specs de contrato crudo (13 y 1).
5. El fixture está exento de 2–4 pero sus `POPULATED_*` deben coincidir con el perfil `populated`.
6. `session.ts` deriva el origen de `test.info().project.use` y `playwright.config.ts` declara `baseURL`.

Las excepciones quedan fijadas por conteo exacto: no pueden crecer en silencio. Incluye un test en
memoria que rechaza cada regresión (addCookies, origen, valor, nombre, excepción que crece).

## Archivos

- Nuevo: `frontend/e2e/helpers/session.ts`, `test/architecture/e2e-session-origin-source-of-truth.test.ts`,
  este documento.
- Helpers modificados (5): `admin-mobile-contracts.ts`, `dashboard-adaptive-limit-matrix.ts`,
  `dashboard-geometry-matrix.ts`, `mobile-parity-matrix.ts`, `particular-session-contracts.ts`.
- Specs modificados (81): los consumidores de setup de sesión en `admin/**` (19), `clinic/**` (26),
  `particular/**` (3), `platform/**` (16; `session-boundary-forbidden-role.spec.ts` sin cambios) y
  `regression/**` (17).
- Diff tracked: 86 archivos, +324 / −1083 líneas (sin contar los 3 archivos nuevos).

## Before / after

| Métrica (tracked, `frontend/e2e`, excluye `session.ts`) | Antes | Después |
|---|---:|---:|
| `addCookies` (líneas / archivos) | 94 / 73 | 0 / 0 (1 llamada en `session.ts`) |
| `127.0.0.1:3000` (líneas / archivos) | 92 / 75 | 3 / 3 (excepciones) |
| `admin_session_id` (líneas / archivos) | 48 / 40 | 9 / 2 (fixture + forbidden-role) |
| `app_session_id` (líneas / archivos) | 64 / 51 | 13 / 3 (fixture + 2 specs de contrato) |
| `particular_session_id` (líneas / archivos) | 2 / 1 | 0 / 0 |
| `e2e_test_*` (líneas / archivos) | 43 / 30 | 1 / 1 (forbidden-role) |
| `e2e_populated_*` (líneas / archivos) | 52 / 40 | 2 / 1 (fixture) |
| Tests descubiertos | 1.334 en 98 archivos | 1.334 en 98 archivos — lista idéntica (títulos + archivos, sin nº de línea) |
| Catálogo | 98 entradas; ci 66, extended 27, evidence 2, visual-linux 3, full 98; smoke 12, admin-mobile 14, visual-contract 23, public-clinic 17; manual-only 0 | idéntico |

## Validaciones

| Gate | Estado | Evidencia |
|---|---|---|
| `playwright test --list` antes/después | PASSED | 1.334 / 1.334, `diff` de listas normalizadas vacío |
| `node --test test/architecture/e2e-session-origin-source-of-truth.test.ts` | PASSED | 4/4 |
| Prueba negativa del guard en disco (3 mutaciones temporales sobre `dashboard-adaptive-rows.spec.ts`) | PASSED | `addCookies` duplicado, origen hardcodeado y valor sintético: cada una exit 1 con la violación exacta; archivo restaurado con sha256 idéntico |
| Tests node que leen/importan las fuentes tocadas (23 archivos) | PASSED | 245/245 |
| `pnpm --dir frontend lint` | PASSED | exit 0; `eslint e2e` 0 errores / 0 warnings antes y después |
| `pnpm --dir frontend typecheck` | PASSED | exit 0 |
| `pnpm typecheck:test` | PASSED | exit 0 |
| `pnpm --dir frontend e2e:verify-catalog` | PASSED | 7/7, antes y después |
| Muestra runtime Playwright (`next dev`, 2 workers) | PASSED | 72/72: admin default (edit drawer 12), admin populated (B13 12, logout 5), clinic default+populated (module state parity 14), particular (zoom sentinel 1), multi-cookie (action bar 6), headers de fixture (4+4), `BrowserContext` (B08 dark-gray 1), frontera negativa (forbidden-role 8, unauthorized 4, cross-role 1) |
| Equivalencia de perfiles por archivo (HEAD vs worktree) | PASSED | los 86 archivos preservan su conjunto (rol, perfil) |
| Cohortes E2E completas / `e2e:full` | NOT_RUN | Cambio mecánico de setup; lista, catálogo, guard, tipos y muestra runtime por perfil cubren el riesgo (AGENTS.md §7) |
| `pnpm --dir frontend build`, `security:public-surface` | NOT_RUN | Sin cambios en `frontend/src/**` ni en el bundle |
| `pnpm test` / `validate:local` completo | NOT_RUN | Local sin DB falla por 03B (preexistente); se ejecutaron los tests node dirigidos |

## Rollback

Revertir el commit. No hay migraciones, dependencias ni artefactos persistentes; el fixture y el
producto no cambian.

## Riesgo residual

- `resolveAppOrigin()` refleja el `use.baseURL` del proyecto, no un `test.use({ baseURL })` por spec
  (inexistente hoy).
- Los specs A02/A03/A05, B04/B05/B06 completos y visuales Linux no se ejecutaron en runtime local; su
  cambio es la sustitución del registro de cookies por `addAppCookies`, verificada por tipos, lista y
  la muestra de `BrowserContext`. `E2E Completeness` los ejecuta en el PR.
- Los conteos fijados del guard obligan a realinearlo cuando cambie una excepción deliberada (intencional).
- `admin-clinic-edit-drawer` pasa de `e2e_test_session` a `e2e_test_admin_session` (misma rama del fixture;
  verificado en runtime).

## Estado final

GLOBAL-07 implementado localmente. Git/GitHub (stage, commit, push, PR) queda a cargo de Nico.
