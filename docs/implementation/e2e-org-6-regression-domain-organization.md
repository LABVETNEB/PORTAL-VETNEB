# E2E-ORG-6 regression domain organization

Fecha: 2026-07-17

## Estado base

- Rama: `test/e2e-organize-regression-domain`.
- HEAD inicial: `66dbda3d7e50acc30ff912f43aaaa094cce9c629`.
- Base sincronizada con `origin/main` (mismo SHA).
- Commit base: `test(e2e): organize platform domain specs (#1489)`.
- Working tree inicial limpio.
- PRs abiertos al inicio: 0.
- Gestor: `pnpm@11.13.0`.

## Objetivo

Reorganizar los 5 specs restantes del dominio `regression` que permanecían en la
raíz física de `frontend/e2e/` hacia su ubicación canónica
`frontend/e2e/regression/**`, moviendo junto con ellos los 30 snapshots Linux
adyacentes, redirigiendo la evidencia generada fuera del árbol tracked y
protegiendo la ejecución Linux-only con un preflight de plataforma en el runner.

El cambio es arquitectónico y de infraestructura E2E:

- preserva títulos, assertions, fixtures, cobertura, metadata y comportamiento,
  salvo los cambios de path y de salida de evidencia expresamente autorizados;
- preserva 72 specs y 785 tests descubiertos;
- no modifica runtime de producto.

## Skills utilizadas y aplicación concreta

- `vetneb-briefing-planificacion-diseno-desarrollo-pruebas`: recorte de scope
  exacto, no-alcance explícito, matriz de riesgos, plan mínimo y prevención de
  deriva (no se tocó producto, deps, CI ni governance).
- `vetneb-production-web-optimization-engineer`: diagnóstico antes de editar
  (censo de referencias, hashes, lectura completa de runner/guard/workflow),
  causa raíz del skew de índice, cambio mínimo, rollback verificable.
- `vetneb-staff-senior-full-stack-engineer`: fronteras entre specs, catálogo,
  runner, workflow y guards; preservación de contratos; tests dirigidos;
  implementación lista para PR sin escrituras Git.
- `vetneb-web-end-to-end-global`: verificación de que el dominio regression sigue
  cubriendo público, dashboards y stress sin pérdida silenciosa de cobertura
  (72/72 specs, particiones intactas).

## Autorización R2 limitada aplicada

Nico autorizó explícitamente para E2E-ORG-6:

- modificar `.github/workflows/visual-regression-manual.yml` sólo para reemplazar
  los tres paths legacy de specs visuales por sus destinos canónicos, preservando
  todo el resto del comportamiento del workflow;
- actualizar el digest SHA-256 canónico de ese workflow en
  `test/unit/infrastructure/workflow-security-policy-contract.test.ts` tras
  revisar el diff completo.

No se tocó ninguna otra superficie R2: `frontend-ci.yml`, `backend-ci.yml`,
`pr-governance.yml`, `qga-governance.yml`, `app-version-force-update.yml`,
`scripts/governance/**`, deps, lockfiles ni Playwright config.

## Scope incluido

- Movimiento de 5 specs a `frontend/e2e/regression/{visual,evidence}/`.
- Movimiento de los 3 directorios `*-snapshots` (30 PNG) adyacentes.
- Actualización de los 5 paths en `frontend/e2e/suites/catalog.ts`.
- Redirección de la metadata `evidence` de los 2 generadores de `docs/audit` a
  `test-results`.
- Redirección de la salida real de evidencia a la carpeta gestionada por
  Playwright (`testInfo.outputPath`).
- Preflight de plataforma testeable en `frontend/e2e/scripts/run-cohort.mjs`.
- Cobertura del preflight en `test/architecture/e2e-suite-catalog-completeness.test.ts`.
- Actualización de los 3 paths visuales en el workflow manual (4 casos).
- Actualización del digest del workflow en el test ancla de seguridad.

## Scope excluido

