# PR-VIS-10 - Visual regression matrix audit

## Estado base

- Rama auditada: `audit/pr-vis-10-visual-regression-matrix`.
- Base obligatoria: `898d6d5 test(frontend): add visual stress regression fixtures (#1207)`.
- Working tree inicial: limpio.
- Tipo de PR: docs-only.
- Archivo creado por este PR: `docs/audit/pr-vis-10-visual-regression-matrix.md`.

## Scope incluido

- Auditoria de la matriz visual versionada por PR-VIS-9a, PR-VIS-9b y PR-VIS-9c.
- Inventario de specs visuales, rutas, viewports, snapshots y plataforma.
- Analisis de riesgos operativos antes de activar cualquier gate CI visual.
- Recomendacion concreta para PR-VIS-11.

## Scope excluido

- Sin cambios de codigo.
- Sin cambios de specs.
- Sin generacion ni actualizacion de snapshots.
- Sin cambios de CI/workflows.
- Sin cambios en backend, DB, migraciones, auth, API, dependencias, lockfiles ni package manifests.
- Sin cambios en `server/`, `frontend/src/`, `frontend/e2e/`, `test/`, `.github/workflows/`, `.claude/` ni PNG existentes.

## Auditoria previa

Archivos inspeccionados en modo solo lectura:

- `docs/audit/pr-vis-9a-implementation.md`.
- `docs/audit/pr-vis-9b-implementation.md`.
- `docs/audit/pr-vis-9c-implementation.md`.
- `frontend/e2e/visual-regression-public.spec.ts`.
- `frontend/e2e/visual-regression-authenticated.spec.ts`.
- `frontend/e2e/visual-regression-stress.spec.ts`.
- `frontend/e2e/*-snapshots/*.png`.
- `frontend/playwright.config.ts`.
- `package.json`.
- `frontend/package.json`.
- `.github/workflows/app-version-force-update.yml`.
- `.github/workflows/backend-ci.yml`.
- `.github/workflows/frontend-ci.yml`.

Hallazgos de configuracion:

- `frontend/playwright.config.ts` define un unico proyecto Playwright: `chromium`.
- Playwright levanta fixture API local en `127.0.0.1:3107` y Next dev en `127.0.0.1:3000`.
- `frontend/package.json` tiene scripts E2E existentes, pero no un script especifico para los tres specs `visual-regression-*`.
- `frontend-ci.yml` instala Chromium con deps y corre suites E2E existentes, pero no ejecuta `visual-regression-public.spec.ts`, `visual-regression-authenticated.spec.ts` ni `visual-regression-stress.spec.ts`.
- No hay gate CI visual dedicado al momento de esta auditoria.

## 1. Resumen ejecutivo

La cobertura visual actual esta versionada como baseline Chromium Linux, pero todavia opera como proteccion manual/local y sin gate CI. PR-VIS-9a protegio rutas publicas basicas, PR-VIS-9b agrego dashboards autenticados y PR-VIS-9c agrego escenarios autenticados de stress con mocks deterministas. En conjunto existen 30 PNG visuales versionados, distribuidos en 3 specs y 5 viewports por superficie.

Quedo protegido por PR-VIS-9a:

- `/`.
- `/login`.
- Viewports `320x720`, `768x1024`, `1024x768`, `1536x960`, `1920x1080`.
- 10 snapshots publicos `chromium-linux`.
- Estabilizacion local de animaciones, fuentes, imagenes no lazy, caret y captura viewport.

Quedo protegido por PR-VIS-9b:

- `/dashboard` con `app_session_id=e2e_populated_clinic_session`.
- `/dashboard/admin` con `admin_session_id=e2e_populated_admin_session`.
- Los mismos 5 viewports.
- 10 snapshots autenticados `chromium-linux`.
- Guard de ejecucion para Chromium Linux en el spec autenticado.

Quedo protegido por PR-VIS-9c:

