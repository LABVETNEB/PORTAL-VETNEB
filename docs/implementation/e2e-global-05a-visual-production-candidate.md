# E2E-GLOBAL-05A — Candidato visual productivo reproducible

Fase preparatoria de `E2E-GLOBAL-05` del programa `LIMPIEZA E2E` (`docs/audit/LIMPIEZA E2E.md`,
§24). Prepara la comparación explícita dev-vs-prod que exige la fase; **no** reemplaza los 40
baselines canónicos ni cambia `e2e:full` (eso es `E2E-GLOBAL-05B`).

La decisión arquitectónica específica de esta ruta está en
[E2E visual production candidate RFC](../architecture/e2e-visual-production-candidate-rfc.md).

## Estado base

| Ítem | Valor |
|---|---|
| Rama base | `main` |
| HEAD base | `e5b9bd986aad5f1b0bd0c0df1e46ef74f0a58057` |
| Asunto | `test(e2e): add honest E2E naming and catalog classification (#1712)` |
| Relación con `origin/main` | `0 0` |
| `git status --short -uall` inicial | vacío |
| Clasificación | R1 (test infrastructure) + R2 (workflow manual, `frontend/package.json`) |

## Scope incluido

- Orquestador del candidato productivo y overlay de Playwright en `frontend/e2e/scripts/`.
- Script explícito `e2e:visual-production-candidate`.
- Ruta `runner=production-candidate` en `.github/workflows/visual-regression-manual.yml`.
- Guard nuevo del contrato y realineación in-PR del digest canónico del workflow (`AGENTS.md` §4).
- Esta documentación (§11).

## Scope excluido

- `E2E-GLOBAL-05B`: regenerar/reemplazar los 40 PNG `-chromium-linux`, pasar `e2e:full` a
  `next start`, retirar la aserción de `e2e-completeness-workflow.test.ts` que exige la ausencia de
  `VETNEB_E2E_PRODUCTION_RUNNER` en `e2e-completeness.yml`.
- `E2E-GLOBAL-06` … `E2E-GLOBAL-10`.
- `frontend/playwright.config.ts`, specs, catálogo, fixtures, `frontend/src/**`, `server/**`,
  dependencias, lockfile, auth, DB, configuración productiva, settings de GitHub.
- La ruta `runner=dev` del workflow manual queda funcionalmente idéntica (incluido su
  `--update-snapshots` condicional y su lista de specs literal, deuda de `E2E-GLOBAL-10`).

## Auditoría previa (bytes de `e5b9bd98`)

| Superficie | Comportamiento observado |
|---|---|
| `frontend/playwright.config.ts` | `pnpm start` sólo con `CI=true` **y** `VETNEB_E2E_PRODUCTION_RUNNER=1`; si no, `pnpm dev`. Rutas relativas (`testDir`, `globalTeardown`, `webServer.cwd`, `outputDir`, reporte HTML) resuelven desde el directorio del config. Sin `snapshotPathTemplate` |
| `e2e-completeness.yml` | Construye el frontend y ejecuta `e2e:full` bajo `next dev`; `e2e-completeness-workflow.test.ts` exige deliberadamente la ausencia del flag (baselines con indicador de desarrollo) |
| `frontend-ci.yml` | Único consumidor del runner productivo: build con `NEXT_PUBLIC_API_URL`, `VETNEB_E2E_ALLOW_LOCAL_API`, `VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS` y `e2e:ci` con el flag |
| `visual-regression-manual.yml` | Sólo `workflow_dispatch`; sin build; `playwright test` con 3 specs literales bajo `next dev`; `--update-snapshots` si `update_snapshots=true`; sube `frontend/e2e/**/*.png` si hubo update o fallo |
| `compare-visual-artifacts.mjs` | Dos raíces arbitrarias (`--left/--right`), `--require-count`, clasificación exacta por archivo (bytes, dimensiones, RGBA), reportes JSON/CSV, exit `0/1/2`. Reutilizable sin cambios |
| Baselines | 40 PNG tracked: `public` 10, `authenticated` 20, `stress` 10 |
| Playwright 1.61 | `toHaveScreenshot` usa `expect.toHaveScreenshot.pathTemplate` → `snapshotPathTemplate` → plantilla por defecto. Con snapshot ausente, `updateSnapshots: "missing"` escribe y **falla** el test; `"all"` escribe y pasa |

## Diseño

```text
CANÓNICO (tracked) ──copia verificada por SHA-256──▶ <evidence>/baseline-dev
next build ─▶ next start (playwright.config.ts, runner productivo) ─▶ <evidence>/candidate-prod
teardown + integridad canónica ─▶ compare-visual-artifacts ─▶ <evidence>/comparison
```