- `frontend/src/**`, backend, API, auth, DB, schema, migraciones.
- Dependencias, manifiestos, lockfiles, CI frontend, governance.
- Fixtures y helpers E2E compartidos, configuración Playwright.
- Cambios de assertions, títulos, viewports, waits, mocks, tolerancias, timeouts,
  retries, skips o expected failures.
- Renombre de los 5 specs.
- Regeneración de snapshots en Windows.
- Corrección del defecto P1 de `/dashboard/informes`.
- El `test.skip` de plataforma en los specs visuales (lo cubre el runner).

## Inventario previo

- 72 specs tracked (`git ls-files`), de los cuales 5 en la raíz de `frontend/e2e/`.
- 30 PNG bajo los 3 directorios `visual-regression-*.spec.ts-snapshots`.
- Referencias ejecutables a los 5 basenames: `frontend/e2e/suites/catalog.ts` y
  `.github/workflows/visual-regression-manual.yml`. El resto (11 archivos) son
  documentos de auditoría/históricos que registran HEAD previos y conservan los
  paths legacy como evidencia histórica (no se reescriben).

## Movimientos (5 specs)

- `frontend/e2e/visual-regression-public.spec.ts`
  -> `frontend/e2e/regression/visual/visual-regression-public.spec.ts`
- `frontend/e2e/visual-regression-authenticated.spec.ts`
  -> `frontend/e2e/regression/visual/visual-regression-authenticated.spec.ts`
- `frontend/e2e/visual-regression-stress.spec.ts`
  -> `frontend/e2e/regression/visual/visual-regression-stress.spec.ts`
- `frontend/e2e/remove-home-unified-workspace-screenshots.spec.ts`
  -> `frontend/e2e/regression/evidence/remove-home-unified-workspace-screenshots.spec.ts`
- `frontend/e2e/dashboard-runtime-post-ux1-visual-evidence.spec.ts`
  -> `frontend/e2e/regression/evidence/dashboard-runtime-post-ux1-visual-evidence.spec.ts`

Movimientos vía filesystem (`Move-Item`); no se usó `git mv` (staging reservado a
Nico).

## Movimiento de 30 snapshots

Los 3 directorios de snapshots se movieron sin renombrar, conservando su nombre
físico `<spec>.spec.ts-snapshots`, hacia `frontend/e2e/regression/visual/`:

- `visual-regression-public.spec.ts-snapshots` (10 PNG)
- `visual-regression-authenticated.spec.ts-snapshots` (10 PNG)
- `visual-regression-stress.spec.ts-snapshots` (10 PNG)

La resolución de Playwright es por defecto (`<testFileDir>/<testFileName>-snapshots/`);
`playwright.config.ts` no la sobrescribe, de modo que mover spec + snapshots juntos
preserva la resolución.

## Comprobación de hashes

- 30 PNG hasheados con SHA-256 antes del movimiento.
- 30 PNG rehasheados después del movimiento.
- Resultado: los 30 hashes idénticos byte a byte (conjuntos ordenados iguales).
- No se regeneró, editó ni recomprimió ningún PNG en Windows.

## Actualización de catálogo

Los 5 entries se reubicaron a sus paths canónicos y quedaron contiguos al final
del catálogo por orden lexicográfico global (`e2e/regression/...` ordena después
de `e2e/public/...`):

```text
e2e/regression/evidence/dashboard-runtime-post-ux1-visual-evidence.spec.ts
e2e/regression/evidence/remove-home-unified-workspace-screenshots.spec.ts
e2e/regression/visual/visual-regression-authenticated.spec.ts
e2e/regression/visual/visual-regression-public.spec.ts
e2e/regression/visual/visual-regression-stress.spec.ts
```

Estado verificado (import directo del catálogo):

| Métrica | Resultado |
| --- | ---: |
| Entradas totales | 72 |
| Paths únicos | 72 |
| Dominio regression | 5 |
| Cohorte `ci` | 42 |
| Cohorte `extended` | 25 |
| Cohorte `evidence` | 2 |
| Cohorte `visual-linux` | 3 |
| Cohorte `full` | 72 |
| Cohorte `affected` | 0 |