- `/dashboard` y `/dashboard/admin` bajo datos de stress.
- Mocks locales deterministas para APIs de informes, logistica, auditoria, salud, tokens, workflow y usuarios.
- Los mismos 5 viewports.
- 10 snapshots stress `chromium-linux`.
- Guard de ejecucion para Chromium Linux en el spec stress.

Todavia no esta protegido:

- No hay gate bloqueante en PR.
- No hay workflow visual manual/no bloqueante dedicado.
- No hay contrato operativo documentado para aprobar o rechazar diffs visuales.
- No hay owner formal para aceptar cambios visuales.
- No hay medicion actual de runtime total en CI para los 3 specs visuales juntos.
- No hay evidencia de reproducibilidad de los 30 snapshots dentro de GitHub Actions.
- No hay matriz cross-browser ni cross-platform.
- No hay cobertura visual para todas las rutas/modulos administrativos.
- No hay cobertura prod-mode con `next start`; la configuracion actual usa `next dev`.
- El spec publico no contiene guard explicito de `process.platform === "linux"`, aunque los snapshots versionados actuales son Linux.

## 2. Inventario de cobertura actual

| spec | rutas cubiertas | viewports cubiertos | snapshots esperados | tipo de datos | navegador/plataforma | estado |
| --- | --- | --- | --- | --- | --- | --- |
| `frontend/e2e/visual-regression-public.spec.ts` | `/`, `/login` | `320x720`, `768x1024`, `1024x768`, `1536x960`, `1920x1080` | 10 | publico | `chromium-linux` versionado actualmente | baseline versionado, no gate CI |
| `frontend/e2e/visual-regression-authenticated.spec.ts` | `/dashboard`, `/dashboard/admin` | `320x720`, `768x1024`, `1024x768`, `1536x960`, `1920x1080` | 10 | autenticado | `chromium-linux` con skip fuera de Chromium Linux | baseline versionado, no gate CI |
| `frontend/e2e/visual-regression-stress.spec.ts` | `/dashboard`, `/dashboard/admin` | `320x720`, `768x1024`, `1024x768`, `1536x960`, `1920x1080` | 10 | stress | `chromium-linux` con skip fuera de Chromium Linux | baseline versionado, no gate CI |

## 3. Inventario de snapshots

Total de PNG visuales actuales bajo `frontend/e2e/*-snapshots/*.png`: 30.

| grupo | directorio | cantidad | plataforma observada |
| --- | --- | ---: | --- |
| Publicos | `frontend/e2e/visual-regression-public.spec.ts-snapshots/` | 10 | todos `chromium-linux` |
| Autenticados | `frontend/e2e/visual-regression-authenticated.spec.ts-snapshots/` | 10 | todos `chromium-linux` |
| Stress | `frontend/e2e/visual-regression-stress.spec.ts-snapshots/` | 10 | todos `chromium-linux` |

Confirmaciones de inspeccion:

- Los 30 PNG inventariados terminan en `-chromium-linux.png`.
- No se encontraron PNG `*win32*.png`.
- No se encontraron PNG `*darwin*.png`.
- No se inspeccionaron ni modificaron pixeles; el inventario fue por rutas/nombres de archivo.

## 4. Riesgos de estabilidad

### WSL/Linux y reproducibilidad

Las baselines fueron generadas desde Linux/WSL segun PR-VIS-9a, PR-VIS-9b y PR-VIS-9c. Esto es compatible con GitHub Actions `ubuntu-latest`, pero todavia falta una ejecucion CI dedicada que pruebe los 30 snapshots en el mismo contrato que tendria el gate. Si un desarrollador actualiza snapshots desde Windows, Playwright puede generar baselines `chromium-win32` en superficies sin guard de plataforma; el spec publico es el punto mas expuesto porque no salta fuera de Linux.

### Librerias Chromium y `LD_LIBRARY_PATH`

