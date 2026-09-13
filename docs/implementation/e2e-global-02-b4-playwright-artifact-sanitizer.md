# E2E-GLOBAL-02 / B-4 — Frontera de sanitización de artefactos Playwright

Prerrequisito de `B-4` del programa `LIMPIEZA E2E` (`docs/audit/LIMPIEZA E2E.md`,
`E2E-GLOBAL-02`). Establece una frontera fail-closed entre la salida raw de Playwright y
`actions/upload-artifact`. **No** cierra `B-4`: `trace` sigue en `"on-first-retry"` y el cambio a
`"retain-on-failure"` es un PR config-only posterior y separado.

## Estado base

| Ítem | Valor |
|---|---|
| Rama base | `main` |
| HEAD base | `1fc76c08c720d571743f652d2ec289171e9a616d` |
| Asunto | `test(e2e): harden Playwright failure diagnostics (#1715)` |
| Relación con `origin/main` | `0 0` |
| `git status` inicial | sólo `frontend/AGENTS.md` y `frontend/CLAUDE.md` untracked (generados por `next dev`) |
| Playwright | `@playwright/test` / `playwright-core` `1.63.0` |
| Clasificación | R2 (CI/workflows) |

## Scope incluido

- `scripts/security/playwright-artifact-sanitizer.mjs` (+ `.d.mts`): sanitizer y validador
  independiente, sin dependencias.
- Paso de sanitización y gate de upload en los tres workflows que suben salida Playwright:
  `frontend-ci.yml`, `e2e-completeness.yml`, `visual-regression-manual.yml`.
- Guard nuevo `test/unit/infrastructure/playwright-artifact-sanitizer.test.ts` y realineación in-PR
  de los contratos que anclan esos workflows y de sus digests canónicos (`AGENTS.md` §4).

## Scope excluido

- `frontend/playwright.config.ts` (read-only): `trace: "on-first-retry"`,
  `screenshot: "only-on-failure"`, `forbidOnly: isCi`, `failOnFlakyTests: true` sin cambios.
- Activar `trace: "retain-on-failure"` (PR config-only posterior).
- Specs, catálogo, fixtures, `frontend/src/**`, `server/**`, dependencias, lockfile, auth, DB,
  snapshots, settings de GitHub, `E2E-GLOBAL-05B` y `E2E-GLOBAL-06`.

## Auditoría previa (harness sintético aislado)

Harness fuera de `frontend/e2e` (no entra al censo del catálogo), con config propia, servidor HTTP
local y canarios sintéticos ensamblados en runtime para que el source del spec (que Playwright
embebe en el trace) no los contenga. Ejecutado con `retain-on-failure` y con
`on-first-retry` + `retries=1` **sólo en la config del harness**.

Hallazgos sobre salida real 1.63.0, inspeccionando contenido descomprimido:

1. `trace.zip` vive en `test-results/<test>[-retryN]/trace.zip` y el HTML report guarda una copia
   byte-idéntica en `playwright-report/data/<sha1>.zip`. El report también copia
   `error-context.md` y los screenshots a `data/`.
2. `playwright-report/index.html` embebe el modelo del report como ZIP base64 dentro de
   `<template id="playwrightReportBase64">`; sus títulos de steps contienen valores crudos
   (`Fill "<valor>"`, `Type "<valor>"`, subtítulos con query string).
3. Miembros del ZIP: `test.trace`, `N-trace.trace`, `N-trace.network` (JSONL, un evento por línea),
   `N-trace.stacks` (JSON), `resources/<sha1>.<ext>` (bodies de request/response y documentos
   HTML), `src/<sha1>.ts` (source del spec), `screencast/*.jpeg`, `attachments/<sha1>`.
4. Ubicación de material sensible:

| Clase | Campo real |
|---|---|
| Cookie (addCookies) | `N-trace.trace` › `before:BrowserContext.addCookies` › `params.cookies[].value` |
| Authorization / x-api-key (extra headers) | `before:BrowserContext.setExtraHTTPHeaders` › `params.headers[].value`; `N-trace.network` › `request.headers[].value` |
| Cookie / Set-Cookie | `N-trace.network` › `request/response.headers[].value` y `cookies[].value`; `after` de `storageState` › `result.cookies[].value` |
| Proxy-Authorization / Cookie (APIRequestContext) | `0-trace.trace` › `before:APIRequestContext.fetch` › `params.headers[].value` y **texto libre** de eventos `log` |
| Bodies | `resources/*.json`; `params.jsonData`; `postData._file` / `content._file` |
| Query tokens | `params.url`, `request.url`, `queryString[].value`, header `Referer`, subtítulos y logs |
| Valores tipeados | `params.value` / `params.text`, logs, títulos de `test.trace` y del report |
| Inputs hidden/password | `frame-snapshot` › `snapshot.html` › `value` / `__playwright_value_`; `resources/*.html` |
| localStorage | `after:storageState` › `result.origins[].localStorage[].value`; args de `evaluate` |
| Consola | `console` › `text`, `args[]` |

## Arquitectura