Metadata, cohortes, criticality, owner, platform, fixture, targetGate y notes se
preservaron salvo la metadata `evidence` de los 2 generadores.

## Decisión sobre evidence

Decisión arquitectónica de E2E-ORG-6 (backlog E2E-STAB §8.3):

- Los 2 specs de evidence **permanecen** dentro de `full` (no se saca ninguno; el
  guard exige `full` = 72).
- La salida real de evidencia se **redirige** a la carpeta gestionada por
  Playwright, no tracked, vía `testInfo.outputPath(...)`.
- La metadata `evidence` de ambos entries pasa de `docs/audit` a `test-results`.

Cambios mínimos en los specs:

- `remove-home-unified-workspace-screenshots.spec.ts`: se eliminó `OUT_DIR` y la
  creación temprana del directorio tracked; cada screenshot se resuelve por
  `testInfo.outputPath(capture.file)`. Mismos 10 casos, nombres de archivo,
  viewports, navegación, waits y assertions.
- `dashboard-runtime-post-ux1-visual-evidence.spec.ts`: screenshots y JSON de
  métricas se resuelven por `testInfo.outputPath(...)`, eliminando la resolución
  por `testInfo.config.rootDir` hacia `docs/audit`. Mismo test, viewports, tabs,
  métricas, assertions, timeout y nombres de archivo.

Verificado tras `e2e:evidence`: 30 PNG + `dashboard-runtime-post-ux1-metrics.json`
bajo `frontend/test-results/**`; `git diff -- docs/audit` vacío.

## Preflight Linux

Se agregó una función pura exportada `validatePlatformCompatibility(selectedSpecs,
platform)` en `run-cohort.mjs`, invocada por el CLI con `process.platform` antes de
`existsSync` y de `spawnSync` (Playwright/servidores/navegadores):

- deriva los specs Linux-only del catálogo (`platform === "linux"`);
- en Linux no hay specs incompatibles (`incompatibleSpecs = []`, compatible);
- fuera de Linux, cualquier selección que contenga specs Linux-only es
  incompatible; el CLI imprime un mensaje explícito, lista los specs, indica que
  los baselines están versionados para Chromium Linux y retorna exit code 5.

Protege `visual-linux` y cualquier otra cohorte que contenga esos entries,
incluida `full`. No se agregó `test.skip` ni se alteró la metadata
`platform: linux`.

## Actualización del workflow

`.github/workflows/visual-regression-manual.yml`: se reemplazaron los 3 paths
legacy por sus destinos canónicos en los 4 casos (`all`, `public`,
`authenticated`, `stress`). Se preservó todo lo demás: `workflow_dispatch`,
inputs/defaults, `permissions: contents: read`, concurrency, `ubuntu-latest`,
timeout, PNPM, Chromium, `--project=chromium`, `--update-snapshots`, acciones
fijadas por SHA, upload de `playwright-report` y `test-results`, naming,
retention, fail-fast Linux y el glob recursivo `frontend/e2e/**/*.png`.

## Actualización del digest

Tras revisar el diff completo del workflow (sólo cambiaron las 6 líneas de path),
se recalculó el digest con la normalización del test (UTF-8, CRLF→LF, SHA-256):

- anterior: `b21290adb17d0737f647bc6d1480f767b1c544e6d99d0deb99367c7401f9dec6`;
- nuevo: `3344160f3c37da9067ba744ca317a27168799839157c95301e8ac3905754faf0`.

Se actualizó únicamente ese digest en
`test/unit/infrastructure/workflow-security-policy-contract.test.ts`. No se
alteraron allowlists, permisos, política, excepciones ni referencias de actions.

## Archivos modificados