Las docs previas registran que en WSL fue necesario resolver librerias locales para Chromium (`libnspr4`, `libnss3`, `libnssutil3`, `libasound`) y usar `LD_LIBRARY_PATH` contra una cache de usuario. Tambien se documento que `playwright install-deps chromium` fallo por `sudo` interactivo en WSL. En GitHub Actions el workflow actual usa `playwright install --with-deps chromium`, pero no hay evidencia aun de que los specs visuales completos corran y comparen baselines sin ajustes extra.

### Permisos cruzados Windows/WSL

PR-VIS-9b y PR-VIS-9c documentaron fallos `EACCES` en `node_modules` al alternar instalaciones WSL y Windows. Ese riesgo no afecta al repo versionado directamente, pero si afecta la reproducibilidad local y puede hacer costosa la regeneracion de baselines si no se documenta un procedimiento unico por plataforma.

### Cache `.next`

PR-VIS-9c documento un rerun fallido por cache `.next/dev` inconsistente despues de reinstalar dependencias en WSL. Un gate visual que use `next dev` debe definir limpieza o aislamiento de cache antes de medir estabilidad; de lo contrario, puede mezclar flake de entorno con diffs visuales reales.

### Datos mock/stress vs produccion real

Los specs autenticados usan sesiones/fixtures E2E poblados, y stress usa mocks locales dentro del spec. Eso es correcto para layout y regresiones de superficie, pero no equivale a datos productivos reales. El gate futuro debe venderse como contrato visual determinista, no como prueba integral de datos reales ni de integraciones externas.

### Duracion y costo

La matriz visual actual suma 30 capturas, cada spec corre en modo serial y los timeouts declarados son `60_000` ms para publico y `90_000` ms para autenticado/stress. Ademas, Playwright levanta fixture API y Next dev con timeout de hasta `120_000` ms. La frontend CI actual tiene `timeout-minutes: 20` y ya corre lint, typecheck, build, public-surface y varias suites E2E. Activar estos specs como gate bloqueante sin medir runtime puede convertir el CI en inestable o demasiado caro.

### Artifacts y diagnostico

El workflow actual sube `frontend/playwright-report/` solo en failure de la suite E2E existente. Para diffs visuales hace falta confirmar que el reporte incluya expected/actual/diff y que los artifacts sean retenidos con nombre y duracion utiles. Sin ese contrato, un gate bloqueante puede fallar sin dejar evidencia suficiente para aprobar o corregir.

## 5. Matriz recomendada para gate futuro

| nivel | nombre | alcance recomendado | condicion para avanzar |
| --- | --- | --- | --- |
| Level 0 | Docs + manual baselines | Estado actual: baselines versionados y auditoria docs-only. | PR-VIS-10 cerrado con inventario y decision ejecutiva. |
| Level 1 | Smoke visual manual/local | Ejecucion local documentada de los 3 specs en Chromium Linux, sin CI. | Dos reruns limpios y procedimiento de update de baselines documentado. |
| Level 2 | CI no bloqueante o workflow manual | Workflow `workflow_dispatch` en Ubuntu/Chromium que corre solo los 3 specs visuales y sube artifacts, sin required check. | Runtime medido, artifacts utiles, cero snapshots win32/darwin y reproduccion limpia en CI. |
| Level 3 | CI bloqueante en PR | Gate minimo `chromium-linux` para los 3 specs visuales o un subset justificado. | Dueño definido, politica de aprobacion visual, runtime aceptable y procedimiento ante diff probado. |
| Level 4 | Cross-browser / full matrix | Ampliar a browsers/plataformas adicionales y mas rutas. | Level 3 estable durante varios PRs y costo operativo aceptado. |

Recomendacion ejecutiva: no activar todavia un gate bloqueante. La evidencia de PR-VIS-9a/9b/9c muestra que las baselines existen y pasaron reruns locales Linux, pero aun faltan medicion de runtime CI, reproduccion en GitHub Actions, estrategia de artifacts y contrato operativo de aprobacion. El siguiente paso debe ser Level 2, no Level 3.

## 6. Proximo PR recomendado

Recomendacion concreta para PR-VIS-11: opcion A, workflow visual manual/no bloqueante.