```text
RAW (frontend/playwright-report, frontend/test-results, $RUNNER_TEMP/visual-production-candidate)
  → harvest (valores de clase secreta desde campos estructurados)
  → sanitize (allowlist por miembro/evento/campo; ZIP y payload del report reconstruidos)
  → validate (pasada independiente sobre el staging; cualquier violación borra el staging, exit 1)
  → $RUNNER_TEMP/playwright-sanitized
  → actions/upload-artifact  (if: … && steps.sanitize-playwright-artifacts.outcome == 'success')
```

El paso de sanitización nunca reemplaza el estado del paso E2E: corre por `failure()` (o
`always() && inputs.upload_artifacts` en el workflow manual), no usa `continue-on-error` ni `||`, y
si falla el upload queda `skipped`. El raw nunca se modifica ni se sube.

## Política de sanitización

- **Miembros del ZIP**: se conservan JSONL de trace/network (reconstruidos), `.stacks`,
  `screencast/*.jpeg` (magic JPEG), `attachments/*` PNG/JPEG y attachments Markdown declarados en
  `test.trace` (redactados). Se omiten `resources/*` (todos los bodies), `src/*` y todo miembro
  desconocido.
- **Eventos**: allowlist por tipo. `frame-snapshot` y `stdout`/`stderr` se descartan; `after.result`
  se descarta; `console.text` se reemplaza por `[REDACTED]` (el visor exige el campo) y `args` se
  elimina; `context-options.options` sólo conserva opciones de viewport/dispositivo.
- **Params**: sólo selector, estado, timeouts, botones/posición y teclas nombradas sobreviven;
  `value`, `text`, `headers`, `cookies`, `jsonData`, `postData`, `expression`, `expected*`, etc.
  pasan a `[REDACTED]`; los valores serializados (`arg`, `expectedValue`) a
  `{value:{s:"[REDACTED]"},handles:[]}` para que el visor pueda parsearlos.
- **Headers**: `authorization`, `proxy-authorization`, `cookie`, `set-cookie`, `x-api-key` y todo
  nombre con stem de credencial se redactan siempre; el resto sólo conserva valor si está en una
  allowlist de headers benignos. `cookies[]` y `queryString[]` conservan nombre, nunca valor.
  Bodies: sólo `mimeType`/`size`.
- **Texto libre** (logs, errores, títulos, Markdown, CSV, JSON): líneas `header: valor` sensibles,
  esquemas `Bearer/Basic/…`, query strings y fragments con `=`, pares `*session*/*token*/…=valor`,
  tokens opacos largos, y todo valor cosechado (≥ 6 caracteres) de la clase secreta en cualquier
  parte del conjunto de artefactos. La invariante es por clase, no por nombre de cookie.
- **Archivos**: PNG/JPEG (magic verificado), `.md`/`.csv` redactados, `.json` redactado,
  `index.html` de report con payload reconstruido, bundle estático `trace/` del visor. Todo otro
  archivo (p. ej. `.webm`, `.txt`, ZIP corrupto, symlink) se omite y queda listado en
  `SANITIZATION-MANIFEST.json`.
- **Preservado a propósito**: mensajes de error de aserción y texto visible de la página (misma
  clase que un screenshot, ya publicado hoy y ya impreso por el reporter `list` en el log).

## Validaciones

| Gate | Estado |
|---|---|
| `playwright-artifact-sanitizer.test.ts` (8 tests) | PASSED |
| Mutaciones negativas (upload raw, `if` con `\|\|`, header obligatorio como benigno, `resources/` conservado) | cada una FAILED como se esperaba; revertidas |
| Salida real 1.63.0 (`retain-on-failure` y `on-first-retry`+`retries=1`) sanitizada | 21 clases de canario raw → sólo `ERROR`/`RENDERED` |
| Trace sanitizado abierto en el visor oficial 1.63.0 (Chromium headless) | carga sin errores: 15 acciones, 5 filas de red, attachments, errores |
| Contratos de workflow realineados + digests | PASSED |
| `node scripts/governance/workflow-security-validator.mjs` | PASSED |

Los gates generales (`typecheck`, `typecheck:test`, `test`, `build`, `git diff --check`) se reportan
en el PR con su estado canónico.

## Riesgo residual

- Los DOM snapshots se descartan: el visor muestra timeline, screencast, red, logs y errores, pero
  no el DOM navegable. Reintroducirlos exige una política propia de redacción del árbol DOM.
- Texto visible de la página y mensajes de aserción se conservan; un secreto **renderizado** en
  pantalla sólo no se detecta (igual que en los screenshots existentes).
- El formato de trace no es un contrato estable de Playwright: eventos o miembros nuevos se omiten
  por defecto (fail-closed); un cambio de forma que el validador rechace borra el staging y deja el
  upload en `skipped` hasta ajustar la política.
- `B-4` sigue abierto hasta el PR config-only de `trace: "retain-on-failure"`.

## Estado final

Frontera de sanitización implementada y validada. `B-4` pendiente del PR config-only posterior.