- `frontend/e2e/regression/visual/visual-regression-public.spec.ts` (movido)
- `frontend/e2e/regression/visual/visual-regression-authenticated.spec.ts` (movido)
- `frontend/e2e/regression/visual/visual-regression-stress.spec.ts` (movido)
- `frontend/e2e/regression/visual/<3 dirs *-snapshots, 30 PNG>` (movidos)
- `frontend/e2e/regression/evidence/remove-home-unified-workspace-screenshots.spec.ts` (movido + salida)
- `frontend/e2e/regression/evidence/dashboard-runtime-post-ux1-visual-evidence.spec.ts` (movido + salida)
- `frontend/e2e/suites/catalog.ts` (5 paths + 2 metadata `evidence`)
- `frontend/e2e/scripts/run-cohort.mjs` (preflight de plataforma)
- `test/architecture/e2e-suite-catalog-completeness.test.ts` (cobertura preflight)
- `.github/workflows/visual-regression-manual.yml` (3 paths / 4 casos)
- `test/unit/infrastructure/workflow-security-policy-contract.test.ts` (digest)
- `docs/implementation/e2e-org-6-regression-domain-organization.md` (este documento)

## Validaciones con estado canónico

| Validación | Estado |
| --- | --- |
| Inventario físico: 72 specs, 0 en raíz, 5 regression, 30 PNG bajo `regression/visual` | PASSED |
| Hashes SHA-256 de los 30 PNG antes/después | PASSED — idénticos byte a byte |
| Paridad catálogo ↔ working tree (72 únicos, ordenados) | PASSED |
| Import directo del catálogo (72/5/42/25/2/3/72/0, evidence=test-results, evidence∈full) | PASSED |
| Preflight aislado (`--test-name-pattern "platform preflight"`) | PASSED — 1/1 |
| Contratos de seguridad de workflow (policy + validator) | PASSED — 48/48 |
| Playwright discovery | PASSED — 785 tests en 72 archivos, 0 specs en raíz |
| `e2e:visual-linux` en Windows | PASSED — contrato negativo, exit 5 y mensaje esperado, sin Playwright |
| `e2e:evidence` | PASSED — 11/11, salidas bajo `test-results`, `docs/audit` sin cambios |
| `git diff -- docs/audit` tras evidence | PASSED — vacío |
| `git diff -- frontend/next-env.d.ts` tras evidence y build | PASSED — vacío |
| `e2e:verify-teardown` | PASSED — puertos 3000 y 3107 libres |
| `pnpm --dir frontend lint` | PASSED |
| `pnpm --dir frontend typecheck` | PASSED |
| `pnpm --dir frontend build` | PASSED |
| `pnpm security:public-surface` | PASSED |
| `pnpm typecheck` (root) | PASSED |
| `pnpm typecheck:test` (root) | PASSED |
| `pnpm build` (root, server esbuild) | PASSED |
| `pnpm test` (root) pre-stage | BLOCKED — 3107/3108; único fallo = guard de completitud por inventario `git ls-files` (índice con paths viejos) |
| `pnpm validate:local` pre-stage | BLOCKED — mismo guard; el resto (typecheck, typecheck:test, build) verde |
| Workflow real Linux | NOT_RUN — requiere rama publicada y ejecución manual de Nico |

## Resultado

- 5 specs reorganizados bajo `frontend/e2e/regression/**` (3 visual, 2 evidence).
- 30 PNG movidos byte-idénticos junto a sus specs.
- Cero specs en la raíz física de `frontend/e2e/`.
- Catálogo actualizado, único y ordenado; particiones intactas.
- Evidence permanece en `full`, con salida redirigida a `test-results`.
- Preflight de plataforma testeable que falla temprano y claro en Windows.
- Workflow manual con los 3 paths nuevos y digest revisado.
- 72 specs y 785 tests preservados.
- Cero cambios de producto, deps, lockfiles, CI frontend o governance.

## Riesgos residuales

### Validación dependiente del índice — esperada, se cierra con stage

El guard de completitud (`e2e-suite-catalog-completeness.test.ts`) inventaría con
`git ls-files`, que refleja el índice, no el working tree. Como el movimiento es
por filesystem y el staging está reservado a Nico, el índice aún lista los 5 paths
viejos y el guard falla pre-stage (mismo patrón documentado en E2E-ORG-2..5). La
paridad catálogo ↔ working tree ya está demostrada; tras el stage de Nico el guard
reconoce los movimientos y `pnpm validate:local` cierra en verde. CI valida sobre
el árbol commiteado.

