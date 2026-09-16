# E2E-GLOBAL-10B — Cierre documental (R-18) de `LIMPIEZA E2E`

Mitad documental de la fase `E2E-GLOBAL-10` del programa `LIMPIEZA E2E`
(`docs/audit/LIMPIEZA E2E.md` §24). La nota §4 de esa fase separa el ajuste documental del cambio
de código. La mitad de código se cerró en #1729 (GLOBAL-10A) y #1730 (R-14 CI). Este cambio es
docs-only: cierra R-18 y evalúa con evidencia si el programa completo puede cerrarse.

`R-18` es el identificador de la matriz de riesgos de `LIMPIEZA E2E` §22 ("Runbook operativo con
cifras obsoletas"). No es el `R-18` de otros programas del repositorio (p. ej. Particular /
no-scroll).

## Estado base

| Ítem | Valor |
|---|---|
| Rama | `docs/e2e-global-10b-r18-closeout` |
| HEAD base | `c25f4e0613b3f133efc46a7df08aa78e03006323` (`ci(e2e): make visual dev runner catalog-driven (#1730)`), igual a `origin/main` |
| Working tree inicial | `?? frontend/AGENTS.md` y `?? frontend/CLAUDE.md` (generados por `next dev`, untracked); 5 stashes preexistentes. Nada de eso se tocó |
| `AGENTS.md` aplicables | sólo el raíz: `git ls-files` no devuelve otro. `frontend/AGENTS.md` es un archivo generado sin trackear, así que no tiene autoridad |
| Clasificación | R1 (edición documental in-scope). Escrituras Git/GitHub: [MANUAL-NICO] |
| Scope primario (`pr-governance`) | `documentation` |

## Metodología

La documentación no se usó como prueba de sí misma. Cada cifra publicada se recalculó desde una
fuente ejecutable o remota:

| Fuente | Qué se obtuvo |
|---|---|
| `frontend/e2e/suites/catalog.ts`, importado con Node 24 | Tamaños de cohortes, particiones, criticidad, `layer`, plataforma, P1 fuera de `ci` |
| `playwright test --list --reporter=json --output=<scratchpad>` | 98 archivos y 1.326 tests, 0 errores, reconciliación 1:1 con el catálogo. Con reporter json el `--list` no reescribe `playwright-report/` y no deja artefactos en el árbol |
| `git ls-files` / `find` | 98 specs tracked = 98 en disco; 40 PNG `-chromium-linux` |
| `frontend/playwright.config.ts`, `frontend/package.json` | Runner, retries, workers, timeouts, trace, scripts |
| `.github/workflows/{frontend-ci,e2e-completeness,visual-regression-manual,backend-ci,pr-governance,qga-governance}.yml` | Triggers, detectores, timeouts, env, pasos |
| `gh api …/branches/main/protection`, `…/actions/permissions*` (R0) | Cuatro contextos required con app ID, `strict`, conversation resolution y política de Actions, sin cambios desde el 2026-07-30 |
| `gh run list/view` (R0) | Runs `35104076249` (full, #1730), `35095928402` (full, #1729), `35060350621` (full rojo por flaky), `34948699577` (schedule sobre `main`), `35099449451` (Frontend CI en `main`), `35109809582` (Backend CI en `main`, 03B ✔), historial de fallos de `E2E Completeness` |
| `gh pr view` (R0) | Heads y merge commits de #1707…#1730 y evidencia de aceptación en sus bodies (02A, 02B, 03) |
| `test/**` (lectura) | Guards que gobiernan catálogo, workflows y régimen. Ninguno lee el contenido de los documentos editados, así que no hubo realineación |

## Skills

| Skill | Estado | Uso |
|---|---|---|
| `vetneb-web-end-to-end-global` | Cargada | Protocolo VETNEB y lectura transversal de dominios. Dos contradicciones con `AGENTS.md` (prevalece `AGENTS.md`): su validación base (lint/build/`validate:local`) no aplica a docs-only según §6, y su cierre con `gh pr merge --delete-branch` contradice §5.9 |
| `senior-large-scale-codebase-analysis-vetneb` | No disponible | No está instalada. El censo global se hizo con `git grep` |
| `vetneb-production-web-optimization-engineer` | No cargada | No hizo falta: el runtime `next start` quedó demostrado por logs de CI |

## Identificación de los "dos audits obsoletos"

`LIMPIEZA E2E` §24 (GLOBAL-10) remite a "los dos audits obsoletos" y declara como problema "§19".
La tabla de §19 clasifica como **SUPERSEDED** exactamente dos documentos; el resto de sus filas son
`DESACTUALIZADO` (runbook, SoT) o `VIGENTE`:

1. `docs/audit/e2e-enterprise-organization-audit.md` (dos filas de §19: 72 specs / 785 tests y
   "organización plana");
2. `docs/audit/test-suite-enterprise-architecture-audit.md` (una fila de §19: cohortes 7/13/11/11
   y scripts con listas literales).

`docs/audit/pr-e2e-ci-completeness-audit.md` y `docs/audit/e2e-ci-layering-strategy-audit.md` no
figuran en §19. No se editaron: su tratamiento como evidencia histórica se resolvió en los índices
(ver abajo).

## Cambios

| Archivo | Cambio |
|---|---|
| `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | Metadata (efectiva y verificada 2026-09-16); mapa de checks con `E2E Completeness`, `generate-sbom` y el workflow visual; branch protection releída; Backend CI con `lint:backend`, Postgres y 03B; detector y push paths reales de Frontend CI; secciones nuevas *Catálogo y cohortes E2E* y *Visual Regression Manual*; *E2E Completeness* reescrita (`next start`, sin filtro de paths, 98/1.326, 60/45/15 min, `failOnFlakyTests`); docs-only incluye `E2E Completeness`; merge con `--match-head-commit`; guard de eliminación de rama |
| `docs/SOURCES_OF_TRUTH.md` | Entrada *CI / E2E completeness* re-apuntada al runbook, con el slot 06 separado como evidencia histórica fechada; aclaraciones en required checks, always-run y layering; entradas nuevas para `LIMPIEZA E2E` y para las dos auditorías superseded; párrafo de secuencia y estado |
| `docs/audit/README.md` | Alta de `LIMPIEZA E2E.md`; cifras del slot 06 y del RFC marcadas como de su fecha; sección *Auditorías E2E superseded* |
| `docs/HISTORICAL_DOCUMENTATION.md` | Sección *Auditorías E2E superseded* con transición, motivo, owner y sucesores |
| `docs/audit/e2e-enterprise-organization-audit.md` | Bloque de estado documental `SUPERSEDED` al inicio; contenido original intacto |
| `docs/audit/test-suite-enterprise-architecture-audit.md` | Ídem |
| `docs/audit/LIMPIEZA E2E.md` | Metadata de lifecycle y aviso de vigencia de cifras en la cabecera; Anexo B con la matriz de cierre. §§1–28 y el Anexo A quedan sin reescribir |
| `docs/implementation/e2e-global-10b-documentation-closeout.md` | Esta acta |

### Transiciones de lifecycle

| Documento | Antes | Después | Motivo | Sucesor |
|---|---|---|---|---|
| `e2e-enterprise-organization-audit.md` | sin metadata; citado como fuente por E2E-ORG-* | `SUPERSEDED` | `LIMPIEZA E2E` §19; plan E2E-ORG ejecutado | `LIMPIEZA E2E.md`; catálogo + runbook |
| `test-suite-enterprise-architecture-audit.md` | sin metadata; citado como fuente por TEST-ARCH-* | `SUPERSEDED` | `LIMPIEZA E2E` §19; cohortes y scripts obsoletos | `LIMPIEZA E2E.md`, catálogo, runbook; `pr-test-architecture-consolidation-audit.md`, `test/README.md`, convención |
| `LIMPIEZA E2E.md` | `ACTIVE` (sin metadata de política; ausente de SoT y del índice) | `ACTIVE` con metadata, registrado en SoT e índice | Política §8 y §18: fuente rectora `ACTIVE` | — |
| `CI_PR_CHECKS_RUNBOOK.md` | `ACTIVE` | `ACTIVE` (reconciliado) | R-18 | — |

## R-18 — afirmaciones corregidas

| Afirmación previa | Estado real (`c25f4e06`) | Fuente |
|---|---|---|
| `e2e:ci → 43 specs` | 67 specs / 1.030 tests | catálogo; run `35099449451` |
| `e2e:full → 72 specs` | 98 specs / 1.326 tests | catálogo; run `35104076249` |
| `e2e:full` con `next dev` por los baselines | `next build` + `next start`; baselines productivos | `e2e-completeness.yml`; 05B |
| E2E Completeness sólo en PRs que tocan la suite | todo PR a `main`, sin filtro de paths | `e2e-completeness.yml`; 06 |
| Tope de 55 min y `E2E_GLOBAL_TIMEOUT_MS=2400000` | 60 min y `2700000` (45 min), envelope ≥ 15 min fijado por guard | workflow; `e2e-completeness-workflow.test.ts` |
| Rollback "devolver a 45 min" | Obsoleto: el env del paso también lleva el production runner | workflow |
| Diagnóstico "`[e2e] specs: 72`" | `N` = tamaño de `full` en el catálogo del head (98 hoy) | catálogo |
| Detector de Frontend CI sin `shared/**` ni `e2e-completeness.yml` | Ambos presentes; los push paths no incluyen `shared/**` | `frontend-ci.yml` |
| Heavy de Backend CI sin lint | `pnpm lint:backend` antes del audit | `backend-ci.yml` |
| `gh pr merge --squash` sin fijar head | `--match-head-commit` obligatorio | AGENTS.md §5.8 |
| SoT: slot 06 "72 specs / 786 tests" como fuente operativa | Evidencia histórica fechada; operativo = runbook + workflows + catálogo | este cambio |

Estado de R-18: **CLOSED** en el working tree, efectivo al fusionar este cambio.

## Censo de drift documental

Literales buscados con `git grep` fuera de `LIMPIEZA E2E.md`: `72 specs`, `72/72`, `72 archivos`,
`786 tests`, `43 specs`, `95 specs`, `GLOBAL-10B`, `CI_SPLIT_REQUIRED`, `next dev`,
`visual-linux`, `e2e:full`, `e2e:ci`, `E2E Completeness`, `R-18`.

| Clase | Documentos | Acción |
|---|---|---|
| Obsoleta operativa (scope 10B) | runbook; SoT (entrada y secuencia) | Corregida |
| Obsoleta, clasificada `SUPERSEDED` por §19 | los dos audits | Bloque de estado |
| Histórica correctamente fechada | `pr-e2e-ci-completeness-audit.md`, `pr-e2e-ci-completeness-rfc.md`, `enterprise-roadmap-consolidation-plan.md` §slot 06, `enterprise-repository-maturity-audit-roadmap.md`, actas `e2e-org-*`, `e2e-org-ci-single-playwright-invocation.md`, `pr-1681-…`, `e2e-global-07`/`10a`/`r14`, `e2e-stability-hardening-phase-1.md`, `pr-vis-9-observatory.md` (su R4 `next dev` quedó resuelto por 05B) | Sin cambios; los índices marcan las del slot 06 como históricas |
| Vigente | `AGENTS.md` §6/§7; `docs/qa/regression-strategy.md`; `docs/architecture/e2e-visual-production-candidate-rfc.md` | Sin cambios |
| Obsoleta operativa **fuera** del scope nominal de 10B | fila `ERM-CTRL-013` de `enterprise-control-register.md` (43/72 specs, triggers "focused"); `docs/qa/README.md` (layering "vigente"); `test/README.md:153` (`frontend-ci` "non-required") | Reportada; ver Anexo B.7 de `LIMPIEZA E2E` |
| Falso positivo / otro programa | `R-18` de `final-global-vetneb-50-60-pr-roadmap.md` y de otros programas; `72 archivos` de `m48-…` (tests de arquitectura) | Ninguna |

## Evaluación de cierre del programa

Resultado: **`LIMPIEZA E2E` permanece `ACTIVE`**. La matriz completa (fases, bloqueantes, R-01…R-20,
hallazgos sin ID y residuales con scope propuesto) vive en el Anexo B del documento rector para no
duplicarla. En resumen, no se cierra porque:

- **R-02 (P0)** no tiene fase ni guard;
- **E2E-GLOBAL-09** no alcanzó su objetivo `<40 min`: mide 48,5 min en el run `35104076249`;
- **R-15, R-19, R-20, P1-7 y las brechas de cobertura de §6.2** siguen abiertas.

Bloqueos ambientales que **no** son deuda del programa: el test 03B exige una DB local
`portal_vetneb_ci` (BLOCKED en esta máquina, ✔ en CI) y `e2e:visual-linux` es Chromium-Linux
(BLOCKED en win32 por diseño).

## Validaciones

| Gate | Estado | Evidencia |
|---|---|---|
| Links locales y Markdown de los 8 archivos (réplica local de `validateMarkdown` de `pr-governance-validator.mjs`: UTF-8, NUL, marcadores de conflicto, links relativos) | PASSED | 72 links locales resueltos, 0 hallazgos |
| Anclas con fragmento hacia archivos `.md` | PASSED | 5/5 resueltas contra slugs de encabezados |
| Patrones de secretos en líneas agregadas (`detectSecretPattern` del validador) | PASSED | 0 hallazgos; un canario sintético en memoria sí se detecta |
| Clasificación de paths del validador | PASSED | todos `documentation` |
| `git diff --check` | PASSED | — |
| `e2e:verify-catalog` / guards de infraestructura | NOT_RUN | no cambió código ni catálogo; ningún guard lee el contenido de los documentos editados |
| `playwright test --list` (sólo descubrimiento, para recalcular cifras) | PASSED | 98 archivos / 1.326 tests / 0 errores |
| Cohortes E2E, builds, `pnpm test` | NOT_RUN | docs-only (AGENTS.md §6); el runtime ya está demostrado en los runs citados |
| `validate-pr-governance` y demás checks del PR | NOT_RUN | se ejecutan al abrir el PR ([MANUAL-NICO]); `E2E Completeness` también correrá, porque no tiene filtro de paths |

## No-alcance

`frontend/src/**`, `frontend/e2e/**`, `server/**`, `test/**`, `.github/workflows/**`, `scripts/**`,
`package.json`, `pnpm-lock.yaml`, snapshots, configs, DB y migraciones. También quedan fuera: el
control register, `docs/qa/README.md`, `test/README.md`, los comentarios obsoletos de
`playwright.config.ts` y `e2e-completeness.yml`, y cualquier corrección de R-02, R-15, R-19, R-20
o P1-7. Escrituras Git/GitHub: ninguna ejecutada.

## Riesgos residuales

1. Las cifras del runbook y del SoT llevan HEAD y fecha, pero no las fija ningún guard. Un cambio
   de catálogo las vuelve históricas: la regla operativa del runbook indica leer siempre el
   catálogo y el log del run.
2. El runner `dev` del workflow visual todavía no se ejecutó en Ubuntu después de #1730; lanzarlo
   es [MANUAL-NICO].
3. `ERM-DOC-001` sigue abierto: no existe un guard automático de lifecycle documental.
4. Los residuales del programa listados en el Anexo B.7 de `LIMPIEZA E2E`.

## Rollback

Revertir el commit docs-only. No hay impacto de runtime, CI ni datos.

## Estado final

E2E-GLOBAL-10B implementado localmente: R-18 CLOSED al fusionar y `LIMPIEZA E2E` en `ACTIVE`, con
deuda residual explícita. Git/GitHub (stage, commit, push, PR) queda a cargo de Nico.