Alcance recomendado para PR-VIS-11:

- Agregar un workflow manual `workflow_dispatch` para Chromium Linux.
- Ejecutar solo:
  - `pnpm --dir frontend exec playwright test e2e/visual-regression-public.spec.ts`
  - `pnpm --dir frontend exec playwright test e2e/visual-regression-authenticated.spec.ts`
  - `pnpm --dir frontend exec playwright test e2e/visual-regression-stress.spec.ts`
- No usar `--update-snapshots` en CI.
- Subir `frontend/playwright-report/` y `frontend/test-results/` como artifacts.
- Medir y documentar runtime real.
- Mantenerlo no bloqueante y no requerido para PRs.

No se recomienda PR-VIS-11 opcion B todavia porque seria un gate bloqueante sin runtime CI ni contrato de diff probado. No se recomienda opcion C como siguiente paso inmediato porque ya existen baselines suficientes para ensayar el workflow manual; postergar todo el gate sin una corrida CI no bloqueante retrasaria la evidencia operativa necesaria.

## 7. Checklist de decision antes de gate CI

Antes de pasar a un gate bloqueante Level 3, debe quedar cerrado:

- Runtime aceptable medido en GitHub Actions para los 3 specs visuales.
- Snapshots reproducibles en CI con al menos dos corridas limpias consecutivas.
- Cero snapshots `win32` y cero snapshots `darwin` en el repo.
- Guard o procedimiento que impida generar baselines no Linux por accidente, especialmente para el spec publico.
- Documentacion de actualizacion de baselines, incluyendo entorno, comando, plataforma y revision esperada.
- Owner responsable de aprobar cambios visuales.
- Procedimiento ante diff visual: clasificar cambio esperado, bug visual, flake o issue de entorno.
- Estrategia de artifacts de Playwright: reporte HTML, actual/expected/diff, retencion y nombre del artifact.
- Politica para limpiar o aislar `.next` antes de runs visuales si se mantiene `next dev`.
- Confirmacion de dependencias Chromium en CI sin `LD_LIBRARY_PATH` manual.
- Decision explicita sobre si el gate cubre los 3 specs completos o un subset minimo inicial.

## 8. Conclusion

PR-VIS-10 deja cerrado el inventario docs-only de la matriz visual actual: 3 specs, 6 rutas/superficies logicas, 5 viewports por superficie, 30 snapshots PNG versionados y estado confirmado de baseline Chromium Linux sin gate CI.

Queda pendiente estabilizar la operacion: reproducibilidad en GitHub Actions, runtime real, artifacts de diffs, owner de aprobacion y procedimiento de actualizacion de baselines. Tambien queda pendiente cerrar el riesgo de generacion accidental de snapshots no Linux, con foco en el spec publico.

El siguiente PR correcto es PR-VIS-11 opcion A: workflow visual manual/no bloqueante para Chromium Linux, con artifacts y medicion de runtime. Solo despues de esa evidencia deberia evaluarse un gate bloqueante minimo.

## Validaciones de cierre

- `git diff --check`: paso, sin salida.
- `git status --short --untracked-files=all`: paso; muestra solo `?? docs/audit/pr-vis-10-visual-regression-matrix.md`.
- `git diff --stat`: paso, sin salida porque no se ejecuto `git add` y el archivo permanece untracked.
- `git diff --name-only`: paso, sin salida porque no se ejecuto `git add` y el archivo permanece untracked.
- `git diff --name-only | Select-String -Pattern "server/|frontend/src|frontend/e2e|test/|supabase|migrations|pnpm-lock.yaml|package.json|package-lock.json|.github/workflows|frontend/next-env.d.ts|\.claude"`: paso, sin salida.

Validaciones no ejecutadas:

- `pnpm test`, `pnpm build`, `pnpm security:public-surface`, `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck` y `pnpm --dir frontend build`: no ejecutadas por alcance docs-only y porque no hubo cambios de codigo, specs, frontend, backend, dependencias ni manifests.