### Snapshots Linux

Los 30 PNG se preservaron byte a byte, pero su validación visual real sólo ocurre
en el workflow manual sobre Chromium Linux. No se afirma validación visual hasta
observar ese workflow.

### P1 de Informes

Fuera de alcance; ni el spec ni sus expected-failure guards se alteran.

## Estado final del working tree

- Rama: `test/e2e-organize-regression-domain` (sin cambiar).
- Sin staging (`git add` reservado a Nico).
- Diff limitado al scope de E2E-ORG-6.
- `test-results/`, `playwright-report/`, `dist/` y `.next/` ignorados por Git,
  sin contaminación tracked; `next-env.d.ts` sin alterar.
- Merge: NOT_RUN.

## Pendientes [MANUAL-NICO]

1. `git add` de los 5 movimientos (specs + 3 dirs de snapshots), `catalog.ts`,
   `run-cohort.mjs`, `e2e-suite-catalog-completeness.test.ts`,
   `visual-regression-manual.yml`,
   `workflow-security-policy-contract.test.ts` y este documento.
2. Re-ejecutar `pnpm --dir frontend e2e:verify-catalog` y `pnpm validate:local`
   post-stage y confirmar verde (guard reconoce los renombres desde el índice).
3. `git commit` y `git push -u`.
4. `gh pr create` con el contrato de PR Governance.
5. Ejecutar manualmente el workflow `Visual Regression Manual` en Linux para
   validar los snapshots reubicados.
6. `gh pr checks --watch` y merge en un mensaje separado.

## CI follow-up — clinic workspace isolation stabilization

Seguimiento de CI posterior al commit de E2E-ORG-6. No reescribe la evidencia
anterior; documenta una estabilización determinista de tests que ya existían.

### Contexto y evidencia ejecutable

1. PR #1490 (`test(e2e): organize regression domain`), head original
   `87cdcf8cfaaf69c6dfa41afd9485ff7b3e522039`.
2. Frontend CI run `29594231953`, sobre ese head exacto.
3. Attempt 1 (job `87930589388`): falló
   `frontend/e2e/platform/app-shell/dashboard-card-navigation-shell.spec.ts` →
   `clinic dashboard — workspace isolation › Perfil público workspace does not
   render Informes workspace`; el locator `[data-dashboard-module-workspace="perfil"]`
   nunca apareció (timeout 12000ms).
4. Attempt 2 (rerun, job `87936914443`): falló el sibling
   `Tokens workspace does not render Logística content`; el locator
   `[data-dashboard-module-workspace="tokens"]` nunca apareció. Cierre del attempt:
   1 failed, 272 passed.
5. En ambos intentos el Next dev server emitió múltiples `[WebServer] Error:
   aborted` con `code: ECONNRESET`; ejecución sobre `next dev`, no `next start`.

Además, un run previo del mismo head (`29593265119`) fue verde: mismo commit con
resultados no deterministas ⇒ flake, no regresión de contrato.

### Por qué ambos fallos son la misma clase

El archivo afectado **no** formaba parte del diff original de E2E-ORG-6 (que sólo
reorganiza regression/evidence/visual-linux + catálogo/runner/workflow/guards/doc).
Los tres tests de `clinic dashboard — workspace isolation` mezclaban dos
responsabilidades: (1) navegar por el rail con un clic client-side y (2) comprobar
el aislamiento entre workspaces. Bajo contención del dev server en la cohorte
`visual-contract`, la petición RSC/navegación disparada por el clic se aborta
(`ECONNRESET`), el workspace destino no monta y el test agota los 12000ms. Perfil
y Tokens son la misma falla: `/dashboard` default → rail visible → clic
client-side → el workspace esperado nunca aparece.

### Corrección

La navegación por rail ya está cubierta, de forma separada y determinista, por el
bloque `clinic dashboard — rail navigation`, que itera `CLINIC_RAIL_MODULES` y para
cada módulo valida rail item visible → clic → URL `?module=` → workspace visible →
`aria-current="page"`. Por eso los tests de aislamiento no necesitan repetir la
navegación por clic: se convierte el módulo objetivo en una precondición
determinista mediante deep link.

