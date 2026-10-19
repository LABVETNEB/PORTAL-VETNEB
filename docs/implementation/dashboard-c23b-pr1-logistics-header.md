# C23b · PR1 — Header D-A de Rutas y Visitas (Logística, rutas completas)

## Estado base, autorización y alcance

- Rama `feat/dashboard-c23b-chrome-budget`, base `b06f75c0a422201397a5d1e2e1dce282a2727fde` (C25 parcial, #1891; integra #1888, #1890 y #1891). Al iniciar la sesión el checkout estaba en `main@d1283a4f` (#1892, sólo un documento de auditoría); se volvió a la rama C23b con `git switch`, árbol tracked limpio. Se preservaron `frontend/AGENTS.md`, `frontend/CLAUDE.md` (untracked, generados por `next dev`), los cinco stashes, el único worktree y la rama C25 anterior. Sin escrituras Git ni GitHub.
- Autorización R13 de Nico (2026-10-19), literal: «Autorizo R13 exclusivamente para C23b/PR1, variante D-A, en Rutas y Visitas, incluyendo los cambios A02/A03 estrictamente demostrados por mediciones Windows y Linux, sin modificar otros contratos ni ampliar el alcance».
- Incluido: `clinic-log-rutas` y `clinic-log-visitas` (≥ 768 px), sus registros A02 y hojas A03 Win32 demostrados, el ledger C23b y los dos specs adaptativos de esas rutas.
- Excluido: las otras 19 superficies, B2, B3 (app bar B06), B4, C25 restante, C26, el motor de capacidad, A05/A08, backend, endpoints, auth, datos, dependencias, CI y los registros Linux (fase 2).
- Antecedentes: auditoría y propuesta en `docs/implementation/dashboard-c23-responsive-integral.md` §6.

## Diseño D-A

Sólo clases, todas `md:`; por debajo de 768 px el DOM y el CSS efectivos son idénticos a la base.

| Nodo | Antes | Después |
| --- | --- | --- |
| `CardHeader` | `shrink-0` (p-6, columna: 120 px) | `shrink-0 md:h-[var(--dash-workspace-header-h)] md:flex-row md:items-center md:justify-between md:gap-3 md:space-y-0 md:px-4 md:py-0` (40 px) |
| `CardTitle` | `text-base` | `text-base md:shrink-0` (conserva «(N)») |
| «Mostrando N · página P[ · puede haber más…]» | visible ≥ 768; `display:none` < 768 | `md:sr-only` ≥ 768 (en el árbol accesible); < 768 sin cambio |
| «Conteos calculados sobre la página visible…» (R-13) | visible | visible, `md:min-w-0 md:line-clamp-2` |

- No se usa la clase `.dashboard-workspace-header` ni el componente `WorkspaceHeader`: estas rutas viven dentro de `[data-dashboard-module-workspace]` y la regla clínica ≥ 768 px (`navigation.css`, clinic module-header reclaim) los oculta. Se reutiliza el token B11 `--dash-workspace-header-h` (40 px).
- `ModuleMetricRun` (B14) sin cambios.
- Desvío medido respecto de la propuesta: `md:truncate` cortaba el aviso de Rutas a 768×1024 (481/496 px). Se reemplazó por `md:line-clamp-2`: allí ocupa 2 líneas (32 px) dentro del header de 40 px; en los demás anchos, 1 línea. Sin `title`.

## Medición (Win32, Chromium, `next dev`, fixture API 3107, DPR 1)

Método oficial A02 (`derived.chromeBeforePrimaryContentPx` / `…Ratio`), sonda temporal fuera del catálogo y captura `VETNEB_A02_GEOMETRY_CAPTURE=1`; ambas dieron los mismos valores. Rutas y Visitas son idénticas.

| Viewport | Antes | Después | Límite | Antes | Después |
| --- | ---: | ---: | ---: | :---: | :---: |
| 1920×1080 | 278.23 px | 198.23 px | ≤ 240 px | ✗ | ✓ |
| 1600×900 | 275.70 (30.63 %) | 195.70 (21.74 %) | — | — | — |
| 1440×900 | 275.70 (30.63 %) | 195.70 (21.74 %) | — | — | — |
| 1366×768 | 267.58 (34.84 %) | 187.58 (24.42 %) | ≤ 32 % | ✗ | ✓ |
| 1280×720 | 278.45 (38.67 %) | 198.45 (27.56 %) | ≤ 32 % | ✗ | ✓ |
| 1024×768 | 267.58 (34.84 %) | 187.58 (24.42 %) | ≤ 32 % | ✗ | ✓ |
| 834×1194 | 279.83 (23.44 %) | 199.83 (16.74 %) | ≤ 32 % | ✓ | ✓ |
| 768×1024 | 277.45 (27.09 %) | 197.45 (19.28 %) | ≤ 32 % | ✓ | ✓ |
| 430×932 · 412×915 · 390×844 · 375×812 · 360×800 | 195.27 · 195.17 · 195.06 · 194.98 · 194.91 | idéntico (0 campos) | — | — | — |

Contenido del header (≥ 768): altura 40.00 px en los 8 viewports; título 16 px, sin desborde ni solapamiento con el aviso; aviso dentro del header, no recortado (`scrollWidth = clientWidth`, `scrollHeight = clientHeight`); «Mostrando…» 1×1 `position:absolute`; scroll de documento 0. Teléfono: header en columna de 110 px, «Mostrando…» `display:none` y aviso en 2 líneas, como en la base.

## A02 — Win32 realineado

`frontend/e2e/fixtures/dashboard-geometry-baseline.ts`, `records` (Win32): 16 registros (2 superficies × 8 viewports ≥ 768), 4 campos cada uno, −80 px: `regions.collectionHeader.y`, `regions.primaryContent.y`, `derived.chromeBeforePrimaryContentPx`, `derived.chromeBeforePrimaryContentRatio` (64 campos). Diff exacto campo a campo contra PRE: ningún otro campo cambió; los 10 registros de teléfono, idénticos; las otras 19 superficies (247 registros), sin tocar. `platformRecords.linux`: realineado aparte desde el run Linux real (ver Linux).

## A03 — Win32 realineado

`frontend/e2e/fixtures/dashboard-adaptive-limit-baseline.ts`, observaciones Win32: 16 hojas (`logistics-bounded-canvas` × `bounded-rutas`/`bounded-visitas` × 8 viewports ≥ 768), campos `query`, `limit`, `offset`, `secondPageCount`, `provenance` (80 campos). Dos capturas completas en frío (234 hojas, `.next` borrado antes de cada una): byte-idénticas, DRIFT 0/234.

| Viewport | limit/offset antes | después (medido) | predicción |
| --- | ---: | ---: | ---: |
| 1920×1080 | 13/13 | 15/15 | 15 |
| 1600×900 | 10/10 | 12/12 | 12 |
| 1440×900 | 10/10 | 12/12 | 12 |
| 1366×768 | 8/8 | 9/9 | 9 |
| 1280×720 | 8/8 | 9/9 | 9 |
| 1024×768 | 8/8 | 9/9 | 9 |
| 834×1194 | 16/16 | 17/17 | 17 |
| 768×1024 | 13/13 | 14/14 | 14 |

Idénticas en ambos consumidores; `secondPageCount` = `limit`; `source`/`pathname` sin cambio. `bounded-metricas`, las 10 hojas de teléfono y los otros 14 consumidores, sin cambio de contrato. No absorbido: `admin-particular-tokens::{w375x812, w412x915}` difieren sólo en el texto de `provenance` («400» contra «40 items»), campo que el contrato no compara, en un módulo que este cambio no renderiza. Preexistente; queda congelado. `platformObservations.linux`: realineado aparte desde el run Linux real (ver Linux).

## Tests realineados y pruebas causales

- `test/architecture/dashboard-c23-responsive-integral.test.ts`:
  - ledger C23b de 17 a 11 celdas de banda y de 4 a 2 a 1920 (salen las 8 de Rutas y Visitas);
  - contrato de código fuente D-A (clases exactas, todas `md:`, aviso pintado y nunca `sr-only`/`title`, «Mostrando» `md:sr-only`, sin clase B11, B14 presente);
  - 7 mutaciones rechazadas por página.
  - Se reutiliza el harness de mutación existente del archivo, así que el censo 01B no cambia.
- `frontend/e2e/clinic/logistics/dashboard-logistica-{rutas,visitas}-full-route-adaptive.spec.ts`:
  - se agrega el viewport 768×1024;
  - `expectPageScopeHeader` reemplaza los dos `toBeVisible()`, que daban verde sobre `sr-only` (caja 1×1).
  - Aviso: se exige hit-test en el centro, `position: static`, caja real y sin recorte.
  - Desde 768: fila, 40 ± 2 px, sin solapamiento título/aviso, aviso dentro del header, «Mostrando…» renderizado, visualmente oculto y presente en `ariaSnapshot()`.
  - Teléfono: columna y «Mostrando…» `display:none`, como en la base.
  - Paginación, `offset`/`limit` en la URL y la ausencia de scroll siguen asertados igual que antes.
- RED → GREEN:

  | Fuente | Resultado |
  | --- | --- |
  | Páginas del HEAD | 8/10 FAILED («one header row»), exactamente los casos ≥ 768; teléfono pasa |
  | Mutante con el aviso `md:sr-only` | 8/10 FAILED («the page-scope note is painted on top») |
  | D-A | 10/10 PASSED |

## Validaciones Win32

Una tarea pesada por vez; `frontend/.next` se borró antes de cada corrida E2E y `next-env.d.ts` se restauró.

| Gate | Estado |
| --- | --- |
| Guards C23, B10, B11, B14, C22 + unitarios Rutas/Visitas + stable-geometry-reservation | 111/112 PASSED. El FAILED es el ledger C23b en Linux (ver Linux) |
| `pnpm test` (suite Node completa) | FAILED 5402/5405 (1 skip): el ledger C23b en Linux (intencional) y `e2e-global-03b-authoritative-auth-boundary`, que exige `DATABASE_URL` (ambiental y preexistente). Censos 01B verdes |
| Frontend `lint`, `typecheck`, `build`; `security:public-surface` | PASSED |
| Raíz `typecheck`, `typecheck:test` | PASSED |
| `pnpm validate:local` como cadena | NOT_RUN: su suite Node falla por las dos causas anteriores; las piezas se corrieron por separado |
| Specs adaptativos de Rutas y Visitas | PASSED 10/10; RED sobre el HEAD y sobre el mutante (ver arriba) |
| A02 21×13 (dentro de `extended`) | PASSED 21/21 |
| A03 15×13, serial | PASSED 16/16 (234/234 hojas); 3 capturas byte-idénticas |
| A05 32/48/64 (dentro de `extended`) | PASSED 15/15 |
| A08 zero-scroll 21×13 (dentro de `visual-contract`) | PASSED 21/21 |
| Spec C23a | PASSED 39/39 aislado con `--repeat-each=3` |
| `e2e:visual-contract` | FAILED 1006/1007: un caso C23a de Notificaciones del kebab admin (timeout de `waitForRequest` bajo 10 workers); aislado ×3, pasa. Página admin que no importa archivos de PR1 |
| `e2e:public-clinic` | FAILED 328/345. `public-document-cache-policy` (11): `Cache-Control: no-store` bajo `next dev`, idéntico con las páginas del HEAD (A/B), preexistente. `mobile-action-bar-reachability` (6): timeout de `goto` del hub bajo 10 workers; aislado 6/6, presupuesto de 30 s ya conocido |
| `e2e:extended` | FAILED 244/257 + 11 sin correr. A03 `admin-users-roles` bajo 10 workers (pasa serial: arriba); los 11 sin correr son la serie A03 cortada. `module-state-parity` de tokens clínica (1): aislado ×3, 42/42 |
| A02/A03 Linux | BLOCKED: precondición, una ejecución real de E2E Completeness sobre el head publicado |
| `e2e:full` | NOT_RUN (no pedido; las cohortes mínimas cubren los specs afectados) |

## Linux (fase 2) — realineado desde una ejecución real

Procedencia: PR #1893, head `f9107785b890486442b0c623a82953f8fc02db0c`, workflow E2E Completeness, run `39273957610`, attempt 1, job `118133279099`, chromium/linux. Conclusión: `failure`, con 1872 PASSED y 3 FAILED. Los tres fallos son exactamente los esperados: A02 `clinic-log-rutas`, A02 `clinic-log-visitas` e integridad A03. No hubo ningún otro fallo.

- **A02 (`platformRecords.linux`)**:
  - El sanitizer elimina el adjunto, así que los valores salen del log del job: 192 líneas de diferencia, es decir, 64 campos × 3 intentos, idénticas entre intentos.
  - Cada `expected` coincide con el valor Linux versionado (0 discrepancias).
  - Se reescribieron 16 registros con los mismos 4 campos que en Win32 (−80 px). Ningún registro de teléfono ni de otra superficie quedó fuera de tolerancia.
- **A03 (`platformObservations.linux`)**:
  - Artifact `e2e-completeness-playwright-1` (id `12197968672`), archivo `test-results/a03-matrix/a03-matrix-observations.json` (sha256 `5b90508a80a2fe02…`).
  - Se compararon las 234 hojas en `source`, `pathname`, `limit`, `offset` y `secondPageCount`. Las 117 hojas admin traen la clave redactada y se emparejaron por su archivo de módulo + viewport + variante.
  - Las únicas divergencias son las 16 hojas de PR1, con los mismos `limit`/`offset` que en Win32, medidos en Linux.
  - `query` y la URL dentro de `provenance` llegan redactadas (`?[REDACTED]`) en las 39 hojas de `logistics-bounded-canvas`. Se reconstruyeron a partir de `limit`/`offset` observados en Linux con la regla que emite la app (`?offset=<offset>&limit=<limit>` tras «Página siguiente»; primera página `?offset=0&limit=<limit>`). Esa regla se cumple en 156/156 observaciones sin redactar (las dos capturas Win32 en frío, el set Win32 y el set Linux real previo a PR1).
  - El contrato A03 no compara `query` ni `provenance`.
- **Guard C23b**: PASSED en ambas plataformas, 11 celdas de banda + 2 a 1920 cada una, sin cambios en el test. Mutar en memoria el registro Linux de Rutas a 1366×768 lo vuelve a poner en rojo (`linux: 768-1366 cells over 32 %`). Esto cierra el hallazgo P1 de Codex (`PRRT_kwDOR5qlsc6t-dx2`) con la causa corregida, no con el test debilitado.

### Revalidación tras el overlay Linux (Win32, árbol local sobre `f9107785`)

El delta sólo toca las secciones Linux y los comentarios de los dos fixtures, más este documento.

| Gate | Estado |
| --- | --- |
| Guard C23 (ambas plataformas) + B10/B11/B14/C22 + unitarios Rutas/Visitas + stable-geometry-reservation | PASSED 112/112 |
| `pnpm test` | FAILED 5403/5405 (1 skip): sólo `e2e-global-03b`, por `DATABASE_URL` (ambiental; en el CI pasa) |
| Frontend `lint`, `typecheck`, `build`; raíz `typecheck`, `typecheck:test`; `security:public-surface` | PASSED |
| A02 21×13 | PASSED 21/21 |
| A03 15×13 serial | PASSED 16/16 (234/234 hojas; observación byte-idéntica a las capturas en frío) |
| A05 | PASSED 15/15 |
| A08 21×13 | FAILED 20/21: `admin-resumen` (página admin) con el documento entero desbordado en los 13 viewports y 3.1 min de duración. Aislado ×2, PASSED en 8.8 s. A08 no lee los fixtures modificados; transitorio del `next dev` local |
| C23a | PASSED 13/13 |
| Specs adaptativos de Rutas y Visitas | PASSED 10/10 |
| Cohortes `visual-contract`/`public-clinic`/`extended` | NOT_RUN sobre este delta (sólo fixtures Linux y comentarios); sus resultados sobre el código de PR1 están arriba |

## Riesgos residuales

- Visitas: en el HEAD, la fila de escritorio mide 61 px (1366×768) y 101 px (1280×720, con `limit=13` heredado de 1920) frente a un paso de 52/46 px, porque «Notas» hace salto de línea. Es preexistente y no lo causa PR1. Con datos reales y una fila más por página, aumenta el riesgo de recorte. Se reporta aparte.
- El tamaño de página por defecto cambia (8 → 9, etc.), así que también cambia el offset de «Página 2». Los enlaces con `limit` explícito no cambian.
- El overlay Linux A02 sólo reescribe campos fuera de tolerancia (2 px / 0.01). Un cambio Linux menor que la tolerancia no queda registrado; es el mismo criterio de los overlays anteriores.
- `query`/`provenance` Linux de las 16 hojas están reconstruidos por la regla verificada, no observados en claro. Los campos de contrato sí fueron observados.

## Rollback

Revertir el commit squash de PR1: vuelven atrás de una vez las clases, los fixtures y los tests. No hay datos ni backend.

## Incumplimientos C23b restantes

11 celdas de banda y 2 a 1920: `clinic-informes` (1280×720, 768×1024), `clinic-informes-full` (5 + 1920) y `clinic-logistica-full` (4 + 1920). Requieren B2/B4/B1 en otras superficies con su propia autorización R13. B3 (app bar 68.11 px a 1280×720) sigue siendo un correctivo aparte.

Estado: PR1 implementado, con Win32 validado localmente y Linux realineado desde el run real `39273957610`. El overlay Linux está pendiente de publicación (commit y push manuales de Nico), de que E2E Completeness lo valide sobre el head nuevo y de la actualización de rama (`gh pr update-branch`). C23b no está completo.