- `frontend/e2e/scripts/visual-production-candidate.mjs` — orquestador. Resuelve la suite desde la
  cohorte `visual-linux` del catálogo, exige Linux (`validatePlatformCompatibility`), prepara un
  directorio de evidencia **fuera del repositorio** y vacío, verificando físicamente el path y
  su ancestro existente más cercano para rechazar symlinks/junctions que redirijan al checkout,
  captura inventario tracked
  (`git ls-files`) + estado (`git status` de `frontend/e2e` + SHA-256), copia los baselines, verifica
  puertos libres, ejecuta `next build` con el mismo entorno de build que `Frontend CI`, exige un
  `.next/BUILD_ID` fresco, corre Playwright con `CI=true` + `VETNEB_E2E_PRODUCTION_RUNNER=1`,
  restaura `next-env.d.ts`, verifica teardown e integridad y compara con `--require-count` igual al
  inventario. No reenvía ningún argumento a Playwright.
- `frontend/e2e/scripts/visual-production-candidate.config.mjs` — overlay del config base. Reutiliza
  servidores, selección de runner, proyectos, timeouts y teardown; sólo ancla rutas al frontend y
  redirige `snapshotPathTemplate`, `expect.toHaveScreenshot.pathTemplate`, `outputDir` y el reporte
  HTML a la evidencia. Rechaza cargarse sin el runner productivo, si el servidor de aplicación no es
  `pnpm start --hostname 127.0.0.1`, si un proyecto sobreescribe la resolución de snapshots o si
  alguna salida cae dentro del repositorio. `updateSnapshots: "all"` sólo existe acoplado a esa
  redirección.
- Workflow manual: input `runner` (`dev` por defecto | `production-candidate`). El job tiene un
  límite externo de 45 minutos; el candidato limita Playwright a 20 minutos, con 25 minutos de
  margen para setup, build, teardown, acta y upload. El primer paso aborta
  `production-candidate` + `update_snapshots=true`; la ruta dev sólo corre con `runner=dev`; la
  subida de `frontend/e2e/**/*.png` queda restringida a dev; la evidencia del candidato se sube desde
  `${{ runner.temp }}`.

Alternativas descartadas:

| Alternativa | Motivo |
|---|---|
| `--update-snapshots` in place + restaurar bytes | Muta transitoriamente los PNG tracked; un corte a mitad deja baselines sobrescritos |
| Modificar `frontend/playwright.config.ts` | Fuera del scope mínimo; el overlay reutiliza el mismo mecanismo sin tocar el config rector |
| Workflow nuevo | Duplica setup y amplía la superficie gobernada (7 workflows canónicos fijados por test) |
| Cambiar `e2e-completeness.yml` / `e2e:full` | Es `E2E-GLOBAL-05B` |
| Comparación perceptual o librería nueva | El comparador exacto existente cubre el contrato |

## Contrato fail-closed

| Exit | Condición |
|---|---|
| `0` | Candidato idéntico (dimensiones y RGBA) a los baselines canónicos |
| `1` | Comparación completa con diferencias, faltantes o inventario distinto (reportadas por archivo) |
| `2` | Uso inválido, evidencia dentro del repo o no vacía, baselines con cambios locales, puertos ocupados, error del comparador |
| `3` | `next build` falló o no produjo un `BUILD_ID` fresco |
| `4` | Playwright falló: el candidato no se compara |
| `5` | Plataforma distinta de Linux |
| `6` | Un baseline canónico o `frontend/e2e` cambió durante la corrida |
| `7` | Servidores E2E siguen escuchando después de Playwright |

Toda corrida con layout creado escribe `visual-production-candidate.json` como acta autosuficiente:
entorno, superficie, actor operacional, timestamp UTC, commit, pasos, resultado explícito,
inventario sanitizado de rutas relativas de artefactos, riesgos residuales, `BUILD_ID`, runner,
estados, SHA-256 de baselines, resumen de comparación y exit. La promoción del candidato a
baseline queda registrada como **no realizada**.

## Archivos

| Archivo | Cambio |
|---|---|
| `frontend/e2e/scripts/visual-production-candidate.mjs` | Nuevo: orquestador |
| `frontend/e2e/scripts/visual-production-candidate.config.mjs` | Nuevo: overlay de Playwright |
| `frontend/e2e/scripts/run-cohort.mjs` | `export` de `pnpmInvocation` (sin cambio de comportamiento) |
| `frontend/package.json` | Script `e2e:visual-production-candidate` |
| `.github/workflows/visual-regression-manual.yml` | Input `runner`, rechazo de update, paso candidato, subidas separadas |
| `test/unit/infrastructure/visual-production-candidate-contract.test.ts` | Nuevo guard (15 tests) |
| `test/unit/infrastructure/workflow-security-policy-contract.test.ts` | Digest realineado y tercera referencia `upload-artifact` |
| `docs/implementation/e2e-global-05a-visual-production-candidate.md` | Esta documentación |

Digest canónico: `86784fe2…35fee9` → `164bd0d1…12fd36`.

## Validaciones