En los tres tests de aislamiento se reemplazó únicamente la precondición de
navegación:

- antes: `page.goto("/dashboard")` + `expect(clinicRail).toBeVisible()` +
  `clinicRailItem(page, "<module>").click()`;
- después: `page.goto("/dashboard?module=<module>")`.

Se preservaron exactamente los títulos, las assertions de workspace visible, las
assertions de contenido ajeno no visible, el timeout de 12000ms, la sesión clínica
del `beforeEach` y el `describe`. `clinicRail`, `clinicRailItem`,
`CLINIC_RAIL_MODULES` y el bloque `rail navigation` no se tocaron (siguen en uso
por los contratos de navegación).

### Cobertura preservada

- Navegación por clic del rail: intacta en `clinic dashboard — rail navigation`
  (loop sobre `CLINIC_RAIL_MODULES`, incluye `perfil` y `tokens`).
- Aislamiento entre workspaces: intacto en `clinic dashboard — workspace isolation`
  (mismas assertions de aislamiento, ahora con precondición determinista).

### Sin falsos arreglos

No hubo cambios de producto, fixtures de sesión, retries, sleeps, aumentos de
timeout, skips, `force: true`, soft assertions, cambios de cohorte, de CI ni de
Playwright config.

### Validaciones

| Validación | Estado |
| --- | --- |
| `e2e:verify-teardown` inicial | PASSED — puertos 3000/3107 libres |
| `dashboard-card-navigation-shell` grep `workspace isolation` `--repeat-each=30 --workers=1` | PASSED — 90/90 |
| Archivo completo `--workers=1` | PASSED |
| `e2e:visual-contract` (1.ª corrida) | PASSED — 273 tests |
| `e2e:visual-contract` (2.ª corrida) | PASSED — 273 tests |
| `e2e:verify-teardown` final | PASSED — puertos 3000/3107 libres |
| `pnpm --dir frontend lint` | PASSED |
| `pnpm --dir frontend typecheck` | PASSED |
| `pnpm validate:local` | PASSED |

### Riesgo residual

La causa de fondo (contención del Next dev server bajo carga de cohorte, con
`ECONNRESET` en peticiones RSC) persiste como clase de infraestructura hasta la
Fase G (`next build` + `next start` para E2E de CI, backlog E2E-STAB, fuera de
alcance). Esta corrección elimina la exposición de los tres tests de aislamiento a
esa clase sin ocultarla ni debilitar cobertura.

### Rollback

Revertir las tres precondiciones de deep link a su forma anterior
(`goto("/dashboard")` + rail visible + clic) y quitar esta sección. Sin cambios de
producto, datos, dependencias ni configuración.

## Visual Linux follow-up — clinic readiness selector

Seguimiento del workflow `Visual Regression Manual` posterior al head
`05ba123751d64fb5e899c91324c53fef6b6b7877`. No reescribe evidencia histórica.

### Contexto y evidencia ejecutable

1. Run `29600024330` (job `87949622589`), inputs `suite=all`,
   `update_snapshots=false`, `upload_artifacts=true`.
2. Head `05ba123751d64fb5e899c91324c53fef6b6b7877`.
3. `visual-regression-public`: 10/10 PASSED.
4. `visual-regression-authenticated` y `visual-regression-stress`: fallo **antes**
   del screenshot, en el primer viewport 320, esperando el selector de readiness
   (`waitForVisibleReadySelector`, `Expected: true / Received: false`, timeout
   12000ms). Los 18 tests posteriores quedaron NOT_RUN por el modo `serial`.

### Evidencia del artifact

Con la sesión clínica activa, el dashboard autenticado estaba completamente
renderizado: header "Dashboard Clínica" visible, rail de módulos visible, workspace
"Centro de operaciones" (`[data-dashboard-module-workspace="operaciones"]`)
renderizado, y el selector legacy del hub ausente. No fue fallo de auth, servidor,
snapshot, timeout ni flake.

### Causa raíz

Los specs visuales se conservaron mecánicamente en E2E-ORG-6 con un `route.ready`
clínico anterior a la eliminación del home/hub clínico
(`[data-dashboard-module-hub="true"]`). Con el contrato actual `/dashboard` abre
operaciones directamente y el hub clínico no existe, por lo que ese readiness es
determinísticamente imposible. `waitForVisibleReadySelector` funciona
correctamente; el valor de readiness clínico era el obsoleto.

### Corrección

Readiness clínico de ambos specs visuales pasa a la señal real del workspace
inicial:

- antes: `ready: '[data-dashboard-module-hub="true"]'` (ruta clínica);
- después: `ready: '[data-dashboard-module-workspace="operaciones"]'`.

Se cambió únicamente la ruta clínica (`dashboard` y `stress-dashboard`). Las rutas
admin conservan `ready: '[data-dashboard-module-hub="true"]'` +
`mobileReady: '[data-admin-mobile-hub-launcher="true"]'` (el hub admin sí existe).
No se creó un selector combinado hub-OR-operaciones: el hub clínico fue eliminado y
no vuelve a aceptarse como estado válido.

### Ausencia de cambios colaterales

Sin cambios de producto, de sesión (`applySession`), de mocks
(`installStressApiMocks`), de workflow, de digest, de snapshots
(`--update-snapshots` no ejecutado), de `maxDiffPixelRatio`, de timeouts, del skip
Linux ni del modo serial. `waitForVisibleReadySelector` y `waitForStableDashboard`
intactos.

### Validaciones

| Validación | Estado |
| --- | --- |
| Inspección estática (clinic=operaciones, admin=hub, admin mobileReady intacto) | PASSED |
| Discovery Playwright de ambos specs | PASSED — 20 tests (10 + 10) |
| `e2e:visual-linux` en Windows (contrato negativo) | PASSED — exit 5 antes de Playwright |
| `pnpm --dir frontend lint` | PASSED |
| `pnpm --dir frontend typecheck` | PASSED |
| `pnpm validate:local` | PASSED |
| `e2e:verify-teardown` | PASSED — puertos 3000/3107 libres |
| Snapshots Linux byte-idénticos (no regenerados) | PASSED |
| Certificación visual real en Linux | NOT_RUN — requiere re-ejecutar el workflow (MANUAL-NICO) |

### Riesgo residual

Windows no puede certificar los baselines Linux; la validación pixel real sólo
ocurre al re-ejecutar `Visual Regression Manual` en Chromium Linux con
`update_snapshots=false`. Los 30 PNG no se tocaron: si el render de operaciones
coincide con el baseline versionado, el run cierra en verde sin regenerar.

### Rollback

Revertir los dos `route.ready` clínicos a `[data-dashboard-module-hub="true"]` y
quitar esta sección. Sin cambios de producto, datos, dependencias ni
configuración.

## Visual Linux baseline regeneration and determinism

The manual Chromium Linux validation revealed that the mechanically
relocated baselines were already stale relative to the current product.
The relocation commit itself preserved all 30 PNG files byte for byte;
the visual refresh documented here is a subsequent, explicitly audited
follow-up.

### Evidence

- Initial comparison run: `29602633278`
  - `suite=all`
  - `update_snapshots=false`
  - `upload_artifacts=true`
  - public visual tests: 10/10 passed
  - clinic authenticated and stress reached stable screenshot comparison
  - both first failed at 320 because the tracked images represented the
    removed clinic module hub instead of the current Operaciones workspace
- Linux generation run A: `29603285727`
  - `suite=all`
  - `update_snapshots=true`
  - `upload_artifacts=true`
  - 30/30 passed
- Linux generation run B: `29605773076`
  - same head and inputs as run A
  - 30/30 passed
  - approved source artifact:
    `visual-regression-all-snapshots-1`
  - artifact ID: `8416807417`

### Root cause and history