| Gate | Estado |
|---|---|
| Guard nuevo `visual-production-candidate-contract` | PASSED — 15/15 |
| Mutación del guard (update en el paso candidato, build fallido ignorado, redirección de snapshots retirada) | PASSED — discrimina las 3 (12 pass / 3 fail esperados) |
| Guards dirigidos (policy, validator, completeness, production-runner, frontend-ci, catálogo, comparador, next-env, package-scripts + guard nuevo) | PASSED — 136 pass / 1 skip preexistente (symlink en Windows) |
| `node scripts/governance/workflow-security-validator.mjs` | PASSED — 7 workflows, 30 acciones externas |
| `pnpm --dir frontend lint` | PASSED |
| `pnpm --dir frontend typecheck` | PASSED |
| `pnpm typecheck:test` | PASSED |
| `pnpm validate:local` | FAILED (ambiental) — `typecheck` y `typecheck:test` PASSED; `test` 4520 pass / 1 fail / 1 skip: el único fallo es `e2e-global-03b-authoritative-auth-boundary.fastify.test.ts`, que exige `DATABASE_URL`/`SUPABASE_DB_URL` (sin DB local); el `build` encadenado no corrió |
| `pnpm build` (aparte) | PASSED |
| `pnpm security:public-surface` | NOT_RUN — no se toca `frontend/src` ni el bundle público |
| `e2e:full` | NOT_RUN — `AGENTS.md` §7; fuera de 05A |
| Dispatch real de `visual-regression-manual.yml` | NOT_RUN — `gh workflow run` es NO-DELEGABLE; [MANUAL-NICO] |
| `pr-governance` | NOT_RUN — requiere metadatos de PR |

## Validación funcional productiva (Linux local, WSL Ubuntu)

Copia aislada fuera del repositorio (`git archive` de `e5b9bd98` + `.git` + los cambios de trabajo,
byte a byte), `pnpm install --frozen-lockfile --offline` desde el store local, Chromium 1228
(Playwright 1.61) ya presente. Suite mínima representativa `public` (10 PNG).

| Etapa | Evidencia |
|---|---|
| Build | `next build` (Next.js 16.3.4, Turbopack) exit 0; `BUILD_ID` fresco registrado |
| `next start` | `[WebServer] $ next start --hostname 127.0.0.1` |
| Playwright | `10 passed (8.7s)`, 1 worker; cada captura escrita en `candidate-prod/…` |
| Candidato | 10 PNG fuera del repo; 20 adjuntos en `playwright/`; nada en `frontend/playwright-report` ni `frontend/test-results` |
| Teardown | puertos 3000/3107 libres; sin procesos `next start`, fixture ni Chromium |
| Integridad | baselines staged == canónicos (10/10 SHA-256); diff de snapshots vacío en la copia; 40/40 hashes idénticos en el repositorio antes y después |
| Comparación | 10 matched, 0 faltantes, 10 dimensiones idénticas, 10 `pixel-different` → exit `1` |
| Duración total | ~30 s (00:12:41Z → 00:13:11Z, 2026-09-11) |

Diferencias reportadas, **no** normalizadas ni aprobadas:

- `public-login-*` (5): 3 710–3 771 píxeles concentrados en una franja inferior izquierda de
  ≤ 74 px de ancho, compatible con el indicador de desarrollo de Next.js presente en los baselines dev.
- `public-home-*` (5): 150 218–676 088 píxeles desde `y=65`. Causa no determinada: puede ser el
  bundle productivo o el entorno local (fuentes/bibliotecas de WSL ≠ `ubuntu-latest`).

Esta evidencia prueba la infraestructura, **no** es evidencia canónica dev-vs-prod: la comparación
que decide `05B` debe producirse en `ubuntu-latest` mediante el dispatch manual del workflow.

## Riesgos residuales

- **R-R1 — descarga automática de SWC.** En la copia local `next build` descargó
  `swc-linux-x64-{gnu,musl}-16.3.4.tgz` a `~/.cache/next-swc` pese a tener el binario instalado.
  No afecta al repositorio ni a CI observado; se reporta como comportamiento de Next.js.
- **R-R2 — APT en el workflow manual.** Sigue usando `playwright install --with-deps`, expuesto a
  la misma fuente APT que motivó `E2E-GLOBAL-01`. Fuera de scope.
- **R-R3 — presupuesto de 30 min.** `runner=production-candidate` con `suite=all` (40 capturas +
  build) no se midió en CI.
- **R-R4 — ruta dev.** Conserva `--update-snapshots` y la lista literal de specs; su gobierno
  pertenece a `05B`/`E2E-GLOBAL-10`.
- **R-R5 — gobernanza de PR.** El diff mezcla `workflows/CI` y `frontend` como scopes primarios:
  requiere la excepción mixed-scope con justificación o dividirse (orquestador primero, workflow
  después).

## Estado final

`E2E-GLOBAL-05A` preparado y validado localmente. `E2E-GLOBAL-05B` no ejecutado. Ningún PNG
canónico modificado.