- The five clinic authenticated and five clinic stress baselines were
  stale after the clinic hub was removed and `/dashboard` began opening
  the Operaciones workspace directly.
- The four admin authenticated and four admin stress baselines at
  768, 1024, 1536 and 1920 were stale after the premium admin dashboard
  redesign.
- Admin 320 remained unchanged because it uses the separate mobile hub
  launcher surface.
- The original E2E-ORG-6 relocation remained a mechanical R100 move; it
  did not cause either product-level visual change.

Relevant historical evidence:

- clinic default-workspace transition: `f267af9` / PR #1288
- admin premium dashboard redesign: `35647b3` / PR #1281
- original visual baseline creation: `34d0784` / PR #1206
- mechanical regression-domain relocation: `87cdcf8` / PR #1490

### Determinism gate

> **Corrected 2026-07-17 — see "Audit correction" below.** The original
> figures reported here (pixel-identical 30/30, pixel-different 0) were a
> false negative and are wrong. The exact result is pixel-identical 29/30,
> pixel-different 1.

Run A and run B were compared after decoding all PNG files to RGBA:

- paths compared: 30/30
- dimensions identical: 30/30
- pixel-identical: ~~30/30~~ **29/30** (corrected)
- byte-identical: 29/30
- pixel-different: ~~0~~ **1** (corrected)

`stress-dashboard-1536-chromium-linux.png` differed in PNG bytes between
runs **and is not pixel-identical**: an exact RGBA comparison finds 36
genuinely different pixels (RGB deltas of ±1–7, alpha identical), localized
to a thin text band, bounding box `[791,405]-[1194,427]`. The earlier claim
that its "decoded RGBA pixels were exactly identical" was incorrect.

### Audit correction (2026-07-17)

A dedicated exact PNG comparator (Node + `pngjs`, no tolerances) was later
built under `tooling/visual-determinism-comparator` and re-ran run A vs run B
on the exact same approved artifacts (`8415870767` vs `8416807417`). Findings:

- The original temporary validation **incorrectly reported pixel-identical
  30/30**.
- The exact Node/`pngjs` comparator found **36 different RGB pixels** in
  `stress-dashboard-1536-chromium-linux.png` (exit 1, pixel-different: 1).
- A **second, independent PNG decoder** (from-scratch zlib inflate + scanline
  unfilter, no `pngjs`) confirmed the same 36-pixel result byte for byte.
- The difference concentrates in a thin text band; alpha is identical.
- **run B vs the tracked baselines remains 30/30 byte-identical** (exit 0).
- This correction does **not** change the versioned snapshots nor the
  acceptance of run B (`8416807417`) as the approved imported source; the
  tracked baselines stay reproducible against run B.
- It **does** invalidate the historical claim that run A and run B were
  pixel-identical.

Probable cause of the original false negative (documented cautiously; the
temporary script was never committed and could not be re-run here): a
Pillow/ImageChops path where `Image.getbbox()` — whose default became
`alpha_only=True` in Pillow 10.0.0 — trimmed the RGBA diff by its all-zero
alpha channel and returned `None`, masking the non-zero RGB differences. See
`visual-determinism-comparator.md` for the full evidence and reasoning.

### Approved refresh

Exactly 18 baselines were imported from run B:

- clinic authenticated: 5
- clinic stress: 5
- admin authenticated at 768–1920: 4
- admin stress at 768–1920: 4

The ten public baselines and the two admin 320 baselines remain
byte-identical to the tracked versions.

No runtime product, API, session, mock, Playwright configuration,
workflow, dependency, timeout, retry, screenshot tolerance or test title
was changed as part of this baseline refresh.

### Remaining acceptance gate

After committing and publishing these 18 approved files, Visual
Regression Manual must run again with:

- `suite=all`
- `update_snapshots=false`
- `upload_artifacts=true`

The PR is not complete until that final run reports 30/30 passed on the
exact final head.

### Rollback

Reverting the dedicated baseline-refresh commit restores the prior 18
PNG files and this evidence section without affecting runtime product
code, data, schema, dependencies or workflow configuration.
